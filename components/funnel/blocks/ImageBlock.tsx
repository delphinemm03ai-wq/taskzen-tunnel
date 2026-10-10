import Image from "next/image";
import type { ImageBlock as ImageBlockConfig } from "@/types/funnel";

/**
 * Image : next/image pour un chemin /public, <img> simple pour une URL externe
 * (pas de remotePatterns à maintenir dans next.config).
 */
export function ImageBlock({ block }: { block: ImageBlockConfig }) {
  const style = {
    width: "100%",
    height: "auto",
    display: "block",
    borderRadius: "calc(var(--radius) - 4px)",
  };
  return (
    <figure className="surface-card" style={{ padding: "1.2rem", maxWidth: "28rem", margin: "0 auto" }}>
      {block.src.startsWith("/") ? (
        <Image
          src={block.src}
          alt={block.alt}
          width={block.largeur}
          height={block.hauteur}
          sizes="(max-width: 860px) 90vw, 448px"
          style={style}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={block.src}
          alt={block.alt}
          width={block.largeur}
          height={block.hauteur}
          loading="lazy"
          style={style}
        />
      )}
      {block.legende && (
        <figcaption
          style={{ marginTop: "0.9rem", fontSize: "0.9rem", color: "var(--color-ink-soft)", textAlign: "center" }}
        >
          {block.legende}
        </figcaption>
      )}
    </figure>
  );
}
