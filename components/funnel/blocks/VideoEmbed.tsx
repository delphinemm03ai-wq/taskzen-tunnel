import type { VideoBlock } from "@/types/funnel";

/** Vidéo intégrée (YouTube, Vimeo, Loom...) dans une carte surface au format 16/9. */
export function VideoEmbed({ block }: { block: VideoBlock }) {
  return (
    <div
      className="surface-card"
      style={{
        position: "relative",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        padding: 0,
        maxWidth: "52rem",
        margin: "0 auto",
      }}
    >
      <iframe
        src={block.embedUrl}
        title={block.titre}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
        style={{ width: "100%", height: "100%", border: 0 }}
      />
    </div>
  );
}
