"use client";

import { useEffect, useState } from "react";

interface Step {
  key: string;
  label: string;
  count: number;
}

export function FunnelDashboard() {
  const [secret, setSecret] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [days, setDays] = useState(30);
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Pré-remplit le secret depuis l'URL (?secret=...) pour un accès direct.
    const fromUrl = new URLSearchParams(window.location.search).get("secret");
    if (fromUrl) {
      setSecret(fromUrl);
      setSubmitted(true);
    }
  }, []);

  useEffect(() => {
    if (!submitted || !secret) return;
    setLoading(true);
    setError(null);
    fetch(`/api/funnel/stats?secret=${encodeURIComponent(secret)}&days=${days}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) {
          setError(json.error?.message || "Erreur");
          setSteps(null);
        } else {
          setSteps(json.data.steps);
        }
      })
      .catch(() => setError("Connexion impossible"))
      .finally(() => setLoading(false));
  }, [submitted, secret, days]);

  if (!submitted) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
        className="surface-card"
        style={{ padding: "2rem", maxWidth: "26rem", margin: "0 auto", display: "grid", gap: "1rem" }}
      >
        <label style={{ fontWeight: 600, fontSize: "0.9rem" }}>Secret admin</label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="ADMIN_SECRET"
          style={{
            padding: "0.85rem 1rem",
            borderRadius: 10,
            border: "1.5px solid var(--color-line)",
            fontSize: "1rem",
          }}
        />
        <button type="submit" className="btn-primary">
          Accéder au dashboard
        </button>
      </form>
    );
  }

  const top = steps?.[0]?.count || 0;

  return (
    <div style={{ display: "grid", gap: "1.6rem" }}>
      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--color-ink-soft)" }}>Période :</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={d === days ? "btn-primary" : "btn-outline"}
            style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
          >
            {d} jours
          </button>
        ))}
      </div>

      {loading && <p style={{ color: "var(--color-ink-soft)" }}>Chargement…</p>}
      {error && (
        <div className="surface-card" style={{ padding: "1.4rem", color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {steps && (
        <div style={{ display: "grid", gap: "0.9rem" }}>
          {steps.map((step, i) => {
            const pctOfTop = top > 0 ? Math.round((step.count / top) * 100) : 0;
            const prev = i > 0 ? steps[i - 1].count : null;
            const conv = prev && prev > 0 ? Math.round((step.count / prev) * 100) : null;
            return (
              <div key={step.key} className="surface-card" style={{ padding: "1.2rem 1.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
                  <span style={{ fontWeight: 600 }}>{step.label}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem" }}>
                    {step.count.toLocaleString("fr-FR")}
                    {conv !== null && (
                      <span style={{ fontSize: "0.8rem", color: "var(--color-accent)", marginLeft: 8 }}>
                        {conv}%
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ height: 8, background: "var(--color-bg-soft)", borderRadius: 999 }}>
                  <div
                    style={{
                      width: `${pctOfTop}%`,
                      height: "100%",
                      background: "var(--color-primary)",
                      borderRadius: 999,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
