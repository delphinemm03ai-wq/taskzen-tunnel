import config from "@/config";
import { ResourceViewer } from "@/components/funnel/ResourceViewer";
import { BookingCta } from "@/components/funnel/BookingCta";
import { PageView } from "@/components/funnel/PageView";
import { FUNNEL_EVENTS } from "@/lib/events";

export default function ResourcePage() {
  const { resource } = config;

  return (
    <main className="paper-grain" style={{ minHeight: "100vh" }}>
      <PageView event={FUNNEL_EVENTS.RESOURCE_VIEW} />

      <section
        className="container-tight"
        style={{ paddingTop: "4.5rem", paddingBottom: "5rem", maxWidth: "52rem" }}
      >
        <header style={{ textAlign: "center", marginBottom: "2.6rem" }}>
          <span className="eyebrow reveal reveal-1">{resource.eyebrow}</span>
          <h1
            className="reveal reveal-2"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", margin: "1rem 0 0.8rem" }}
          >
            {resource.title}
          </h1>
          <p
            className="reveal reveal-2"
            style={{
              fontSize: "1.1rem",
              color: "var(--color-ink-soft)",
              maxWidth: "46ch",
              margin: "0 auto",
            }}
          >
            {resource.description}
          </p>
        </header>

        <div className="reveal reveal-3">
          <ResourceViewer />
        </div>

        {/* Bloc CTA vers la réservation */}
        <div
          className="surface-card reveal reveal-4"
          style={{
            marginTop: "2.8rem",
            padding: "2.2rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1.4rem",
          }}
        >
          <div style={{ maxWidth: "34ch" }}>
            <h2 style={{ fontSize: "1.35rem", marginBottom: "0.4rem" }}>
              Prêt à aller plus loin ?
            </h2>
            <p style={{ color: "var(--color-ink-soft)", fontSize: "0.98rem" }}>
              Réserve ton appel offert pour qu&apos;on avance ensemble sur ton projet.
            </p>
          </div>
          <BookingCta label={resource.ctaToBooking} />
        </div>
      </section>
    </main>
  );
}
