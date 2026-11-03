"use client";

import { useEffect, useState, type ReactNode } from "react";
import "./editor.css";

const KEY = "tz_admin_secret";

/**
 * Porte d'accès admin, même principe que l'admin existant : le secret part dans l'en-tête x-admin-secret,
 * jamais dans une adresse. Il est gardé pour l'onglet (sessionStorage) afin de passer de la liste à l'éditeur.
 * Le secret est vérifié par le serveur avant d'afficher quoi que ce soit.
 */
export function AdminGate({ children }: { children: (secret: string) => ReactNode }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  async function verify(value: string): Promise<boolean> {
    try {
      const res = await fetch("/api/admin/tunnels", { headers: { "x-admin-secret": value } });
      return res.status !== 401;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(KEY);
    } catch {
      /* stockage indisponible : on redemande le secret */
    }
    if (!stored) {
      setChecking(false);
      return;
    }
    void verify(stored).then((ok) => {
      if (ok) setSecret(stored);
      setChecking(false);
    });
  }, []);

  if (secret) return <>{children(secret)}</>;
  if (checking) return <div className="ed-gate" aria-busy="true" />;

  return (
    <div className="ed-gate">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const value = draft.trim();
          if (!value) return;
          if (await verify(value)) {
            try {
              sessionStorage.setItem(KEY, value);
            } catch {
              /* ignoré */
            }
            setSecret(value);
          } else {
            setError("Secret invalide. Vérifie la valeur et réessaie.");
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-taskzen-512.png" alt="Taskzen" />
        <h1 style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: "1.5rem", margin: 0 }}>Éditeur de pages</h1>
        <label htmlFor="ed-secret" style={{ fontWeight: 600, fontSize: "0.9rem" }}>Secret admin</label>
        <input id="ed-secret" type="password" autoComplete="current-password" value={draft} onChange={(e) => setDraft(e.target.value)} aria-invalid={error ? true : undefined} />
        {error && <div role="alert" style={{ color: "#ff9db0", fontSize: 13 }}>{error}</div>}
        <button className="ed-pill main" type="submit">Entrer</button>
      </form>
    </div>
  );
}
