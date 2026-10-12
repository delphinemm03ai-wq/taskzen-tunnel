import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Les guides PDF sont joints par la route d'inscription : on les embarque dans son déploiement.
  outputFileTracingIncludes: {
    "/api/optin": ["./private/guides/**/*"],
  },
};

export default nextConfig;
