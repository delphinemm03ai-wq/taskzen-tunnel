import { CheckCircle2 } from "lucide-react";
import config from "@/config";
import { PageView } from "@/components/funnel/PageView";
import { FUNNEL_EVENTS } from "@/lib/events";

export default function MerciPage() {
  const { thankyou } = config;

  return (
    <main className="paper-grain" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <PageView event={FUNNEL_EVENTS.BOOKING_COMPLETED} />

      <section
        className="container-tight"
        style={{ maxWidth: "40rem", textAlign: "center", paddingTop: "4rem", paddingBottom: "4rem" }}
      >
        <div
          className="reveal reveal-1"
          style={{
            width: 76,
            height: 76,
            borderRadius: "50%",
            background: "var(--color-bg-soft)",
            border: "2px solid var(--color-accent)",
            display: "grid",
            placeItems: "center",
            margin: "0 auto 1.6rem",
          }}
        >
          <CheckCircle2 size={40} style={{ color: "var(--color-accent)" }} />
        </div>

        <span className="eyebrow reveal reveal-1">{thankyou.eyebrow}</span>
        <h1
          className="reveal reveal-2"
          style={{ fontSize: "clamp(2.1rem, 4.5vw, 3.2rem)", margin: "1rem 0 0.9rem" }}
        >
          {thankyou.headline}
        </h1>
        <p
          className="reveal reveal-2"
          style={{ fontSize: "1.12rem", color: "var(--color-ink-soft)", marginBottom: "2.4rem" }}
        >
          {thankyou.body}
        </p>

        <div
          className="surface-card reveal reveal-3"
          style={{ padding: "1.8rem 2rem", textAlign: "left", maxWidth: "30rem", margin: "0 auto" }}
        >
          <h2 style={{ fontSize: "1.05rem", marginBottom: "1rem" }}>Les prochaines étapes</h2>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.9rem" }}>
            {thankyou.nextSteps.map((step, i) => (
              <li key={step} style={{ display: "flex", alignItems: "flex-start", gap: "0.8rem" }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--color-primary)",
                    color: "#fff",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: "0.98rem" }}>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
