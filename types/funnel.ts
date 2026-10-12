/**
 * Moteur de pages : le contrat d'un tunnel (ADR 003).
 *
 * Une page = une suite de blocs typés, déclarée dans `funnels/<slug>.ts` avec
 * `satisfies FunnelConfig`. Le type est volontairement fermé : un bloc au type
 * inconnu, un champ manquant ou un champ en trop casse le build, pas la prod.
 */

/** Chemin servi depuis `/public` (ex. "/images/photo.png"). */
export type LocalPath = `/${string}`;

/** URL externe, toujours en https. */
export type HttpsUrl = `https://${string}`;

/** Date ISO 8601 avec heure, ex. "2027-01-01T00:00:00+01:00". */
export type IsoDateTime = `${number}-${number}-${number}T${string}`;

/** Morceau de texte riche : gras et lien optionnels, jamais de HTML libre. */
export interface TextSegment {
  texte: string;
  gras?: boolean;
  href?: LocalPath | HttpsUrl;
}

/** Un paragraphe : texte simple, ou suite de segments mis en forme. */
export type Paragraph = string | readonly TextSegment[];

export interface HeroBlock {
  type: "hero";
  eyebrow?: string;
  titre: string;
  sousTitre?: string;
}

export interface RichTextBlock {
  type: "richText";
  titre?: string;
  paragraphes: readonly Paragraph[];
}

export interface ImageBlock {
  type: "image";
  src: LocalPath | HttpsUrl;
  alt: string;
  largeur: number;
  hauteur: number;
  legende?: string;
}

export interface VideoBlock {
  type: "video";
  titre: string;
  embedUrl: HttpsUrl;
}

export interface BulletsBlock {
  type: "bullets";
  titre?: string;
  items: readonly string[];
}

export interface FaqItem {
  question: string;
  reponse: string;
}

export interface FaqBlock {
  type: "faq";
  titre?: string;
  questions: readonly FaqItem[];
}

export interface TestimonialBlock {
  type: "testimonial";
  citation: string;
  auteur: string;
  role?: string;
}

export interface CountdownBlock {
  type: "countdown";
  titre?: string;
  cible: IsoDateTime;
  messageFin: string;
}

export interface CtaBlock {
  type: "cta";
  libelle: string;
  href: LocalPath | HttpsUrl;
  variante?: "primaire" | "secondaire";
  note?: string;
}

/** Email de confirmation envoyé après l'opt-in : gabarit fixe, texte simple, jamais de HTML libre. */
export interface OptinEmail {
  objet: string;
  titre: string;
  /** Paragraphe principal ; le prénom (s'il est connu) est ajouté par le gabarit. */
  texte: string;
  /** Libellé du bouton vers l'étape suivante ; sans libellé, pas de bouton. */
  boutonTexte?: string;
}

/** Formulaire d'opt-in : contact upserté, tag posé, email envoyé, puis étape suivante. */
export interface OptinBlock {
  type: "optin";
  labelEmail: string;
  /** Libellé du champ prénom ; sans libellé, le champ n'est pas affiché. */
  labelPrenom?: string;
  prenomRequis?: boolean;
  boutonTexte: string;
  /** Tag posé sur le contact à chaque soumission valide. */
  tag: string;
  /** Slug de l'étape vers laquelle rediriger, dans le même tunnel. */
  etapeSuivante: string;
  /** Nom d'un PDF dans private/guides/, joint à l'email de confirmation. */
  guide?: string;
  email: OptinEmail;
}

/** Union discriminée par `type` : un nouveau bloc s'ajoute ici ET dans BlockRenderer. */
export type Block =
  | HeroBlock
  | RichTextBlock
  | ImageBlock
  | VideoBlock
  | BulletsBlock
  | FaqBlock
  | TestimonialBlock
  | CountdownBlock
  | CtaBlock
  | OptinBlock;

export type BlockType = Block["type"];

export interface FunnelStep {
  /** Segment d'URL : /t/<funnel>/<slug>. */
  slug: string;
  /** Titre de l'onglet et des métadonnées. */
  titre: string;
  metaDescription?: string;
  blocs: readonly Block[];
}

export interface FunnelConfig {
  /** Segment d'URL : /t/<slug>/... ; identique au nom du fichier dans funnels/. */
  slug: string;
  nom: string;
  /** Étapes dans l'ordre du parcours. */
  etapes: readonly FunnelStep[];
}
