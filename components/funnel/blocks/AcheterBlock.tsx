"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { AcheterBlock as AcheterBlockConfig } from "@/types/funnel";

/**
 * Bouton d'achat : demande une session Stripe Checkout puis redirige vers la
 * page de paiement hébergée par Stripe. Seuls le tunnel et l'étape (lus dans
 * l'URL /t/<funnel>/<step>) partent au serveur : produit et prix sont relus
 * dans la config, le navigateur ne décide de rien.
 */
export function AcheterBlock({ block }: { block: AcheterBlockConfig }) {
  const { funnel, step } = useParams<{ funnel: string; step: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funnel, step }),
      });
      const json = await res.json();

      if (!json.ok || typeof json.data?.url !== "string") {
        setError(json.error?.message || "Le paiement n'a pas pu démarrer. Réessaie.");
        setLoading(false);
        return;
      }

      // Le bouton reste désactivé jusqu'au départ vers Stripe : pas de double session.
      window.location.assign(json.data.url);
    } catch {
      setError("Connexion impossible. Réessaie.");
      setLoading(false);
    }
  }

  const errorId = `acheter-${step}-erreur`;

  return (
    <div style={{ textAlign: "center" }}>
      <button
        type="button"
        className="btn-primary"
        onClick={handleClick}
        disabled={loading}
        aria-describedby={error ? errorId : undefined}
      >
        {loading ? "Redirection vers le paiement…" : block.boutonTexte}
        {!loading && <ArrowRight size={18} aria-hidden />}
      </button>
      {error && (
        <p
          id={errorId}
          key={error}
          role="alert"
          className="error-in"
          style={{ color: "#b91c1c", fontSize: "0.85rem", marginTop: "0.9rem" }}
        >
          {error}
        </p>
      )}
      <p style={{ marginTop: "0.9rem", fontSize: "0.9rem", color: "var(--color-ink-soft)" }}>
        Paiement sécurisé par Stripe.
      </p>
    </div>
  );
}
