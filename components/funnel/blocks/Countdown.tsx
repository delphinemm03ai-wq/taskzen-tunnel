"use client";

import { useEffect, useState } from "react";
import type { CountdownBlock } from "@/types/funnel";

type Remaining = { jours: number; heures: number; minutes: number; secondes: number };

function remainingUntil(cible: number, now: number): Remaining | null {
  const ms = cible - now;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return {
    jours: Math.floor(s / 86400),
    heures: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    secondes: s % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Compte à rebours : le seul bloc client du moteur. Le rendu serveur affiche
 * des tirets ; l'heure n'est lue qu'après montage, pour éviter tout écart
 * d'hydratation entre l'horloge du build et celle du visiteur.
 */
export function Countdown({ block }: { block: CountdownBlock }) {
  const cible = new Date(block.cible).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = now === null ? undefined : remainingUntil(cible, now);

  if (remaining === null) {
    return (
      <p style={{ textAlign: "center", fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 600 }}>
        {block.messageFin}
      </p>
    );
  }

  const units: Array<[string, string]> = [
    ["jours", remaining ? String(remaining.jours) : "--"],
    ["heures", remaining ? pad(remaining.heures) : "--"],
    ["minutes", remaining ? pad(remaining.minutes) : "--"],
    ["secondes", remaining ? pad(remaining.secondes) : "--"],
  ];

  return (
    <div style={{ textAlign: "center" }}>
      {block.titre && (
        <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: "1.2rem" }}>{block.titre}</h2>
      )}
      <div
        role="timer"
        aria-live="off"
        style={{ display: "inline-flex", gap: "0.8rem", flexWrap: "wrap", justifyContent: "center" }}
      >
        {units.map(([label, value]) => (
          <div key={label} className="surface-card" style={{ padding: "1rem 1.2rem", minWidth: "5.5rem" }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "2rem",
                fontWeight: 700,
                color: "var(--color-primary-dark)",
                lineHeight: 1.1,
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: "0.78rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-ink-soft)" }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
