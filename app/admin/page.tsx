import config from "@/config";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = {
  title: "Admin : tunnels",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg-soft)" }}>
      <section className="container-tight" style={{ paddingTop: "3.5rem", paddingBottom: "4rem" }}>
        <span className="eyebrow">Tunnel maison</span>
        <h1 style={{ fontSize: "2.2rem", margin: "0.8rem 0 0.4rem" }}>
          Tableau de bord {config.business.name}
        </h1>
        <p style={{ color: "var(--color-ink-soft)", marginBottom: "2rem" }}>
          Pages, vues et inscrits par tunnel. Contacts filtrables par tag.
        </p>
        <AdminShell />
      </section>
    </main>
  );
}
