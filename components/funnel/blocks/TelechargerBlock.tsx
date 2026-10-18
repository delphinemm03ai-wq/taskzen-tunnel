"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import type { TelechargerBlock as TelechargerBlockConfig } from "@/types/funnel";

function Attente({ texte }: { texte: string }) {
  return (
    <p style={{ textAlign: "center", fontSize: "0.95rem", color: "var(--color-ink-soft)" }}>{texte}</p>
  );
}

/**
 * Lit `session_id` dans l'URL de retour de Stripe et affiche le bouton vers
 * la route de téléchargement. Le serveur revérifie l'achat à chaque clic :
 * ce composant ne décide de rien.
 */
function Bouton({ block }: { block: TelechargerBlockConfig }) {
  const sessionId = useSearchParams().get("session_id");
  if (!sessionId) return <Attente texte={block.texteAttente} />;

  return (
    <div style={{ textAlign: "center" }}>
      <a className="btn-primary" href={`/api/telecharger?session_id=${encodeURIComponent(sessionId)}`} download>
        {block.boutonTexte}
        <Download size={18} aria-hidden />
      </a>
    </div>
  );
}

/** Suspense : l'étape est générée statiquement, l'URL n'est connue qu'au navigateur. */
export function TelechargerBlock({ block }: { block: TelechargerBlockConfig }) {
  return (
    <Suspense fallback={<Attente texte={block.texteAttente} />}>
      <Bouton block={block} />
    </Suspense>
  );
}
