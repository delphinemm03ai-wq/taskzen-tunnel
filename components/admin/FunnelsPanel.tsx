"use client";

import { useContext, useEffect, useState, type CSSProperties } from "react";
import { AdminSecretContext } from "@/components/admin/ContactsPanel";
import type { AdminFunnel, AdminFunnelsData, AdminPeriode, AdminStep } from "@/types/admin";

/** Valeur absente (source en panne) ou sans objet (pas de page précédente, division par zéro). */
const DASH = "·";

const mono: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};
const th: CSSProperties = {
  textAlign: "left",
  fontSize: "0.72rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--color-ink-soft)",
  fontWeight: 600,
  padding: "0.5rem 0.7rem",
  borderBottom: "1px solid var(--color-line)",
};
const thNum: CSSProperties = { ...th, textAlign: "right" };
const td: CSSProperties = {
  padding: "0.6rem 0.7rem",
  borderBottom: "1px solid var(--color-line)",
  verticalAlign: "top",
};
const num: CSSProperties = { ...td, ...mono, textAlign: "right" };
const badge: CSSProperties = { fontSize: "0.72rem", marginLeft: 6, color: "var(--color-ink-soft)" };

/** Pourcentage en français, ou tiret si une valeur manque ou si le dénominateur est 0. */
function pct(part: number | null, whole: number | null): string {
  if (part === null || whole === null || whole === 0) return DASH;
  return `${((part / whole) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function n(value: number | null): string {
  return value === null ? DASH : value.toLocaleString("fr-FR");
}

function Row({ step, onInscritsClick }: { step: AdminStep; onInscritsClick: (tag: string) => void }) {
  const porteInscrits = step.tag !== null || step.inscrits !== null;
  return (
    <tr>
      <td style={td}>
        <span style={{ fontWeight: 500 }}>{step.titre}</span>
        {step.tag && <span style={badge}>opt-in</span>}
        {step.remerciement && <span style={badge}>remerciement</span>}
        <a
          href={step.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", fontSize: "0.8rem", color: "var(--color-accent)", wordBreak: "break-all" }}
        >
          {new URL(step.url).pathname}
        </a>
      </td>
      <td style={num}>{n(step.vues)}</td>
      <td style={num}>{pct(step.vues, step.vuesAmont)}</td>
      <td style={num}>
        {!porteInscrits ? (
          DASH
        ) : step.tag !== null && step.inscrits !== null ? (
          <button
            type="button"
            onClick={() => onInscritsClick(step.tag as string)}
            title={`Voir les contacts avec le tag ${step.tag}`}
            style={{
              ...mono,
              background: "none",
              border: 0,
              padding: 0,
              cursor: "pointer",
              color: "var(--color-primary-dark)",
              fontWeight: 700,
              textDecoration: "underline",
            }}
          >
            {n(step.inscrits)}
          </button>
        ) : (
          n(step.inscrits)
        )}
      </td>
      <td style={num}>{porteInscrits ? pct(step.inscrits, step.vues) : DASH}</td>
    </tr>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-soft)" }}>
        {label}
      </span>
      <b style={{ ...mono, fontSize: "1.25rem" }}>{value}</b>
    </div>
  );
}

function Alerte({ children }: { children: string }) {
  return (
    <p
      style={{
        margin: 0,
        padding: "0.5rem 0.8rem",
        borderLeft: "3px solid var(--color-primary)",
        background: "var(--color-bg-soft)",
        fontSize: "0.85rem",
      }}
    >
      {children}
    </p>
  );
}

function FunnelCard({
  funnel,
  sources,
  onInscritsClick,
}: {
  funnel: AdminFunnel;
  sources: AdminFunnelsData["sources"];
  onInscritsClick: (tag: string) => void;
}) {
  const optins = funnel.etapes.filter((e) => e.tag !== null);
  // Vues des pages d'opt-in, null dès qu'une manque : dénominateur de la conversion globale.
  const vuesOptins = optins.reduce<number | null>(
    (acc, e) => (acc === null || e.vues === null ? null : acc + e.vues),
    0
  );
  return (
    <article className="surface-card" style={{ padding: "1.4rem", display: "grid", gap: "0.8rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: "1.3rem" }}>{funnel.nom}</h2>
        <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
          {(optins.length > 0 || funnel.historique) && <Kpi label="Inscrits (période)" value={n(funnel.inscrits)} />}
          <Kpi label={`Vues (${funnel.etapes.length} pages)`} value={n(funnel.vues)} />
          {optins.length > 0 && <Kpi label="Conversion" value={pct(funnel.inscrits, vuesOptins)} />}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={th}>Page</th>
              <th style={thNum}>Vues</th>
              <th style={thNum}>Passage</th>
              <th style={thNum}>Inscrits</th>
              <th style={thNum}>Conv.</th>
            </tr>
          </thead>
          <tbody>
            {funnel.etapes.map((step) => (
              <Row key={step.slug} step={step} onInscritsClick={onInscritsClick} />
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-ink-soft)" }}>
        Vues, inscrits et taux portent sur la période choisie. Passage : vues de la page divisées par les vues des pages qui y
        mènent. Conv. : inscrits divisés par vues de la page.
        {funnel.historique && " Inscrits : événement d'inscription PostHog (ces pages écrivent dans Airtable)."}
      </p>
      {sources.posthog === "indisponible" && <Alerte>Vues indisponibles : PostHog n&apos;a pas répondu.</Alerte>}
      {sources.supabase === "indisponible" && !funnel.historique && (
        <Alerte>Inscrits indisponibles : Supabase n&apos;a pas répondu (projet en pause ?).</Alerte>
      )}
    </article>
  );
}

/** Onglet Tunnels : une carte par tunnel, chiffres de /api/admin/funnels. */
export function FunnelsPanel({
  periode,
  onInscritsClick,
}: {
  periode: AdminPeriode;
  onInscritsClick: (tag: string) => void;
}) {
  const secret = useContext(AdminSecretContext);
  const [data, setData] = useState<AdminFunnelsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!secret) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/funnels?periode=${periode}`, { headers: { "x-admin-secret": secret } })
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) {
          setError(json.error?.message || "Erreur");
          setData(null);
        } else {
          setData(json.data);
        }
      })
      .catch(() => setError("Connexion impossible"))
      .finally(() => setLoading(false));
  }, [secret, periode]);

  return (
    <section style={{ display: "grid", gap: "1.2rem" }}>
      {loading && <p style={{ color: "var(--color-ink-soft)", margin: 0 }}>Chargement…</p>}
      {error && (
        <div className="surface-card" style={{ padding: "1.4rem", color: "#b91c1c" }}>
          {error}
        </div>
      )}
      {data &&
        data.tunnels.map((f) => (
          <FunnelCard key={f.slug} funnel={f} sources={data.sources} onInscritsClick={onInscritsClick} />
        ))}
    </section>
  );
}
