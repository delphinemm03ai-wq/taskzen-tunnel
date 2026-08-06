import Image from "next/image";
import config from "@/config";
import { OptinForm } from "@/components/funnel/OptinForm";
import { PageView } from "@/components/funnel/PageView";
import { FUNNEL_EVENTS } from "@/lib/events";

export default function LandingPage() {
  const { landing, founder } = config;

  return (
    <main className="paper-grain" style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <PageView event={FUNNEL_EVENTS.LANDING_VIEW} />

      {/* Forme décorative en arrière-plan */}
      <div
        aria-hidden
        className="blob-drift"
        style={{
          position: "absolute",
          top: "-12%",
          right: "-8%",
          width: "46vw",
          height: "46vw",
          maxWidth: 620,
          maxHeight: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 30%, var(--color-primary-light), transparent 62%)",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />

      <section
        className="container-tight funnel-grid"
        style={{
          minHeight: "100vh",
          paddingTop: "5rem",
          paddingBottom: "5rem",
        }}
      >
        {/* Colonne texte */}
        <div>
          <span className="eyebrow reveal reveal-1">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--color-primary)",
                display: "inline-block",
              }}
            />
            {landing.eyebrow}
          </span>

          <h1
            className="reveal reveal-2"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.9rem)", margin: "1.2rem 0 1.1rem" }}
          >
            {landing.headline}
          </h1>

          <p
            className="reveal reveal-2"
            style={{
              fontSize: "1.15rem",
              color: "var(--color-ink-soft)",
              maxWidth: "34ch",
              marginBottom: "2rem",
            }}
          >
            {landing.subhead}
          </p>

          <ul
            className="reveal reveal-3"
            style={{ listStyle: "none", padding: 0, margin: "0 0 2.4rem", display: "grid", gap: "0.7rem" }}
          >
            {landing.bullets.map((b) => (
              <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem" }}>
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    marginTop: 4,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "2px solid var(--color-accent)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--color-accent)" }} />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div style={{ maxWidth: 460 }}>
            <OptinForm />
          </div>
        </div>

        {/* Colonne visuelle - carte editoriale avec photo de la fondatrice */}
        <aside className="reveal reveal-4" style={{ alignSelf: "stretch", display: "flex", alignItems: "center" }}>
          <div
            className="surface-card"
            style={{
              padding: "1.4rem",
              width: "100%",
              transform: "rotate(-1.4deg)",
            }}
          >
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "4 / 5",
                borderRadius: "calc(var(--radius) - 4px)",
                overflow: "hidden",
              }}
            >
              <Image
                src={founder.photo}
                alt={founder.name}
                fill
                sizes="(max-width: 860px) 90vw, 420px"
                style={{ objectFit: "cover" }}
                priority
              />
            </div>

            <div style={{ padding: "1.4rem 0.4rem 0.6rem" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 600 }}>
                {founder.name}
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--color-ink-soft)", marginBottom: "0.9rem" }}>
                {founder.role}
              </div>
              <p style={{ fontSize: "0.92rem", lineHeight: 1.5, color: "var(--color-ink-soft)" }}>
                {landing.socialProof}
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
