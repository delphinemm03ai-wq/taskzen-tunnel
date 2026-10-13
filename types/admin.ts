/** Données de l'onglet Tunnels de l'admin (story s07). `null` = source indisponible. */

export type SourceStatus = "ok" | "indisponible";

export type AdminPeriode = 7 | 30 | 90;

export interface AdminStep {
  slug: string;
  titre: string;
  /** Adresse publique complète, ouverte dans un nouvel onglet. */
  url: string;
  /** Tag posé par le bloc opt-in de l'étape, s'il y en a un. */
  tag: string | null;
  /** Étape cible d'un opt-in (page de remerciement). */
  remerciement: boolean;
  vues: number | null;
  /**
   * Vues des pages qui mènent à celle-ci sur la période (etapeSuivante d'un opt-in,
   * href d'un CTA interne, ou page précédente pour les pages historiques).
   * null si aucune page n'y mène : pas de taux de passage.
   */
  vuesAmont: number | null;
  /** Inscriptions sur la période (tag posé). Renseigné seulement si l'étape porte un opt-in, ou pour la landing historique. */
  inscrits: number | null;
}

export interface AdminFunnel {
  slug: string;
  nom: string;
  /** Carte « Tunnel Méthode IA (pages historiques) » : événements nommés, pas de tag. */
  historique: boolean;
  /** Inscriptions sur la période, somme des pages opt-in ; null si le tunnel n'a pas d'opt-in. */
  inscrits: number | null;
  vues: number | null;
  etapes: AdminStep[];
}

export interface AdminFunnelsData {
  periode: AdminPeriode;
  sources: { posthog: SourceStatus; supabase: SourceStatus };
  tunnels: AdminFunnel[];
}
