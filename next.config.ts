import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Les guides PDF sont joints par la route d'inscription : on les embarque dans son déploiement.
  // Les produits vendus sont servis par la route de téléchargement, après vérification de l'achat.
  outputFileTracingIncludes: {
    "/api/optin": ["./private/guides/**/*"],
    "/api/telecharger": ["./private/produits/**/*"],
  },
  // Liens courts pour les descriptions YouTube et les légendes (redirections temporaires,
  // pour pouvoir changer la cible plus tard sans que les navigateurs gardent l'ancienne).
  async redirects() {
    return [
      // Guides hors sommet : tunnel « guides » (les règles précises passent avant la règle générale).
      { source: "/g/quick-capture-obsidian", destination: "/t/guides/inscription-quick-capture-obsidian", permanent: false },
      { source: "/g/shorts-avec-claude", destination: "/t/guides/inscription-shorts-avec-claude", permanent: false },
      { source: "/g/:slug", destination: "/t/guides-sommet/inscription-:slug", permanent: false },
      // Anciennes adresses déjà partagées : elles continuent de marcher.
      { source: "/t/guides-sommet/inscription-quick-capture-obsidian", destination: "/t/guides/inscription-quick-capture-obsidian", permanent: false },
      { source: "/t/guides-sommet/inscription-shorts-avec-claude", destination: "/t/guides/inscription-shorts-avec-claude", permanent: false },
      { source: "/livre", destination: "https://sommet.taskzen.fr/livre", permanent: false },
      { source: "/whisper-modele", destination: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin", permanent: false },
      { source: "/sommet-rentable", destination: "https://business-affiliation.com/r/820b42f036", permanent: false },
    ];
  },
};

export default nextConfig;
