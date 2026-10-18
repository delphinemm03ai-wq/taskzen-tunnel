import { NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { errors } from "@/lib/api-response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  CHECKOUT_SESSION_ID,
  assertTestMode,
  isStripeConfigured,
  retrieveCheckoutSession,
} from "@/lib/stripe";
import { findSaleBySession, isSupabaseConfigured } from "@/lib/supabase";
import { getProduit } from "@/funnels/produits";
import type { Produit } from "@/types/produits";

const RATE_LIMIT = { limit: 20, windowSeconds: 60 };

const INTROUVABLE = "Aucun achat confirmé pour ce lien. Si tu viens de payer, réessaie dans une minute.";

/**
 * Téléchargement d'un produit acheté : GET /api/telecharger?session_id=cs_...
 *
 * Le fichier vit dans private/produits/ et n'est jamais public. L'achat est
 * revérifié à chaque clic :
 * 1. vente enregistrée par le webhook (findSaleBySession) ;
 * 2. sinon, la page de remerciement s'affichant souvent avant le webhook,
 *    session relue chez Stripe : acceptée seulement si payée ET si son
 *    metadata.produit désigne un produit connu.
 * Sinon 404.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { allowed } = checkRateLimit(`telecharger:${ip}`, RATE_LIMIT);
  if (!allowed) {
    return errors.tooManyRequests("Trop de requêtes. Réessaie dans une minute.");
  }

  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  if (!CHECKOUT_SESSION_ID.test(sessionId)) {
    return errors.notFound(INTROUVABLE);
  }

  let produit: Produit | undefined;

  // 1. La vente du webhook. Une panne Supabase ne bloque pas un acheteur : on passe à Stripe.
  if (isSupabaseConfigured()) {
    try {
      const sale = await findSaleBySession(sessionId);
      if (sale) produit = getProduit(sale.product_slug);
    } catch (err) {
      console.error("[telecharger] lecture de la vente impossible:", err instanceof Error ? err.message : err);
    }
  }

  // 2. Repli sur Stripe tant que le webhook n'est pas passé.
  if (!produit) {
    if (!isStripeConfigured()) {
      console.error("[telecharger] Stripe non configuré : repli impossible");
      return errors.notFound(INTROUVABLE);
    }
    try {
      assertTestMode();
      const session = await retrieveCheckoutSession(sessionId);
      if (session?.payment_status === "paid") {
        produit = getProduit(session.metadata?.produit ?? "");
      }
    } catch (err) {
      console.error("[telecharger] lecture de la session Stripe impossible:", err instanceof Error ? err.message : err);
      return errors.internal("Téléchargement indisponible pour le moment. Réessaie dans un instant.");
    }
  }

  if (!produit) {
    return errors.notFound(INTROUVABLE);
  }

  const { fichier } = produit.livraison;
  try {
    const contenu = await readFile(path.join(process.cwd(), "private", "produits", fichier));
    return new Response(new Uint8Array(contenu), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fichier}"`,
        "Content-Length": String(contenu.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error(`[telecharger] fichier ${fichier} illisible:`, err instanceof Error ? err.message : err);
    return errors.internal("Téléchargement indisponible pour le moment. Réessaie dans un instant.");
  }
}
