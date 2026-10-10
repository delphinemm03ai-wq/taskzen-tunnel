/**
 * Cas de compilation du contrat FunnelConfig (ADR 003 : config invalide = build cassé).
 *
 * Aucun runner : `npm run build` type-checke ce fichier. Chaque `@ts-expect-error`
 * exige une erreur sur la ligne suivante ; si le type devient trop permissif,
 * la directive devient inutile et c'est elle qui casse le build.
 */
import type { Block, FunnelConfig, FunnelStep } from "./funnel";

// Bloc au type inconnu.
// @ts-expect-error "carrousel" n'est pas un type de bloc.
export const blocInconnu = { type: "carrousel", titre: "Galerie" } satisfies Block;

// Champ obligatoire manquant (hero sans titre).
// @ts-expect-error `titre` est requis sur un hero.
export const heroSansTitre = { type: "hero", eyebrow: "Nouveau" } satisfies Block;

// Champ libre ajouté à un bloc connu.
// @ts-expect-error `couleur` n'existe pas sur un bloc cta.
export const champLibre = { type: "cta", libelle: "Go", href: "/reserver", couleur: "red" } satisfies Block;

// URL d'embed non https.
// @ts-expect-error une vidéo exige une URL https.
export const videoHttp = { type: "video", titre: "Démo", embedUrl: "http://exemple.fr" } satisfies Block;

// Date cible qui n'est pas une date ISO.
// @ts-expect-error `cible` doit être une date ISO avec heure.
export const dateInvalide = { type: "countdown", cible: "demain", messageFin: "Fini" } satisfies Block;

// Étape sans slug.
// @ts-expect-error `slug` est requis sur une étape.
export const etapeSansSlug = { titre: "Accueil", blocs: [] } satisfies FunnelStep;

// Tunnel dont une étape contient un bloc invalide : l'erreur remonte jusqu'au tunnel.
export const tunnelInvalide = {
  slug: "x",
  nom: "X",
  // @ts-expect-error le bloc "carrousel" rend l'étape invalide.
  etapes: [{ slug: "a", titre: "A", blocs: [{ type: "carrousel" }] }],
} satisfies FunnelConfig;

// Opt-in sans tag.
// @ts-expect-error `tag` est requis sur un bloc optin.
export const optinSansTag = { type: "optin", labelEmail: "Email", boutonTexte: "Go", etapeSuivante: "b", email: { objet: "O", titre: "T", texte: "X" } } satisfies Block;

// Email de confirmation sans objet.
export const optinEmailSansObjet = {
  type: "optin",
  labelEmail: "Ton email",
  boutonTexte: "Je m'inscris",
  tag: "demo",
  etapeSuivante: "merci",
  // @ts-expect-error `objet` est requis sur l'email de confirmation.
  email: { titre: "Bienvenue", texte: "Merci." },
} satisfies Block;
