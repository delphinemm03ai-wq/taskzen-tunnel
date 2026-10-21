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
      { source: "/g/:slug", destination: "/t/guides-sommet/inscription-:slug", permanent: false },
      { source: "/livre", destination: "https://sommet.taskzen.fr/livre", permanent: false },
      { source: "/sommet-rentable", destination: "https://business-affiliation.com/r/820b42f036", permanent: false },
    ];
  },
};

export default nextConfig;
