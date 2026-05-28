/**
 * Bandeau affiché quand le tunnel tourne en mode démo (clés manquantes).
 * Server Component : lit les variables d'env au rendu.
 */

export function DemoBanner() {
  const airtableOk = Boolean(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
  const posthogOk = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
  const resendOk = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

  const allOk = airtableOk && posthogOk && resendOk;
  if (allOk) return null;

  const missing: string[] = [];
  if (!airtableOk) missing.push("Airtable");
  if (!posthogOk) missing.push("PostHog");
  if (!resendOk) missing.push("Resend");

  return (
    <div
      style={{
        background: "#1c1917",
        color: "#faf6f0",
        fontSize: "13px",
        textAlign: "center",
        padding: "8px 16px",
        fontFamily: "var(--font-body)",
      }}
    >
      Mode démo — non configuré : <strong>{missing.join(", ")}</strong>. Lance{" "}
      <code style={{ background: "rgba(255,255,255,0.12)", padding: "1px 6px", borderRadius: 4 }}>
        /onboarding
      </code>{" "}
      dans Claude Code pour tout brancher.
    </div>
  );
}
