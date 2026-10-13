"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ContactsPage } from "@/types/contacts";

/**
 * Secret admin déjà saisi dans AdminShell, partagé avec les panneaux
 * montés en dessous (une seule saisie pour toute la page /admin).
 */
export const AdminSecretContext = createContext<string>("");

const inputStyle = {
  padding: "0.6rem 0.9rem",
  borderRadius: 10,
  border: "1.5px solid var(--color-line)",
  fontSize: "0.95rem",
  flex: "1 1 14rem",
  background: "var(--color-surface)",
};

const cellStyle = {
  padding: "0.6rem 0.8rem",
  borderBottom: "1px solid var(--color-line)",
  textAlign: "left" as const,
  verticalAlign: "top" as const,
};

/**
 * Contacts du tunnel (Supabase) : liste, recherche par email, filtre par tag,
 * export CSV. Le tag est tenu par AdminShell (un clic dans l'onglet Tunnels
 * ouvre cet onglet déjà filtré).
 */
export function ContactsPanel({ tag, onTagChange }: { tag: string; onTagChange: (tag: string) => void }) {
  const secret = useContext(AdminSecretContext);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [data, setData] = useState<ContactsPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!secret) return;
    fetch("/api/admin/tags", { headers: { "x-admin-secret": secret } })
      .then((r) => r.json())
      .then((json) => setTags(json.ok ? json.data.tags : []))
      .catch(() => setTags([]));
  }, [secret]);

  useEffect(() => {
    if (!secret) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (tag) params.set("tag", tag);
    fetch(`/api/admin/contacts?${params}`, { headers: { "x-admin-secret": secret } })
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
  }, [secret, search, tag, page]);

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({ format: "csv" });
      if (search) params.set("search", search);
      if (tag) params.set("tag", tag);
      const res = await fetch(`/api/admin/contacts?${params}`, {
        headers: { "x-admin-secret": secret },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message || `Export impossible (${res.status})`);
        return;
      }
      // Téléchargement via un lien temporaire : le secret ne passe jamais dans une URL.
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Connexion impossible");
    } finally {
      setExporting(false);
    }
  }

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  // Un tag venu de l'onglet Tunnels peut arriver avant la liste : on l'affiche quand même.
  const options = tag && !tags.includes(tag) ? [tag, ...tags] : tags;
  const filtre = [search ? `« ${search} »` : "", tag ? `le tag « ${tag} »` : ""].filter(Boolean).join(" et ");

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <h2 style={{ fontSize: "1.5rem", margin: 0 }}>Contacts</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(draft.trim());
        }}
        style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}
      >
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Rechercher par email"
          aria-label="Rechercher par email"
          style={inputStyle}
        />
        <select
          id="contacts-tag"
          aria-label="Filtrer par tag"
          value={tag}
          onChange={(e) => {
            setPage(1);
            onTagChange(e.target.value);
          }}
          style={inputStyle}
        >
          <option value="">Tous les tags</option>
          {options.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
          Rechercher
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="btn-primary"
          style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}
        >
          {exporting ? "Export en cours…" : "Exporter CSV"}
        </button>
      </form>

      {loading && <p style={{ color: "var(--color-ink-soft)" }}>Chargement…</p>}
      {error && (
        <div className="surface-card" style={{ padding: "1.4rem", color: "#b91c1c" }}>
          {error}
        </div>
      )}

      {data && !error && data.total === 0 && (
        <div className="surface-card" style={{ padding: "1.4rem", color: "var(--color-ink-soft)" }}>
          {filtre
            ? `Aucun contact ne correspond à ${filtre}.`
            : "Base vide ou projet endormi : aucun contact pour l'instant. Lance l'import Systeme.io pour la remplir."}
        </div>
      )}

      {data && !error && data.total > 0 && (
        <>
          <p style={{ color: "var(--color-ink-soft)", fontSize: "0.85rem", margin: 0 }}>
            <span style={{ fontFamily: "var(--font-mono)" }}>{data.total.toLocaleString("fr-FR")}</span>{" "}
            contact{data.total > 1 ? "s" : ""}
            {filtre ? ` pour ${filtre}` : ""}
          </p>
          <div className="surface-card" style={{ padding: "0.4rem", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr>
                  <th style={cellStyle}>Email</th>
                  <th style={cellStyle}>Prénom</th>
                  <th style={cellStyle}>Tags</th>
                  <th style={cellStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.contacts.map((c) => (
                  <tr key={c.id}>
                    <td style={cellStyle}>{c.email}</td>
                    <td style={cellStyle}>{c.first_name || ""}</td>
                    <td style={cellStyle}>{c.tags.join(", ")}</td>
                    <td style={{ ...cellStyle, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                      {new Date(c.created_at).toLocaleDateString("fr-FR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
              <button
                type="button"
                className="btn-outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
                style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
              >
                Précédent
              </button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                {page} / {pageCount}
              </span>
              <button
                type="button"
                className="btn-outline"
                disabled={page >= pageCount || loading}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
