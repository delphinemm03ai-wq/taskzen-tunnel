"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, BlockType, Page } from "@/lib/page-format/schema";
import { findBlock, type Change } from "@/lib/page-format/ops";
import { defaultBlock, cloneWithNewIds, locate, BLOCK_LABELS } from "@/lib/editor/tree";
import { edit, initState, isDirty, markSaved, pendingOps, rebaseOnServer, redo, undo, MAX_UNDO, type EditorState } from "@/lib/editor/history";
import { Canvas, type BlockAction } from "./Canvas";
import { Inspector } from "./Inspector";
import "./editor.css";

const GROUPS: { title: string; items: { type: BlockType; icon: string }[] }[] = [
  { title: "Contenu", items: [{ type: "heading", icon: "T" }, { type: "text", icon: "¶" }, { type: "list", icon: "≡" }, { type: "image", icon: "▣" }, { type: "video", icon: "▶" }, { type: "button", icon: "◉" }] },
  { title: "Mise en page", items: [{ type: "divider", icon: "―" }, { type: "columns", icon: "▥" }, { type: "section", icon: "▭" }] },
  { title: "Vendre et inscrire", items: [{ type: "signup_form", icon: "✉" }, { type: "payment_button", icon: "€" }, { type: "testimonials", icon: "“" }, { type: "faq", icon: "?" }, { type: "timer", icon: "⏱" }, { type: "popup", icon: "⧉" }] },
];

const DEVICES = [
  { id: "desktop", label: "Ordinateur", width: "100%", tag: "pleine largeur" },
  { id: "tablet", label: "Tablette", width: "768px", tag: "768 px" },
  { id: "phone", label: "Téléphone", width: "375px", tag: "375 px" },
] as const;

type SaveStatus = { kind: "saved"; at: Date } | { kind: "saving" } | { kind: "error"; message: string };

interface ApiPage { page_id: string; version: number; status: "draft" | "published"; page: Page }
interface Crumb { tunnel: string; step: string; funnelSlug: string; stepSlug: string }

