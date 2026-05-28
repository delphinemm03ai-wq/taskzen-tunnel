import config from "@/config";
import { CalEmbed } from "@/components/funnel/CalEmbed";
import { PageView } from "@/components/funnel/PageView";
import { FUNNEL_EVENTS } from "@/lib/events";

export default function ReserverPage() {
  const { booking } = config;

  return (
    <main className="paper-grain" style={{ minHeight: "100vh" }}>
      <PageView event={FUNNEL_EVENTS.BOOKING_VIEW} />

      <section
        className="container-tight"
        style={{ paddingTop: "4.5rem", paddingBottom: "5rem", maxWidth: "56rem" }}
      >
        <header style={{ textAlign: "center", marginBottom: "2.4rem" }}>
          <span className="eyebrow reveal reveal-1">{booking.eyebrow}</span>
          <h1
            className="reveal reveal-2"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)", margin: "1rem 0 0.8rem" }}
          >
            {booking.headline}
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
            {booking.description}
          </p>
        </header>

        <div className="reveal reveal-3">
          <CalEmbed />
        </div>
      </section>
    </main>
  );
}
