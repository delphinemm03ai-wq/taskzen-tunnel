"use client";

import { useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { OptinBlock as OptinBlockConfig } from "@/types/funnel";

const inputStyle = {
  padding: "0.95rem 1.1rem",
  borderRadius: "999px",
  border: "1.5px solid var(--color-line)",
  background: "var(--color-surface)",
  fontSize: "1rem",
  outline: "none",
  color: "var(--color-ink)",
} as const;

const labelStyle = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 600,
  marginBottom: "0.5rem",
} as const;

/**
 * Formulaire d'opt-in configurable (calqué sur OptinForm, avec honeypot).
 * Le tunnel et l'étape (lus dans l'URL /t/<funnel>/<step>) partent avec la
 * soumission : la route relit le bloc dans la config (tag, email, étape
 * suivante), le client ne décide de rien.
 */
export function OptinBlock({ block }: { block: OptinBlockConfig }) {
  const router = useRouter();
  const { funnel, step } = useParams<{ funnel: string; step: string }>();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/optin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, funnel, step, website }),
      });
      const json = await res.json();

      if (!json.ok) {
        setError(json.error?.message || "Une erreur est survenue. Réessaie.");
        setLoading(false);
        return;
      }

      // Le bouton reste désactivé jusqu'au changement de page : pas de double envoi.
      router.push(json.data.redirectTo);
    } catch {
      setError("Connexion impossible. Réessaie.");
      setLoading(false);
    }
  }

  const prenomId = `optin-${step}-prenom`;
  const emailId = `optin-${step}-email`;
  const errorId = `optin-${step}-erreur`;

  return (
    <form onSubmit={handleSubmit} noValidate style={{ width: "100%", maxWidth: "34rem", margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {block.labelPrenom && (
          <div>
            <label htmlFor={prenomId} style={labelStyle}>
              {block.labelPrenom}
            </label>
            <input
              id={prenomId}
              type="text"
              required={block.prenomRequis}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ton prénom"
              autoComplete="given-name"
              maxLength={50}
              style={{ ...inputStyle, width: "100%" }}
            />
          </div>
        )}
        <div>
          <label htmlFor={emailId} style={labelStyle}>
            {block.labelEmail}
          </label>
          <input
            id={emailId}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="prenom@email.com"
            autoComplete="email"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            style={{ ...inputStyle, width: "100%" }}
          />
          {error && (
            <p
              id={errorId}
              key={error}
              role="alert"
              className="error-in"
              style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: "0.6rem" }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Honeypot : invisible pour un humain, rempli par les robots. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
          <label htmlFor={`optin-${step}-website`}>Ne pas remplir ce champ</label>
          <input
            id={`optin-${step}-website`}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div style={{ textAlign: "center" }}>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Envoi…" : block.boutonTexte}
            {!loading && <ArrowRight size={18} aria-hidden />}
          </button>
        </div>
      </div>
    </form>
  );
}
