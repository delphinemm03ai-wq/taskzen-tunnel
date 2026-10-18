import { NextRequest } from "next/server";
import { success, errors } from "@/lib/api-response";
import { parseCheckoutEvent, verifyStripeSignature } from "@/lib/stripe";
import {
  ensureTags,
  findSaleBySession,
  insertSale,
  isSupabaseConfigured,
  markSaleDelivered,
  tagContact,
  upsertBuyerContact,
} from "@/lib/supabase";
import { isResendConfigured, sendFunnelConfirmationEmail } from "@/lib/resend";
import { getProduit, prixHt } from "@/funnels/produits";

/** Les seuls événements qui enregistrent une vente (ADR 004). */
const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

/**
 * Webhook Stripe : seule source de vérité d'une vente (ADR 004 et 007).
 *
 * 1. Corps lu UNE fois en texte brut, signature vérifiée sur ce texte exact.
 *    Signature absente ou fausse : 400, le JSON n'est pas lu.
 * 2. Seuls les paiements confirmés comptent ; tout le reste répond 200 sans écrire.
 * 3. Montants relus dans la config produit, jamais pris dans l'événement.
 * 4. À CHAQUE événement payé, rejeu compris, tout avant le 200 :
 *    vente écrite une seule fois (insertSale), tag posé (idempotent), puis
 *    email de livraison si la vente n'a pas encore de delivered_at, et date posée.
 * Échec Supabase, du tag ou de l'email : 500, Stripe réessaie et le rejeu
 * reprend là où ça s'est arrêté. Pire cas : un email en double, jamais un manquant.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET absent");
    return errors.internal("Webhook non configuré");
  }
  if (!verifyStripeSignature(rawBody, req.headers.get("stripe-signature"), secret)) {
    return errors.badRequest("Signature invalide");
  }

  const event = parseCheckoutEvent(rawBody);
  if (!event) {
    return errors.badRequest("Événement illisible");
  }

  const session = event.data.object;
  const paid =
    PAID_EVENTS.has(event.type) &&
    (event.type === "checkout.session.async_payment_succeeded" || session.payment_status === "paid");
  if (!paid) {
    return success({ ignored: true });
  }

  // Un produit inconnu ou un email absent ne se corrigent pas en réessayant :
  // 200 loggé, pour que Stripe ne boucle pas.
  const produitSlug = session.metadata?.produit ?? "";
  const produit = getProduit(produitSlug);
  if (!produit) {
    console.error(`[stripe-webhook] produit inconnu "${produitSlug}" (événement ${event.id})`);
    return success({ ignored: true });
  }
  const email = session.customer_details?.email?.trim();
  if (!email) {
    console.error(`[stripe-webhook] email acheteur absent (événement ${event.id})`);
    return success({ ignored: true });
  }

  if (!isSupabaseConfigured()) {
    console.error("[stripe-webhook] Supabase non configuré");
    return errors.internal("Enregistrement indisponible");
  }

  try {
    const amountTtc = produit.prixTtc;
    const amountHt = prixHt(produit);
    if (typeof session.amount_total === "number" && session.amount_total !== amountTtc) {
      // Seul cas attendu : prix modifié en config entre l'achat et le webhook. Loggé, jamais bloquant.
      console.warn(
        `[stripe-webhook] montant Stripe ${session.amount_total} différent de la config ${amountTtc} (événement ${event.id})`
      );
    }

    // Le nom saisi au paiement ne remplace jamais un prénom déjà connu (upsertBuyerContact).
    const stripeFirstName = session.customer_details?.name?.trim().split(/\s+/)[0]?.slice(0, 50) || undefined;
    const contact = await upsertBuyerContact({ email, firstName: stripeFirstName });
    const { inserted } = await insertSale({
      contactId: contact.id,
      productSlug: produitSlug,
      amountTtc,
      amountHt,
      vatRate: produit.tauxTva,
      stripeEventId: event.id,
      stripeSessionId: session.id,
    });

    // Tag synchrone à chaque événement payé : ensureTags et tagContact sont idempotents.
    const tags = await ensureTags([produit.tag]);
    await tagContact(
      contact.id,
      tags.map((t) => t.id)
    );

    const sale = await findSaleBySession(session.id);
    if (!sale) {
      throw new Error(`vente introuvable après écriture (session ${session.id})`);
    }

    let delivered = Boolean(sale.delivered_at);
    if (!delivered) {
      if (!isResendConfigured()) {
        console.log("[stripe-webhook] Resend non configuré : email de livraison non envoyé");
      } else {
        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
        const { livraison } = produit;
        const result = await sendFunnelConfirmationEmail({
          to: email,
          firstName: contact.first_name || stripeFirstName,
          subject: livraison.objet,
          title: livraison.titre,
          text: livraison.texte,
          buttonLabel: livraison.boutonTexte,
          buttonUrl: `${siteUrl}/api/telecharger?session_id=${encodeURIComponent(session.id)}`,
        });
        if (!result.ok) {
          throw new Error(`envoi de la livraison échoué : ${result.reason ?? "raison inconnue"}`);
        }
        console.log(`[stripe-webhook] email de livraison envoyé (${produitSlug})`);
        await markSaleDelivered(session.id);
        delivered = true;
      }
    }

    return success({ received: true, inserted, delivered });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/stripe/webhook] error:", message);
    return errors.internal("Erreur d'enregistrement, Stripe réessaiera");
  }
}
