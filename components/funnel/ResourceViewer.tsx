"use client";

import { useEffect, useRef } from "react";
import { FileText, Play } from "lucide-react";
import config from "@/config";
import { track } from "@/lib/posthog-client";
import { FUNNEL_EVENTS } from "@/lib/events";

export function ResourceViewer() {
  const { resource } = config;
  const engagedRef = useRef(false);

  // Marque l'engagement après 15s de présence sur la ressource (proxy "a regardé").
  useEffect(() => {
    const t = setTimeout(() => {
      if (!engagedRef.current) {
        engagedRef.current = true;
        track(FUNNEL_EVENTS.RESOURCE_ENGAGED, { type: resource.type });
      }
    }, 15000);
    return () => clearTimeout(t);
  }, [resource.type]);

  if (resource.type === "pdf") {
    return (
      <div className="surface-card" style={{ padding: "2.5rem", textAlign: "center" }}>
        <FileText size={42} style={{ color: "var(--color-primary)", margin: "0 auto" }} />
        <p style={{ margin: "1rem 0 1.5rem", color: "var(--color-ink-soft)" }}>
          Ta ressource est prête à être téléchargée.
        </p>
        <a
          href={resource.downloadUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          onClick={() => track(FUNNEL_EVENTS.RESOURCE_ENGAGED, { type: "pdf" })}
        >
          <FileText size={18} /> Télécharger le PDF
        </a>
      </div>
    );
  }

  // video / vsl / quiz (fallback embed)
  return (
    <div
      className="surface-card"
      style={{
        position: "relative",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        padding: 0,
      }}
    >
      {resource.embedUrl ? (
        <iframe
          src={resource.embedUrl}
          title={resource.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            alignContent: "center",
            background: "var(--color-bg-soft)",
            color: "var(--color-ink-soft)",
            gap: "0.6rem",
          }}
        >
          <Play size={42} style={{ color: "var(--color-primary)" }} />
          {/* Message visiteur tant que resource.embedUrl est vide (vidéo pas encore en ligne). */}
          <div style={{ textAlign: "center", padding: "0 1.5rem" }}>
            <strong style={{ display: "block", color: "var(--color-ink)", fontSize: "1.05rem" }}>
              Ta vidéo arrive très bientôt
            </strong>
            <span style={{ fontSize: "0.9rem" }}>
              En attendant, réserve ton diagnostic gratuit juste en dessous.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
