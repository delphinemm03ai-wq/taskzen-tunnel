/**
 * Claude Tunnel OS — Configuration centrale (SOURCE UNIQUE)
 *
 * Toutes les pages lisent ce fichier. Pour personnaliser ton tunnel,
 * modifie les valeurs ici (ou laisse Claude Code le faire via /onboarding,
 * /copy et /design).
 *
 * Le contenu par défaut ci-dessous est un EXEMPLE de démonstration pour que
 * le tunnel s'affiche complet dès `npm run dev`. Remplace-le par ton business.
 */

const config = {
  business: {
    name: "Atelier Démo",
    tagline: "Le tunnel de vente que tu personnalises en quelques minutes avec Claude Code.",
    domain: "exemple.com",
  },

  brand: {
    // Couleurs — re-personnalisables via /design. Miroir des variables CSS dans globals.css.
    colorPrimary: "#c2410c", // terracotta
    colorAccent: "#0f766e", // teal
    colorBg: "#faf6f0", // crème
    theme: "light" as "light" | "dark",
  },

  // ── Étape 1 : Landing / opt-in ─────────────────────────
  landing: {
    eyebrow: "Ressource gratuite",
    headline: "Reçois le guide qui change la donne",
    subhead:
      "Laisse ton email et accède immédiatement à la ressource. Concret, actionnable, sans blabla.",
    bullets: [
      "Une méthode claire, étape par étape",
      "Des exemples réels que tu peux copier",
      "10 minutes pour passer à l'action",
    ],
    cta: "Recevoir la ressource",
    formLabel: "Ton meilleur email",
    socialProof: "Déjà 1 200+ personnes ont reçu la ressource.",
  },

  // ── Étape 2 : Ressource (accès) ────────────────────────
  resource: {
    type: "video" as "vsl" | "pdf" | "video" | "quiz",
    eyebrow: "Ta ressource est prête",
    title: "Voici ta ressource",
    description:
      "Prends le temps de la parcourir. Quand tu es prêt à passer à l'étape suivante, réserve ton appel ci-dessous.",
    // Pour type=video/vsl : URL d'embed (YouTube, Vimeo, Tella, Loom...).
    embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    // Pour type=pdf : lien de téléchargement direct.
    downloadUrl: "",
    ctaToBooking: "Réserver mon appel offert",
  },

  // ── Étape 3 : Réserver (Cal.com) ───────────────────────
  booking: {
    eyebrow: "Dernière étape",
    headline: "Réserve ton appel découverte",
    description:
      "Choisis le créneau qui te convient. On fait le point ensemble, sans engagement.",
    // Ton identifiant Cal.com : cal.com/<username>/<eventSlug>
    calUsername: "", // ex: "pierre-evrard"
    calEventSlug: "", // ex: "appel-decouverte"
  },

  // ── Étape 4 : Merci ────────────────────────────────────
  thankyou: {
    eyebrow: "C'est confirmé",
    headline: "Ton appel est réservé",
    body: "Tu vas recevoir un email de confirmation. À très vite !",
    nextSteps: [
      "Ajoute le rendez-vous à ton agenda",
      "Prépare tes questions",
      "Surveille ta boîte mail",
    ],
  },

  legal: {
    companyName: "Ton Entreprise",
    contactEmail: "contact@exemple.com",
    privacyUrl: "/confidentialite",
  },
} as const;

export default config;
