import config from "@/config";
import { FunnelDashboard } from "@/components/admin/FunnelDashboard";

export const metadata = {
  title: "Admin — Funnel",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg-soft)" }}>
      <section
        className="container-tight"
        style={{ paddingTop: "3.5rem", paddingBottom: "4rem", maxWidth: "48rem" }}
      >
        <span className="eyebrow">Dashboard</span>
        <h1 style={{ fontSize: "2.2rem", margin: "0.8rem 0 0.4rem" }}>
          Funnel — {config.business.name}
        </h1>
        <p style={{ color: "var(--color-ink-soft)", marginBottom: "2.4rem" }}>
          Taux de conversion par étape, depuis PostHog.
        </p>

        <FunnelDashboard />
      </section>
    </main>
  );
}
