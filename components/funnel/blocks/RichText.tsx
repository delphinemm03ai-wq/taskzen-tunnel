import type { Paragraph, RichTextBlock } from "@/types/funnel";

function renderParagraph(p: Paragraph) {
  if (typeof p === "string") return p;
  return p.map((seg, i) => {
    const content = seg.gras ? <strong>{seg.texte}</strong> : seg.texte;
    if (!seg.href) return <span key={i}>{content}</span>;
    const external = seg.href.startsWith("https://");
    return (
      <a
        key={i}
        href={seg.href}
        className="link-underline"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {content}
      </a>
    );
  });
}

/** Texte riche : titre optionnel, paragraphes en texte simple ou segments (gras, lien). */
export function RichText({ block }: { block: RichTextBlock }) {
  return (
    <div style={{ maxWidth: "42rem" }}>
      {block.titre && (
        <h2 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: "1.2rem" }}>{block.titre}</h2>
      )}
      <div style={{ display: "grid", gap: "1rem", fontSize: "1.05rem" }}>
        {block.paragraphes.map((p, i) => (
          <p key={i}>{renderParagraph(p)}</p>
        ))}
      </div>
    </div>
  );
}
