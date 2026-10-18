/**
 * Produits vendus par le tunnel (story s04, ADR 004 et 007).
 *
 * Déclarés dans funnels/produits.ts avec `satisfies Record<string, Produit>` :
 * un champ manquant casse le build. Lus côté serveur seulement, le prix ne
 * vient jamais du navigateur.
 */

/**
 * Email de livraison envoyé après un paiement confirmé par le webhook Stripe.
 * Pas de pièce jointe : le bouton mène à /api/telecharger?session_id=..., qui
 * revérifie l'achat à chaque clic avant de renvoyer le fichier.
 */
export interface LivraisonProduit {
  objet: string;
  titre: string;
  /** Paragraphe principal ; le prénom (s'il est connu) est ajouté par le gabarit. */
  texte: string;
  /** Libellé du bouton de téléchargement de l'email. */
  boutonTexte: string;
  /** Nom du fichier livré, dans private/produits/ (jamais public). */
  fichier: string;
}

export interface Produit {
  nom: string;
  /** Prix TTC en centimes, TVA incluse (ex. 2700 pour 27 €). Montant envoyé à Stripe. */
  prixTtc: number;
  /** Taux de TVA en pourcentage (5.5 pour un livre numérique, 20 pour un service). */
  tauxTva: number;
  /** Tag posé sur l'acheteur, ex. "client-livre". */
  tag: string;
  livraison: LivraisonProduit;
}

/** Une vente enregistrée par le webhook (table tunnel_sales, migration 002). */
export interface Sale {
  id: string;
  contact_id: string;
  product_slug: string;
  amount_ttc: number;
  amount_ht: number;
  vat_rate: number;
  stripe_event_id: string;
  stripe_session_id: string;
  affiliate_code: string | null;
  created_at: string;
  /** Date d'envoi de l'email de livraison (migration 003), null tant qu'il n'est pas parti. */
  delivered_at: string | null;
}
