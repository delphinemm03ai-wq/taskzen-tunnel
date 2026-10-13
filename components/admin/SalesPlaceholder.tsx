/** Encart d'attente : les ventes arrivent avec Stripe (story s04). */
export function SalesPlaceholder() {
  return (
    <div className="surface-card" style={{ padding: "2rem", display: "grid", gap: "0.6rem" }}>
      <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Ventes et chiffre d&apos;affaires</h2>
      <p style={{ margin: 0, color: "var(--color-ink-soft)", maxWidth: "34rem" }}>
        Les ventes et le chiffre d&apos;affaires apparaîtront ici avec le paiement Stripe (story s04).
      </p>
    </div>
  );
}
