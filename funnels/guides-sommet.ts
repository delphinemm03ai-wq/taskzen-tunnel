import type { FunnelConfig, FunnelStep } from "@/types/funnel";

/**
 * Tunnel « guides du sommet » : une étape d'inscription par guide (prénom + e-mail).
 * Chaque étape pose son tag `guide-<nom>`, envoie un e-mail avec le PDF en pièce jointe,
 * puis renvoie vers une page de remerciement.
 *
 * Les PDF sont dans private/guides/ (hors site public).
 */

interface Guide {
  slug: string;
  titre: string;
  fichier: string;
}

const GUIDES: readonly Guide[] = [
  { slug: "monetisation-youtube", titre: "Monétiser ta chaîne YouTube : les conditions à cocher", fichier: "06-mansour-1-4000-heures-checklist.pdf" },
  { slug: "chaine-postes-ia", titre: "Quels postes de ta chaîne confier à l'IA ?", fichier: "06-mansour-2-100-euros-checklist.pdf" },
  { slug: "ecriture-ia-voix", titre: "L'IA, rédacteur ou nègre littéraire ?", fichier: "04-patricia-1-negre-litteraire-infographie.pdf" },
  { slug: "relecture-ia", titre: "Restructurer et relire ton texte sans perdre ta voix", fichier: "04-patricia-2-voix-100-pourcent-prompts.pdf" },
  { slug: "simulateur-abonnements", titre: "Combien d'abonnements peux-tu remplacer par ton outil ?", fichier: "07-oury-1-300-euros-par-mois-simulateur.pdf" },
  { slug: "premier-outil-ia", titre: "Créer ton premier outil IA sans être développeur", fichier: "07-oury-2-300-euros-abonnements-guide.pdf" },
  { slug: "parcours-gabriel", titre: "De 5 dollars de l'heure aux applications IA", fichier: "09-gabriel-1-moins-de-5-euros-infographie.pdf" },
  { slug: "quiz-reponse-ia", titre: "Ta réponse IA est-elle fiable ?", fichier: "09-gabriel-2-80-pourcent-des-gens-quiz.pdf" },
  { slug: "premiere-tache-automatiser", titre: "Quelle tâche automatiser en premier ?", fichier: "02-armel-1-100-salaries-virtuels-checklist.pdf" },
  { slug: "studio-ou-ia", titre: "Produire un épisode : studio ou IA ?", fichier: "05-frank-2-1850-dollars-infographie.pdf" },
  { slug: "erreurs-ia-juridique", titre: "Les erreurs à éviter avec l'IA juridique", fichier: "03-stephane-1-erreur-numero-une-checklist.pdf" },
  { slug: "quick-capture-obsidian", titre: "Quick Capture d'Obsidian : noter une idée en 3 gestes", fichier: "10-delphine-quick-capture-obsidian-memo.pdf" },
];

const etapeInscription = (guide: Guide): FunnelStep => ({
  slug: `inscription-${guide.slug}`,
  titre: guide.titre,
  blocs: [
    {
      type: "hero",
      titre: guide.titre,
      sousTitre: "Laisse ton prénom et ton e-mail, le guide arrive dans ta boîte.",
    },
    {
      type: "optin",
      labelPrenom: "Ton prénom",
      labelEmail: "Ton e-mail, pour recevoir le guide",
      boutonTexte: "Je reçois le guide",
      tag: `guide-${guide.slug}`,
      etapeSuivante: "merci",
      guide: guide.fichier,
      email: {
        objet: `Ton guide : ${guide.titre}`,
        titre: "Ton guide est prêt",
        texte: `Merci pour ton inscription. Ton guide « ${guide.titre} » est en pièce jointe de cet e-mail.`,
      },
    },
  ],
});

const etapeMerci: FunnelStep = {
  slug: "merci",
  titre: "Merci, ton guide arrive par e-mail",
  blocs: [
    {
      type: "hero",
      titre: "Merci, ton guide arrive par e-mail",
      sousTitre: "Pense à vérifier tes spams si tu ne le vois pas dans quelques minutes.",
    },
    {
      type: "cta",
      libelle: "Retour à Taskzen",
      href: "https://taskzen.fr",
    },
  ],
};

const guidesSommet = {
  slug: "guides-sommet",
  nom: "Guides du sommet IA en 5 Jours",
  etapes: [...GUIDES.map(etapeInscription), etapeMerci],
} satisfies FunnelConfig;

export default guidesSommet;
