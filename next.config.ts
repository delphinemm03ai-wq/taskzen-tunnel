import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Les guides PDF sont joints par la route d'inscription : on les embarque dans son déploiement.
  // Les produits vendus sont servis par la route de téléchargement, après vérification de l'achat.
  outputFileTracingIncludes: {
    "/api/optin": ["./private/guides/**/*"],
    "/api/telecharger": ["./private/produits/**/*"],
  },
};

export default nextConfig;
