import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import config from "@/config";
import { PostHogProvider } from "@/components/common/PostHogProvider";
import { DemoBanner } from "@/components/common/DemoBanner";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display-loaded",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: config.business.name || "Claude Tunnel OS",
  description: config.business.tagline || "Tunnel de vente propulsé par Claude Code.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body
        style={
          {
            "--font-display": `var(--font-display-loaded), Georgia, serif`,
            "--font-body": `var(--font-body-loaded), system-ui, sans-serif`,
            "--color-primary": config.brand.colorPrimary,
            "--color-accent": config.brand.colorAccent,
            "--color-bg": config.brand.colorBg,
          } as React.CSSProperties
        }
      >
        <PostHogProvider>
          <DemoBanner />
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
