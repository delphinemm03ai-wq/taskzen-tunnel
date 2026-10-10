import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CtaBlock } from "@/types/funnel";

/** Appel à l'action : bouton primaire par défaut ; Link pour un chemin interne, lien simple sinon. */
export function CtaButton({ block }: { block: CtaBlock }) {
  const className = block.variante === "secondaire" ? "btn-outline" : "btn-primary";
  const content = (
    <>
      {block.libelle}
      <ArrowRight size={18} aria-hidden />
    </>
  );
  return (
    <div style={{ textAlign: "center" }}>
      {block.href.startsWith("/") ? (
        <Link href={block.href} className={className}>
          {content}
        </Link>
      ) : (
        <a href={block.href} className={className} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      )}
      {block.note && (
        <p style={{ marginTop: "0.9rem", fontSize: "0.9rem", color: "var(--color-ink-soft)" }}>{block.note}</p>
      )}
    </div>
  );
}