export function PageEditor({ pageId, secret }: { pageId: string; secret: string }) {
  const [state, setStateRaw] = useState<EditorState | null>(null);
  const stateRef = useRef<EditorState | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [preview, setPreview] = useState(false);
  const [save, setSave] = useState<SaveStatus>({ kind: "saved", at: new Date() });
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [crumb, setCrumb] = useState<Crumb | null>(null);
  const [search, setSearch] = useState("");
  const holdAutosave = useRef(false);
  const saving = useRef(false);
  const headers = { "x-admin-secret": secret, "content-type": "application/json" };

  const setState = useCallback((s: EditorState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  // Chargement
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/pages/${pageId}`, { headers });
        const body = await res.json();
        if (!alive) return;
        if (!res.ok) return setLoadError(res.status === 404 ? "Cette page n'existe pas (ou plus)." : "Impossible de charger la page.");
        const d = body.data as ApiPage;
        setStatus(d.status);
        setState(initState(d.page, d.version));
      } catch {
        if (alive) setLoadError("Connexion impossible. Réessaie dans un instant.");
      }
      try {
        const r = await fetch("/api/admin/tunnels", { headers });
        const tunnels = (await r.json()).data as { name: string; slug: string; steps: { page_id: string; slug: string; title: string }[] }[];
        for (const t of tunnels ?? []) {
          const i = t.steps.findIndex((s) => s.page_id === pageId);
          if (i >= 0 && alive) setCrumb({ tunnel: t.name, step: `Étape ${i + 1} : ${t.steps[i].title}`, funnelSlug: t.slug, stepSlug: t.steps[i].slug });
        }
      } catch {
        /* le fil d'Ariane est facultatif */
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, secret]);

  /** La version du serveur a changé (IA ou autre onglet) : on la charge sans écraser, et on reporte les modifications locales. */
  const adoptServer = useCallback((d: ApiPage, why: "conflict" | "poll") => {
    const cur = stateRef.current;
    if (!cur) return;
    const r = rebaseOnServer(cur, d.page, d.version);
    setState(r.state);
    setStatus(d.status);
    holdAutosave.current = r.hadLocalChanges && r.kept;
    setSave({ kind: "saved", at: new Date() });
    const origin = why === "conflict" ? "Ton IA (ou un autre onglet) a modifié cette page pendant que tu travaillais." : "Ton IA (ou un autre onglet) vient de modifier cette page.";
    setNotice(
      origin + " Sa version est rechargée, rien n'est écrasé." +
        (r.hadLocalChanges ? (r.kept ? " Tes modifications non enregistrées sont reportées dessus : vérifie puis clique sur Enregistrer." : " Tes modifications non enregistrées n'ont pas pu être reportées et ont été abandonnées.") : "")
    );
    if (selectedId && !findBlock(r.state.page, selectedId)) setSelectedId(null);
  }, [selectedId, setState]);

  const doSave = useCallback(async () => {
    const cur = stateRef.current;
    if (!cur || saving.current) return;
    let ops: Change[];
    try {
      ops = pendingOps(cur);
    } catch (e) {
      return setSave({ kind: "error", message: e instanceof Error ? e.message : "Conversion impossible" });
    }
    if (ops.length === 0) return setSave({ kind: "saved", at: new Date() });
    saving.current = true;
    holdAutosave.current = false;
    setSave({ kind: "saving" });
    const sent = cur.page;
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, { method: "PATCH", headers, body: JSON.stringify({ changes: ops, expected_version: cur.version }) });
      const body = await res.json();
      if (res.ok) {
        const next = markSaved(stateRef.current ?? cur, sent, body.data.version);
        setState(next);
        setSave({ kind: "saved", at: new Date() });
      } else if (res.status === 409 && body.current) {
        adoptServer(body.current as ApiPage, "conflict");
      } else {
        setSave({ kind: "error", message: body?.error?.message ?? "Enregistrement impossible" });
      }
    } catch {
      setSave({ kind: "error", message: "Connexion impossible" });
    } finally {
      saving.current = false;
    }
  }, [adoptServer, pageId, secret, setState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enregistrement automatique 1,5 s après la dernière modification (sauf juste après un rechargement forcé).
  const dirty = state ? isDirty(state) : false;
  useEffect(() => {
    if (!state || !dirty || holdAutosave.current) return;
    const t = setTimeout(() => void doSave(), 1500);
    return () => clearTimeout(t);
  }, [state, dirty, doSave]);

  // Ne pas perdre le travail à la fermeture.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (stateRef.current && isDirty(stateRef.current)) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  // Surveille les modifications venues d'ailleurs (IA).
  useEffect(() => {
    const t = setInterval(async () => {
      const cur = stateRef.current;
      if (!cur || saving.current) return;
      try {
        const res = await fetch(`/api/admin/pages/${pageId}`, { headers });
        if (!res.ok) return;
        const d = (await res.json()).data as ApiPage;
        if (d.version !== stateRef.current?.version) adoptServer(d, "poll");
      } catch {
        /* réessaie au prochain tour */
      }
    }, 8000);
    return () => clearInterval(t);
  }, [adoptServer, pageId, secret]); // eslint-disable-line react-hooks/exhaustive-deps

  // Édition : mêmes opérations que le serveur d'outils. Lève une erreur lisible si le format refuse la valeur.
  const onEdit = useCallback((changes: Change[], key?: string) => {
    const cur = stateRef.current;
    if (!cur) return;
    setState(edit(cur, changes, { key, now: Date.now() }));
    holdAutosave.current = false;
  }, [setState]);

  const doUndo = useCallback(() => stateRef.current && setState(undo(stateRef.current)), [setState]);
  const doRedo = useCallback(() => stateRef.current && setState(redo(stateRef.current)), [setState]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); doRedo(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [doUndo, doRedo]);

  if (loadError) return <div className="ed-root" style={{ placeItems: "center", display: "grid" }}><p role="alert">{loadError} <a href="/admin/tunnels" style={{ color: "#c4a4fe" }}>Retour aux tunnels</a></p></div>;
  if (!state) return <div className="ed-root" aria-busy="true" />;

  const page = state.page;
  const selected = selectedId ? (findBlock(page, selectedId)?.block ?? null) : null;
  const loc = selected ? locate(page, selected.id as string) : null;

  function addElement(type: BlockType) {
    const block = defaultBlock(type);
    let change: Change;
    if (selected && (selected.type === "section" || selected.type === "popup")) {
      const kids = (selected.children as Block[]) ?? [];
      change = { op: "add_block", block, parent_id: selected.id, after_id: kids[kids.length - 1]?.id };
    } else if (selected && loc) {
      change = { op: "add_block", block, parent_id: loc.parent_id, column: loc.column, after_id: selected.id };
    } else {
      change = { op: "add_block", block, after_id: page.blocks[page.blocks.length - 1]?.id };
    }
    onEdit([change]);
    setSelectedId(block.id as string);
  }

  function blockAction(a: BlockAction) {
    if (!selected || !loc) return;
    const id = selected.id as string;
    if (a === "delete") { onEdit([{ op: "remove_block", block_id: id }]); setSelectedId(null); }
    else if (a === "duplicate") {
      const copy = cloneWithNewIds(selected);
      onEdit([{ op: "add_block", block: copy as Record<string, unknown>, parent_id: loc.parent_id, column: loc.column, after_id: id }]);
      setSelectedId(copy.id as string);
    } else if (a === "up" && loc.index > 0) {
      onEdit([{ op: "move_block", block_id: id, parent_id: loc.parent_id, column: loc.column, after_id: loc.siblings[loc.index - 2]?.id }]);
    } else if (a === "down" && loc.index < loc.siblings.length - 1) {
      onEdit([{ op: "move_block", block_id: id, parent_id: loc.parent_id, column: loc.column, after_id: loc.siblings[loc.index + 1].id }]);
    }
  }

  const dev = DEVICES.find((d) => d.id === device)!;
  const filter = search.trim().toLowerCase();
  const saveLabel =
    save.kind === "saving" ? "Enregistrement..." :
    save.kind === "error" ? `Erreur : ${save.message}` :
    dirty ? "Modifications non enregistrées" :
    `Enregistré à ${save.at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

  return (
    <div className="ed-root">
      <header className="ed-top">
        <a className="ed-brand" href="/admin/tunnels" title="Retour aux tunnels">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-taskzen-512.png" alt="Taskzen" />
        </a>
        <div className="ed-crumb">
          <small>{crumb ? `Tunnel : ${crumb.tunnel}` : "Page"}</small>
          <strong>{page.title}{crumb && <span> / {crumb.step}</span>}</strong>
        </div>
        <div className="ed-sep" />
        <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Historique">
          <button className="ed-ib" title="Annuler (Ctrl+Z)" aria-label="Annuler" disabled={state.undo.length === 0} onClick={doUndo}>↶</button>
          <button className="ed-ib" title="Rétablir (Ctrl+Y)" aria-label="Rétablir" disabled={state.redo.length === 0} onClick={doRedo}>↷</button>
        </div>
        <div className={`ed-save ${dirty ? "dirty" : ""} ${save.kind === "error" ? "err" : ""}`} role="status" aria-live="polite"><i /> {saveLabel}</div>
        <div className="ed-devices" role="group" aria-label="Taille d'écran">
          {DEVICES.map((d) => <button key={d.id} className={d.id === device ? "on" : ""} aria-pressed={d.id === device} onClick={() => setDevice(d.id)}>{d.label}</button>)}
        </div>
        <button className={`ed-pill sec ${preview ? "on" : ""}`} aria-pressed={preview} onClick={() => setPreview((p) => !p)}>Aperçu</button>
        {status === "published" && crumb && <a className="ed-pill sec" href={`/p/${crumb.funnelSlug}/${crumb.stepSlug}`} target="_blank" rel="noreferrer">Page publiée</a>}
        <button className="ed-pill main" onClick={() => { holdAutosave.current = false; void doSave(); }} disabled={save.kind === "saving"}>Enregistrer</button>
      </header>

      <div>
        <div className="ed-ia" role="note"><b>IA</b> Cette page peut aussi être modifiée par ton IA : vous travaillez sur la même description de page.</div>
        {notice && <div className="ed-notice" role="alert">{notice}<button onClick={() => setNotice(null)}>Compris</button></div>}
      </div>

      <div className="ed-body">
        <aside className="ed-panel ed-left" aria-label="Éléments">
          <div className="ed-h">Éléments</div>
          <div className="ed-sub">Clique un élément pour l'ajouter après l'élément sélectionné (ou à la fin de la page).</div>
          <input className="ed-search" placeholder="Chercher un élément" aria-label="Chercher un élément" value={search} onChange={(e) => setSearch(e.target.value)} />
          {GROUPS.map((g, gi) => {
            const items = g.items.filter((i) => BLOCK_LABELS[i.type].toLowerCase().includes(filter));
            if (!items.length) return null;
            return (
              <div key={g.title}>
                <div className="ed-grp" style={gi === 0 ? { marginTop: 0 } : undefined}>{g.title}</div>
                <div className="ed-els">
                  {items.map((i) => <button key={i.type} className="ed-el" onClick={() => addElement(i.type)}><span>{i.icon}</span>{BLOCK_LABELS[i.type]}</button>)}
                </div>
              </div>
            );
          })}
          <div className="ed-tip">Annuler et rétablir gardent les {MAX_UNDO} dernières actions.</div>
        </aside>

        <main className="ed-stage" aria-label="Page en direct">
          <div className="ed-frame" style={{ maxWidth: dev.width }}>
            <div className="ed-chrome"><span>Page en direct, {dev.label.toLowerCase()}</span><em>{dev.tag}</em></div>
            <Canvas page={page} selectedId={selectedId} preview={preview} canUp={!!loc && loc.index > 0} canDown={!!loc && loc.index < loc.siblings.length - 1} onSelect={setSelectedId} onAction={blockAction} />
            <div className="ed-legend">{preview ? "Aperçu : les cadres de sélection sont masqués." : "Survole un élément pour voir son cadre, clique pour le régler."}</div>
          </div>
        </main>

        <aside className="ed-panel ed-right" aria-label="Réglages">
          <Inspector page={page} block={selected} onEdit={onEdit} />
        </aside>
      </div>
    </div>
  );
}
