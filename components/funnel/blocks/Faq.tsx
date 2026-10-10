import type { FaqBlock } from "@/types/funnel";

/** FAQ en <details> natifs : s'ouvre et se ferme sans JavaScript. */
export function Faq({ block }: { block: FaqBlock }) {
  return (
    <div style={{ maxWidth: "46rem" }}>
      {block.titre && (
        <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: "1.2rem" }}>{block.titre}</h2>
      )}
      <div style={{ display: "grid", gap: "0.8rem" }}>
        {block.questions.map((q) => (
          <details key={q.question} className="surface-card" style={{ padding: "1.1rem 1.4rem" }}>
            <summary
              style={{ cursor: "pointer", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.1rem" }}
            >
              {q.question}
            </summary>
            <p style={{ marginTop: "0.8rem", color: "var(--color-ink-soft)" }}>{q.reponse}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
