import { NextRequest } from "next/server";
import { stripeCheckoutSchema } from "@/lib/schemas";
import { success, errors } from "@/lib/api-response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { assertTestMode, createCheckoutSession, isStripeConfigured } from "@/lib/stripe";
import { getFunnel } from "@/funnels";
import { getProduit } from "@/funnels/produits";
import type { AcheterBlock } from "@/types/funnel";

const RATE_LIMIT = { limit: 10, windowSeconds: 60 };

/**
 * Crée une session Stripe Checkout pour le bloc `acheter` d'une étape.
 *
 * Le navigateur envoie seulement { funnel, step } : le bloc, le produit, le
 * prix et les étapes de retour sont relus dans la config. Aucune vente n'est
 * écrite ici : seule la route du webhook signé enregistre un paiement.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const { allowed } = checkRateLimit(`checkout:${ip}`, RATE_LIMIT);
    if (!allowed) {
      return errors.tooManyRequests("Trop de requêtes. Réessaie dans une minute.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errors.badRequest("Données invalides");
    }
    const parsed = stripeCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return errors.badRequest(firstError?.message || "Données invalides");
    }

    // Tunnel, étape, bloc et produit viennent de la config, jamais du client.
    const funnel = getFunnel(parsed.data.funnel);
    const step = funnel?.etapes.find((e) => e.slug === parsed.data.step);
    const block = step?.blocs.find((b): b is AcheterBlock => b.type === "acheter");
    if (!funnel || !step || !block) {
      return errors.badRequest("Produit inconnu");
    }
    const produit = getProduit(block.produit);
    const succes = funnel.etapes.find((e) => e.slug === block.etapeSucces);
    const annulation = funnel.etapes.find((e) => e.slug === block.etapeAnnulation);
    if (!produit || !succes || !annulation) {
      return errors.badRequest("Produit inconnu");
    }

    if (!isStripeConfigured()) {
      console.error("[checkout] Stripe non configuré");
      return errors.internal("Paiement indisponible pour le moment. Réessaie plus tard.");
    }
    assertTestMode();

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const session = await createCheckoutSession({
      nom: produit.nom,
      prixTtc: produit.prixTtc,
      successUrl: `${siteUrl}/t/${funnel.slug}/${succes.slug}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl}/t/${funnel.slug}/${annulation.slug}`,
      metadata: { funnel: funnel.slug, step: step.slug, produit: block.produit },
    });

    return success({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/stripe/checkout] error:", message);
    return errors.internal("Le paiement n'a pas pu démarrer. Réessaie dans un instant.");
  }
}
