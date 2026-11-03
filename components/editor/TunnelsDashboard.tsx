"use client";

import { Fragment, useEffect, useState } from "react";
import type { TunnelSummary } from "@/lib/pages-api";
import "./editor.css";

const KINDS: Record<string, string> = { capture: "Capture", sales: "Vente", order: "Commande", thanks: "Remerciement", other: "Page" };

const chip = (s: string) => <span className={`ed-chip ${s === "published" ? "ok" : "draft"}`}>{s === "published" ? "Publié" : "Brouillon"}</span>;

/** Tableau de bord minimal du lot 1 : tunnels et pages, avec lien vers l'éditeur (visites, ventes et contacts viendront avec leurs lots). */
export function TunnelsDashboard({ secret }: { secret: string }) {
  const [tunnels, setTunnels] = useState<TunnelSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/tunnels", { headers: { "x-admin-secret": secret } })
      .then(async (r) => (r.ok ? setTunnels((await r.json()).data) : setError("Impossible de charger les tunnels.")))
      .catch(() => setError("Connexion impossible."));
  }, [secret]);

  return (
    <div className="ed-dash">
      <div className="wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-taskzen-512.png" alt="Taskzen" width={44} height={44} style={{ borderRadius: 12, marginBottom: 16 }} />
        <h1>Tes tunnels</h1>
        <p>Clique sur « Ouvrir » pour modifier une page dans l'éditeur. Ton IA peut aussi les modifier : vous travaillez sur les mêmes pages.</p>
        {error && <div role="alert">{error}</div>}
        {tunnels && tunnels.length === 0 && <p>Aucun tunnel pour l'instant. Demande à ton IA d'en créer un.</p>}
        {tunnels && tunnels.length > 0 && (
          <table>
            <thead><tr><th>Tunnel / page</th><th>État</th><th>Modifié</th><th /></tr></thead>
            <tbody>
              {tunnels.map((t) => (
                <Fragment key={t.funnel_id}>
                  <tr>
                    <td><b>{t.name}</b><small>{t.steps.length} étape{t.steps.length > 1 ? "s" : ""} · /p/{t.slug}</small></td>
                    <td>{chip(t.status)}</td><td /><td />
                  </tr>
                  {t.steps.map((s, i) => (
                    <tr key={s.page_id}>
                      <td style={{ paddingLeft: 36 }}>{i + 1}. {s.title}<small>{KINDS[s.kind] ?? "Page"} · /p/{t.slug}/{s.slug}</small></td>
                      <td>{chip(s.status)}</td>
                      <td>{new Date(s.updated_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td style={{ textAlign: "right" }}><a className="open" href={`/admin/editeur/${s.page_id}`}>Ouvrir</a></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
