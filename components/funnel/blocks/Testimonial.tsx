import type { TestimonialBlock } from "@/types/funnel";

/** Témoignage : citation en Fraunces dans une carte légèrement inclinée, comme la carte fondatrice. */
export function Testimonial({ block }: { block: TestimonialBlock }) {
  const quoteMark = { color: "var(--color-primary)", fontSize: "2rem", lineHeight: 0 };
  return (
    <figure
      className="surface-card"
      style={{ padding: "2rem 2.2rem", maxWidth: "44rem", margin: "0 auto", transform: "rotate(-0.8deg)" }}
    >
      <blockquote style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.3rem", lineHeight: 1.45 }}>
        <span aria-hidden style={{ ...quoteMark, marginRight: 4 }}>
          «
        </span>
        {block.citation}
        <span aria-hidden style={{ ...quoteMark, marginLeft: 4 }}>
          »
        </span>
      </blockquote>
      <figcaption style={{ marginTop: "1.2rem" }}>
        <div style={{ fontWeight: 600 }}>{block.auteur}</div>
        {block.role && <div style={{ fontSize: "0.85rem", color: "var(--color-ink-soft)" }}>{block.role}</div>}
      </figcaption>
    </figure>
  );
}
