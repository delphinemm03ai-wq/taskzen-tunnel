"use client";

import { useEffect, useRef, useState } from "react";
import type { Block, Page } from "@/lib/page-format/schema";
import { renderBlocksHtml, renderPageHtml } from "@/lib/page-format/render";
import { BLOCK_LABELS } from "@/lib/editor/tree";
import { walk } from "@/lib/page-format/ops";

export type BlockAction = "up" | "down" | "duplicate" | "delete";

interface Props {
  page: Page;
  selectedId: string | null;
  preview: boolean;
  canUp: boolean;
  canDown: boolean;
  onSelect: (id: string | null) => void;
  onAction: (a: BlockAction) => void;
}

/**
 * Page en direct : le même moteur de rendu que la page publique (lib/page-format/render.ts), en mode édition,
 * dans une iframe dont la largeur donne l'aperçu ordinateur, tablette ou téléphone (vraies largeurs CSS).
 * La page n'est écrite qu'une fois dans l'iframe ; ensuite seul le contenu de <main> est remplacé.
 */
export function Canvas(props: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const [srcDoc] = useState(() => renderPageHtml(props.page, { editor: true }));

  // Écouteurs posés une fois sur le document de l'iframe : clic = sélection, la page ne navigue jamais.
  function onLoad() {
    const doc = ref.current?.contentDocument;
    if (!doc) return;
    const closestBlock = (t: EventTarget | null) => (t as HTMLElement | null)?.closest?.("[data-block]") as HTMLElement | null;
    doc.addEventListener("click", (e) => {
      if (latest.current.preview) return;
      e.preventDefault();
      e.stopPropagation();
      const t = e.target as HTMLElement;
      if (t.closest(".ed-tools")) return;
      latest.current.onSelect(closestBlock(e.target)?.dataset.block ?? null);
    }, true);
    doc.addEventListener("submit", (e) => e.preventDefault(), true);
    doc.addEventListener("mouseover", (e) => {
      if (latest.current.preview) return;
      doc.querySelectorAll(".ed-hover").forEach((n) => n.classList.remove("ed-hover"));
      closestBlock(e.target)?.classList.add("ed-hover");
    });
    doc.addEventListener("mouseleave", () => doc.querySelectorAll(".ed-hover").forEach((n) => n.classList.remove("ed-hover")));
    setReady(true);
  }

  useEffect(() => {
    if (!ready) return;
    const doc = ref.current?.contentDocument;
    const main = doc?.querySelector("main");
    if (!doc || !main) return;
    const { page, selectedId, preview } = props;
    main.innerHTML = page.blocks.length ? renderBlocksHtml(page) : `<div class="ed-empty">Page vide. Ajoute un élément depuis le panneau de gauche.</div>`;

    const types = new Map<string, Block["type"]>();
    walk(page.blocks as Block[], (b) => types.set(b.id as string, b.type));
    main.querySelectorAll<HTMLElement>("[data-block]").forEach((el) => {
      el.dataset.label = BLOCK_LABELS[types.get(el.dataset.block as string) ?? "text"];
      if (!preview && el.dataset.block === selectedId) el.classList.add("ed-sel");
    });

    doc.querySelectorAll(".ed-tools").forEach((n) => n.remove());
    const sel = !preview && selectedId ? main.querySelector<HTMLElement>(`[data-block="${selectedId}"]`) : null;
    if (sel) {
      const bar = doc.createElement("div");
      bar.className = "ed-tools";
      const mk = (label: string, text: string, action: BlockAction, disabled = false) => {
        const b = doc.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.title = label;
        b.setAttribute("aria-label", label);
        b.disabled = disabled;
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          latest.current.onAction(action);
        });
        bar.appendChild(b);
      };
      mk("Monter", "↑", "up", !props.canUp);
      mk("Descendre", "↓", "down", !props.canDown);
      mk("Dupliquer", "⧉", "duplicate");
      mk("Supprimer", "✕", "delete");
      doc.body.appendChild(bar);
      const r = sel.getBoundingClientRect();
      const top = r.top + doc.defaultView!.scrollY - 40;
      bar.style.top = `${Math.max(4, top)}px`;
      bar.style.left = `${Math.max(4, Math.min(r.right - 140, doc.documentElement.clientWidth - 150))}px`;
    }
  }, [ready, props.page, props.selectedId, props.preview, props.canUp, props.canDown]); // eslint-disable-line react-hooks/exhaustive-deps

  return <iframe ref={ref} className="ed-iframe" title="Page en direct" srcDoc={srcDoc} onLoad={onLoad} />;
}
