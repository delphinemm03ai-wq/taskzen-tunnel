"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import config from "@/config";
import { track } from "@/lib/posthog-client";
import { FUNNEL_EVENTS } from "@/lib/events";
import { setFunnelCookie, FUNNEL_COOKIES } from "@/lib/funnel";

function getUtm() {
  if (typeof window === "undefined") return {};
  const p = new URLSearchParams(window.location.search);
  return {
    utmSource: p.get("utm_source") || undefined,
    utmMedium: p.get("utm_medium") || undefined,
    utmCampaign: p.get("utm_campaign") || undefined,
  };
}

export function OptinForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...getUtm() }),
      });
      const json = await res.json();

      if (!json.ok) {
        setError(json.error?.message || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      track(FUNNEL_EVENTS.LEAD_SIGNUP, { email_domain: email.split("@")[1] });
      setFunnelCookie(FUNNEL_COOKIES.OPTIN, json.data.id || "1");
      router.push("/ressource");
    } catch {
      setError("Connexion impossible. Réessaie.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="reveal reveal-3" style={{ width: "100%" }}>
      <label
        htmlFor="optin-email"
        style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.5rem" }}
      >
        {config.landing.formLabel}
      </label>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <input
          id="optin-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="prenom@email.com"
          style={{
            flex: "1 1 220px",
            padding: "0.95rem 1.1rem",
            borderRadius: "999px",
            border: "1.5px solid var(--color-line)",
            background: "var(--color-surface)",
            fontSize: "1rem",
            outline: "none",
            color: "var(--color-ink)",
          }}
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Envoi…" : config.landing.cta}
          {!loading && <ArrowRight size={18} />}
        </button>
      </div>

      {error && (
        <p style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: "0.6rem" }}>{error}</p>
      )}

      <p
        style={{
          marginTop: "0.9rem",
          fontSize: "0.82rem",
          color: "var(--color-ink-soft)",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        <Check size={15} style={{ color: "var(--color-accent)" }} />
        {config.landing.socialProof}
      </p>
    </form>
  );
}
