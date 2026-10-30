"use client";

import { useState } from "react";
import config from "@/config";
import { CalEmbed } from "@/components/funnel/CalEmbed";
import { track } from "@/lib/posthog-client";
import { FUNNEL_EVENTS } from "@/lib/events";

type GateOption = (typeof config.booking.gate.options)[number];

export function BookingGate() {
  const { gate } = config.booking;
  const [choice, setChoice] = useState<GateOption | null>(null);

  if (choice?.qualified) {
    return <CalEmbed prefill={{ [gate.calField]: choice.calValue }} />;
  }

  if (choice) {
    return (
      <div
        className="surface-card"
        style={{ padding: "2.5rem 2rem", textAlign: "center", display: "grid", gap: "1rem", placeItems: "center" }}
      >
        <h2 style={{ fontSize: "1.5rem", margin: 0 }}>{gate.refusalTitle}</h2>
        <p style={{ color: "var(--color-ink-soft)", maxWidth: "46ch", margin: 0 }}>{gate.refusalText}</p>
        <a className="btn-primary" href={gate.refusalCtaUrl}>
          {gate.refusalCtaLabel}
        </a>
        <button type="button" className="btn-outline" onClick={() => setChoice(null)}>
          Je me suis trompé de réponse
        </button>
      </div>
    );
  }

  return (
    <div className="surface-card" style={{ padding: "2.5rem 2rem", display: "grid", gap: "1.2rem" }}>
      <h2 style={{ fontSize: "1.4rem", margin: 0, textAlign: "center" }}>{gate.question}</h2>
      <div style={{ display: "grid", gap: "0.7rem", maxWidth: "28rem", width: "100%", margin: "0 auto" }}>
        {gate.options.map((option) => (
          <button
            key={option.label}
            type="button"
            className="btn-outline"
            onClick={() => {
              track(FUNNEL_EVENTS.BOOKING_GATE_ANSWER, { revenue: option.label, qualified: option.qualified });
              setChoice(option);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
