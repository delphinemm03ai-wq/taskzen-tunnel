import type { Block, Page } from "@/lib/page-format/schema";
import { walk } from "@/lib/page-format/ops";
import type { Store } from "@/lib/store/store";
import type { Produit } from "@/types/produits";

function findBlock(page: Page, type: string, blockId?: string): Block | null {
  let found: Block | null = null;
  walk(page.blocks as Block[], (b) => {
    if (found || b.type !== type) return;
    if (!blockId || b.id === blockId) found = b;
  });
  return found;
}

export interface PageSale {
  nom: string;
  prixTtc: number;
  produit: string;
  successPath: string;
  cancelPath: string;
}

/**
 * Vente d'une page créée par l'éditeur ou l'IA. Tout est relu dans la version PUBLIÉE,
 * jamais dans le navigateur : un visiteur ne peut pas choisir son prix.
 */
export async function resolvePageSale(store: Store, funnelSlug: string, stepSlug: string, blockId?: string): Promise<PageSale | null> {
  const rec = await store.findPublishedByPath(funnelSlug, stepSlug);
  if (!rec?.published) return null;
  const block = findBlock(rec.published, "payment_button", blockId);
  if (!block || typeof block.price_cents !== "number" || block.price_cents <= 0) return null;

  const funnel = await store.findFunnelBySlug(funnelSlug);
  const index = funnel?.steps.findIndex((s) => s.slug === stepSlug) ?? -1;
  const next = index >= 0 ? funnel?.steps[index + 1] : undefined;
  const current = `/p/${funnelSlug}/${stepSlug}`;
  return {
    nom: rec.published.title,
    prixTtc: block.price_cents,
    produit: String(block.product),
    successPath: next ? `/p/${funnelSlug}/${next.slug}` : current,
    cancelPath: current,
  };
}

/** Formulaire d'inscription publié : l'étiquette vient de la page, jamais du navigateur. */
export async function resolvePageSignup(store: Store, funnelSlug: string, stepSlug: string, blockId?: string): Promise<{ tag: string } | null> {
  const rec = await store.findPublishedByPath(funnelSlug, stepSlug);
  if (!rec?.published) return null;
  const block = findBlock(rec.published, "signup_form", blockId);
  if (!block) return null;
  return { tag: typeof block.tag === "string" && block.tag ? block.tag : `tunnel-${funnelSlug}` };
}

/**
 * Produit d'une vente de page, pour le webhook. Le montant est celui que Stripe a réellement encaissé
 * (événement signé) : la page a pu changer de prix depuis le paiement.
 * TVA à 0 : franchise en base, art. 293 B du CGI, comme le livre.
 */
export function produitDePage(metadata: Record<string, string> | null | undefined, amountTotal: number | null | undefined): Produit | undefined {
  const slug = metadata?.produit;
  if (metadata?.source !== "page" || !slug || typeof amountTotal !== "number") return undefined;
  const nom = metadata.nom || slug;
  return {
    nom,
    prixTtc: amountTotal,
    tauxTva: 0,
    tag: `client-${slug}`,
    livraison: {
      objet: `Ton paiement est bien reçu : ${nom}`,
      titre: "Merci, c'est bien reçu",
      texte: `Ton paiement pour « ${nom} » est bien reçu. Garde cet e-mail, il te servira de confirmation.`,
      boutonTexte: "",
      fichier: "",
    },
  };
}
