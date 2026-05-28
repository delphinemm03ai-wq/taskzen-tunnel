import config from "@/config";
import { OptinForm } from "@/components/funnel/OptinForm";
import { PageView } from "@/components/funnel/PageView";
import { FUNNEL_EVENTS } from "@/lib/events";

export default function LandingPage() {
  const { landing } = config;

  return (
    <main className="paper-grain" style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <PageView event={FUNNEL_EVENTS.LANDING_VIEW} />

      {/* Forme décorative en arrière-plan */}
      <div
        aria-hidden
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

        {/* Colonne visuelle — carte éditoriale */}
        <aside className="reveal reveal-4" style={{ alignSelf: "stretch", display: "flex", alignItems: "center" }}>
          <div
            className="surface-card"
            style={{
              padding: "2.2rem",
              width: "100%",
              transform: "rotate(-1.4deg)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "5rem",
                lineHeight: 1,
                color: "var(--color-primary)",
              }}
            >
              “
            </div>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", lineHeight: 1.3, marginTop: "-1rem" }}>
              La meilleure ressource que j'ai reçue cette année. Claire, directe, et qui m'a vraiment fait passer à
              l'action.
            </p>
            <div style={{ marginTop: "1.6rem", display: "flex", alignItems: "center", gap: "0.8rem" }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: "var(--color-bg-soft)",
                  border: "1px solid var(--color-line)",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  color: "var(--color-ink-soft)",
                }}
              >
                A
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Témoignage exemple</div>
                <div style={{ fontSize: "0.82rem", color: "var(--color-ink-soft)" }}>
                  Remplaçable via /copy
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
