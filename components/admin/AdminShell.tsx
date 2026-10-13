"use client";

import { useState } from "react";
import { AdminSecretContext, ContactsPanel } from "@/components/admin/ContactsPanel";
import { FunnelsPanel } from "@/components/admin/FunnelsPanel";
import { SalesPlaceholder } from "@/components/admin/SalesPlaceholder";
import type { AdminPeriode } from "@/types/admin";

type Tab = "tunnels" | "contacts" | "ventes";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "tunnels", label: "Tunnels" },
  { id: "contacts", label: "Contacts" },
  { id: "ventes", label: "Ventes" },
];

const PERIODES: AdminPeriode[] = [7, 30, 90];

/**
 * Saisie du secret, puis trois onglets. Le secret ne vit que dans l'état React
 * et part dans l'en-tête x-admin-secret : jamais dans une adresse.
 */
export function AdminShell() {
  const [secret, setSecret] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [checking, setChecking] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("tunnels");
  const [periode, setPeriode] = useState<AdminPeriode>(30);
  const [contactsTag, setContactsTag] = useState("");

  /** Vérifie le secret auprès du serveur avant d'ouvrir les onglets : un faux secret reste sur le formulaire. */
  async function verifySecret() {
    const value = secret.trim();
    if (!value) return;
    setChecking(true);
    setSecretError(null);
    try {
      const res = await fetch("/api/admin/tags", { headers: { "x-admin-secret": value } });
      if (res.status === 401) {
        setSecretError("Secret invalide. Vérifie la valeur et réessaie.");
        return;
      }
      // 200 ou 500 (Supabase en panne) : le secret est accepté, les panneaux afficheront l'état des sources.
      setSecret(value);
      setSubmitted(true);
    } catch {
      setSecretError("Connexion impossible. Réessaie dans un instant.");
    } finally {
      setChecking(false);
    }
  }

  if (!submitted) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verifySecret();
        }}
        className="surface-card"
        style={{ padding: "2rem", maxWidth: "26rem", margin: "0 auto", display: "grid", gap: "1rem" }}
      >
        <label htmlFor="admin-secret" style={{ fontWeight: 600, fontSize: "0.9rem" }}>
          Secret admin
        </label>
        <input
          id="admin-secret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="current-password"
          aria-invalid={secretError ? true : undefined}
          aria-describedby={secretError ? "admin-secret-error" : undefined}
          style={{
            padding: "0.85rem 1rem",
            borderRadius: 10,
            border: `1.5px solid ${secretError ? "#b91c1c" : "var(--color-line)"}`,
            fontSize: "1rem",
          }}
        />
        {secretError && (
          <p id="admin-secret-error" className="error-in" style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>
            {secretError}
          </p>
        )}
        <button type="submit" className="btn-primary" disabled={checking}>
          {checking ? "Vérification…" : "Accéder au tableau de bord"}
        </button>
      </form>
    );
  }

  return (
    <AdminSecretContext.Provider value={secret}>
      <div style={{ display: "grid", gap: "1.4rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div role="tablist" style={{ display: "flex", gap: "0.4rem", borderBottom: "1px solid var(--color-line)" }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                style={{
                  border: 0,
                  background: "transparent",
                  font: "inherit",
                  padding: "0.6rem 0.9rem",
                  cursor: "pointer",
                  color: tab === t.id ? "var(--color-primary-dark)" : "var(--color-ink-soft)",
                  fontWeight: tab === t.id ? 600 : 400,
                  borderBottom: `3px solid ${tab === t.id ? "var(--color-primary)" : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "tunnels" && (
            <div role="group" aria-label="Période" style={{ display: "flex", gap: "0.4rem" }}>
              {PERIODES.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={periode === d}
                  onClick={() => setPeriode(d)}
                  className={periode === d ? "btn-primary" : "btn-outline"}
                  style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                >
                  {d} jours
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === "tunnels" && (
          <FunnelsPanel
            periode={periode}
            onInscritsClick={(tag) => {
              setContactsTag(tag);
              setTab("contacts");
            }}
          />
        )}
        {tab === "contacts" && <ContactsPanel tag={contactsTag} onTagChange={setContactsTag} />}
        {tab === "ventes" && <SalesPlaceholder />}
      </div>
    </AdminSecretContext.Provider>
  );
}
