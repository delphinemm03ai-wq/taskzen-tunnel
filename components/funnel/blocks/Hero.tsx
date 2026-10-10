import type { HeroBlock } from "@/types/funnel";

/** En-tête d'étape : eyebrow, titre Fraunces (le seul h1 de la page), sous-texte. */
export function Hero({ block }: { block: HeroBlock }) {
  return (
    <header style={{ maxWidth: "46rem" }}>
      {block.eyebrow && (
        <span className="eyebrow reveal reveal-1">
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--color-primary)",
              display: "inline-block",
            }}
          />
          {block.eyebrow}
        </span>
      )}
      <h1
        className="reveal reveal-2"
        style={{ fontSize: "clamp(2.4rem, 5vw, 3.9rem)", margin: "1.2rem 0 1.1rem" }}
      >
        {block.titre}
      </h1>
      {block.sousTitre && (
        <p
          className="reveal reveal-3"
          style={{ fontSize: "1.15rem", color: "var(--color-ink-soft)", maxWidth: "40ch" }}
        >
          {block.sousTitre}
        </p>
      )}
    </header>
  );
}
