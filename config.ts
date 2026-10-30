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
    name: "Taskzen",
    tagline: "Arrête de perdre tes soirées à répondre aux mêmes messages clients.",
    domain: "taskzen.fr",
  },

  brand: {
    // Couleurs — re-personnalisables via /design. Miroir des variables CSS dans globals.css.
    colorPrimary: "#a8431f", // argile brûlée
    colorAccent: "#3f5d3a", // mousse profonde
    colorBg: "#f3ecdd", // papier chaud
    theme: "light" as "light" | "dark",
  },

  founder: {
    name: "Delphine Moura Miranda",
    role: "Fondatrice de Taskzen",
    photo: "/images/delphine-founder.png",
  },

  // ── Étape 1 : Landing / opt-in ─────────────────────────
  landing: {
    eyebrow: "Ressource gratuite (5 minutes)",
    headline: "Arrête de perdre tes soirées à répondre aux mêmes messages clients",
    subhead:
      "La vidéo de 5 minutes (bientôt en ligne) qui montre comment les entrepreneurs automatisent leurs réponses WhatsApp, email et SMS. Sans paraître robotique, sans rien installer eux-mêmes.",
    bullets: [
      "Le mécanisme exact pour répondre automatiquement dans TON ton, pas celui d'un robot",
      "Le calcul de ce que ton temps de support te coûte vraiment (le chiffre pique)",
      "Comment qualifier tes prospects et caler les RDV sans lever le petit doigt",
    ],
    cta: "Recevoir la vidéo dès sa sortie",
    formLabel: "Ton meilleur email",
    socialProof:
      "25 ans à faire tourner des systèmes qui n'ont pas le droit de tomber (Airbus, Renault, Orange, Air France), maintenant au service des entrepreneurs.",
  },

  // ── Étape 2 : Ressource (accès) ────────────────────────
  resource: {
    type: "video" as "vsl" | "pdf" | "video" | "quiz",
    eyebrow: "Merci pour ton inscription",
    title: "La Méthode IA : comment récupérer du temps sans embaucher",
    description:
      "En 5 minutes, tu vas voir exactement comment automatiser tes réponses clients sans perdre ton ton, et combien ce temps perdu te coûte réellement chaque mois. Envie de savoir combien TOI tu peux récupérer avec tes messages à toi ? Réserve ton diagnostic gratuit juste en dessous.",
    // Pour type=video/vsl : URL d'embed (YouTube, Vimeo, Tella, Loom...).
    // Vide tant que la vidéo n'est pas tournée : la page affiche un message d'attente (12/10/2026).
    embedUrl: "",
    // Pour type=pdf : lien de téléchargement direct.
    downloadUrl: "",
    ctaToBooking: "Réserver mon diagnostic gratuit",
  },

  // ── Étape 3 : Réserver (Cal.com) ───────────────────────
  booking: {
    eyebrow: "Dernière étape",
    headline: "Réserve ton audit gratuit de 30 minutes",
    description:
      "On regarde ensemble tes messages clients et on chiffre précisément le temps (et l'argent) que tu peux récupérer chaque semaine. Sans engagement, sans vente forcée : tu repars avec le chiffrage, que tu bosses avec moi ou pas.",
    // Ton identifiant Cal.com : cal.com/<username>/<eventSlug>
    calUsername: "delphine-taskzen",
    calEventSlug: "audit-30mn",
    // Filtre avant le calendrier : seuls les CA "qualified" voient l'agenda.
    // "calValue" doit être identique à l'option du formulaire Cal.com (préremplie).
    gate: {
      question: "Quel est ton chiffre d'affaires mensuel ?",
      calField: "chiffre-affaires",
      options: [
        { label: "Moins de 3 000 €", calValue: "Moins de 3 000 €", qualified: false },
        { label: "3 000 à 10 000 €", calValue: "3 000 à 10 000 €", qualified: false },
        { label: "10 000 à 30 000 €", calValue: "10 000 à 30 000 €", qualified: true },
        { label: "Plus de 30 000 €", calValue: "Plus de 30 000 €", qualified: true },
      ],
      refusalTitle: "Merci pour ta franchise",
      refusalText:
        "Mon accompagnement est pensé pour les entreprises qui font au moins 10 000 € par mois. En dessous, l'investissement ne serait pas rentable pour toi, et je préfère te le dire tout de suite. En attendant, tu trouveras des idées d'automatisation simples à mettre en place seul sur mon site.",
      refusalCtaLabel: "Lire mes articles",
      refusalCtaUrl: "https://taskzen.fr",
    },
  },

  // ── Étape 4 : Merci ────────────────────────────────────
  thankyou: {
    eyebrow: "C'est confirmé",
    headline: "Ton diagnostic est réservé",
    body: "Tu vas recevoir un email de confirmation avec le lien de visio. D'ici là, jette un œil à tes messages clients de la semaine dernière : combien de temps ça t'a pris ? On en reparle pendant l'appel.",
    nextSteps: [
      "Ajoute le rendez-vous à ton agenda",
      "Note le nombre de messages clients que tu reçois en moyenne par jour",
      "Prépare tes questions sur l'automatisation",
    ],
  },

  legal: {
    companyName: "Taskzen",
    contactEmail: "contact@taskzen.fr",
    privacyUrl: "/confidentialite",
  },
} as const;

export default config;
