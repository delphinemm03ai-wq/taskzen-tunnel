"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Cal, { getCalApi } from "@calcom/embed-react";
import { CalendarClock } from "lucide-react";
import config from "@/config";
import { track } from "@/lib/posthog-client";
import { FUNNEL_EVENTS } from "@/lib/events";
import { setFunnelCookie, FUNNEL_COOKIES } from "@/lib/funnel";

export function CalEmbed() {
  const router = useRouter();
  const { calUsername, calEventSlug } = config.booking;
  const calLink =
    calUsername && calEventSlug ? `${calUsername}/${calEventSlug}` : null;

  useEffect(() => {
    if (!calLink) return;
    (async () => {
      const cal = await getCalApi();
      // À la confirmation d'un booking : event + cookie + redirection /merci
      cal("on", {
        action: "bookingSuccessful",
        callback: () => {
          track(FUNNEL_EVENTS.BOOKING_COMPLETED);
          setFunnelCookie(FUNNEL_COOKIES.BOOKING, "1");
          router.push("/merci");
        },
      });
    })();
  }, [calLink, router]);

  if (!calLink) {
    // Mode démo : pas de Cal.com configuré
    return (
      <div
        className="surface-card"
        style={{ padding: "3rem 2rem", textAlign: "center", display: "grid", gap: "1rem", placeItems: "center" }}
      >
        <CalendarClock size={44} style={{ color: "var(--color-primary)" }} />
        <p style={{ color: "var(--color-ink-soft)", maxWidth: "40ch" }}>
          Calendrier non configuré. Renseigne ton identifiant Cal.com dans{" "}
          <code style={{ background: "var(--color-bg-soft)", padding: "1px 6px", borderRadius: 4 }}>
            config.ts
          </code>{" "}
          (booking.calUsername / calEventSlug) ou lance <strong>/onboarding</strong>.
        </p>
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            track(FUNNEL_EVENTS.BOOKING_COMPLETED, { demo: true });
            setFunnelCookie(FUNNEL_COOKIES.BOOKING, "demo");
            router.push("/merci");
          }}
        >
          Simuler une réservation (démo)
        </button>
      </div>
    );
  }

  return (
    <div className="surface-card" style={{ padding: "0.5rem", overflow: "hidden" }}>
      <Cal
        calLink={calLink}
        style={{ width: "100%", height: "100%", minHeight: "640px" }}
        config={{ layout: "month_view" }}
      />
    </div>
  );
}
