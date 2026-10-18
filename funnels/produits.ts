import type { Produit } from "@/types/produits";

/**
 * Registre des produits vendus par le tunnel (story s04).
 *
 * Lu côté serveur seulement (route de checkout et webhook Stripe) : le prix,
 * le taux de TVA et le tag ne viennent jamais du navigateur. Un produit
 * s'ajoute ici et se vend depuis un bloc `acheter` qui cite son slug.
 */
export const produits = {
  livre: {
    nom: "E-book du Sommet IA en 5 Jours",
    prixTtc: 2700,
    // TVA non applicable, art. 293 B du CGI (franchise en base) : HT = TTC.
    // Le jour où la franchise saute, un livre numérique passe à 5,5 (art. 278-0 bis A).
    tauxTva: 0,
    tag: "client-livre",
    livraison: {
      objet: "Ton e-book du Sommet IA est prêt",
      titre: "Merci pour ton achat",
      texte:
        "Ton paiement est bien reçu. Ton e-book du Sommet IA en 5 Jours t'attend : les méthodes des intervenants, rassemblées pour que tu passes à l'action dès cette semaine. Clique sur le bouton pour le télécharger. Garde cet email, le lien reste valable.",
      boutonTexte: "Je télécharge mon e-book",
      fichier: "le-livre-du-sommet-ia-en-5-jours.pdf",
    },
  },
} satisfies Record<string, Produit>;

export type ProduitSlug = keyof typeof produits;

export function getProduit(slug: string): Produit | undefined {
  return Object.hasOwn(produits, slug) ? produits[slug as ProduitSlug] : undefined;
}

/** Montant HT en centimes : round(TTC / (1 + taux/100)). 2700 à 0 % donne 2700, à 5,5 % donnerait 2559. */
export function prixHt(produit: Produit): number {
  return Math.round(produit.prixTtc / (1 + produit.tauxTva / 100));
}
