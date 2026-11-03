"use client";

import { useEffect, useState } from "react";
import type { Block, Page } from "@/lib/page-format/schema";
import type { Change } from "@/lib/page-format/ops";
import { BLOCK_LABELS } from "@/lib/editor/tree";

type OnEdit = (changes: Change[], key?: string) => void;

/** Applique une valeur ; si le format la refuse, le message d'erreur s'affiche sous le champ. */
function useTry(onEdit: OnEdit) {
  const [error, setError] = useState<string | null>(null);
  return {
    error,
    run(changes: Change[], key?: string) {
      try {
        onEdit(changes, key);
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Valeur refusée";
        // les messages du format sont déjà en français ; zod renvoie parfois du JSON, on garde la première phrase lisible
        try {
          const parsed = JSON.parse(msg);
          setError(String(parsed[0]?.message ?? "Valeur refusée"));
        } catch {
          setError(msg);
        }
      }
    },
  };
}

function Field({ label, hint, value, onValue, textarea, optional, type = "text", error }: {
  label: string; hint?: string; value: string; onValue: (v: string) => void; textarea?: boolean; optional?: boolean; type?: string; error?: string | null;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const id = `ed-f-${label.replace(/\W+/g, "-")}`;
  const props = {
    id, className: `ed-in${error ? " bad" : ""}`, value: draft, "aria-invalid": error ? true : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => {
      setDraft(e.target.value);
      onValue(e.target.value);
    },
  };
  return (
    <div className="ed-f">
      <label htmlFor={id}>{label}{optional ? " (facultatif)" : ""}</label>
      {textarea ? <textarea {...props} rows={4} /> : <input {...props} type={type} />}
      {hint && <div className="ed-hint">{hint}</div>}
      {error && <div className="ed-err" role="alert">{error}</div>}
    </div>
  );
}

const COLORS = [
  { v: null, label: "Par défaut", bg: "linear-gradient(135deg,#8a55e0,#6a3fc0)" },
  { v: "#131428", label: "Indigo", bg: "#131428" },
  { v: "#ffffff", label: "Blanc", bg: "#ffffff" },
  { v: "#b58bf9", label: "Lavande", bg: "#b58bf9" },
  { v: "#7d51d2", label: "Violet", bg: "#7d51d2" },
];

function Seg<T extends string | number | null>({ value, options, onPick, label }: { value: T; options: { v: T; label: string }[]; onPick: (v: T) => void; label: string }) {
  return (
    <div className="ed-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" className={o.v === value ? "on" : ""} aria-pressed={o.v === value} onClick={() => onPick(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

function BlockFields({ block, onEdit }: { block: Block; onEdit: OnEdit }) {
  const { error, run } = useTry(onEdit);
  const id = block.id as string;
  const set = (prop: string, value: unknown, typing = true) => run([{ op: "set_props", block_id: id, props: { [prop]: value } }], typing ? `${id}:${prop}` : undefined);
  const str = (k: string) => String(block[k] ?? "");
  const text = (k: string, label: string, o: { optional?: boolean; textarea?: boolean; hint?: string } = {}) => (
    <Field key={k} label={label} value={str(k)} textarea={o.textarea} optional={o.optional} hint={o.hint} error={error} onValue={(v) => set(k, o.optional && v === "" ? null : v)} />
  );
  switch (block.type) {
    case "heading":
      return <>{text("text", "Texte du titre")}<div className="ed-f"><label>Niveau</label><Seg label="Niveau" value={Number(block.level)} options={[{ v: 1, label: "Grand" }, { v: 2, label: "Moyen" }, { v: 3, label: "Petit" }]} onPick={(v) => set("level", v, false)} /></div></>;
    case "text":
      return text("text", "Texte", { textarea: true, hint: "Une ligne vide sépare deux paragraphes." });
    case "list":
      return (
        <>
          <Field label="Points de la liste" textarea value={((block.items as string[]) ?? []).join("\n")} error={error} hint="Un point par ligne." onValue={(v) => set("items", v.split("\n").filter((l) => l.trim() !== ""))} />
          <label className="ed-check"><input type="checkbox" checked={Boolean(block.ordered)} onChange={(e) => set("ordered", e.target.checked, false)} /> Liste numérotée</label>
        </>
      );
    case "image":
      return <>{text("src", "Adresse de l'image", { hint: "Adresse https." })}{text("alt", "Description (accessibilité)")}</>;
    case "video":
      return <>{text("src", "Adresse de la vidéo", { hint: "Adresse d'intégration https (YouTube, Vimeo...)." })}{text("title", "Titre", { optional: true })}</>;
    case "button":
      return <>{text("label", "Texte du bouton")}{text("href", "Lien", { hint: "Adresse https, chemin /p/..., ancre #... ou mailto:." })}</>;
    case "divider":
      return <div className="ed-empty-sel">Ce séparateur n'a pas de réglage propre.</div>;
    case "columns":
      return <div className="ed-empty-sel">Clique un élément dans une colonne pour le modifier. Les nouveaux éléments s'ajoutent après l'élément sélectionné, dans sa colonne.</div>;
    case "section":
      return text("title", "Titre de la section", { optional: true });
    case "signup_form":
      return (
        <>
          {text("label", "Texte du bouton")}
          <label className="ed-check"><input type="checkbox" checked={((block.fields as string[]) ?? []).includes("first_name")} onChange={(e) => set("fields", e.target.checked ? ["email", "first_name"] : ["email"], false)} /> Demander le prénom</label>
          {text("tag", "Étiquette posée à l'inscription", { optional: true })}
          {text("next_step", "Page ensuite", { optional: true, hint: "Chemin /p/... ou adresse https." })}
        </>
      );
    case "payment_button":
      return (
        <>
          {text("label", "Texte du bouton")}
          {text("product", "Identifiant du produit", { hint: "Lettres minuscules, chiffres, - et _." })}
          <Field label="Prix affiché (en euros)" type="number" value={String((Number(block.price_cents) || 0) / 100)} error={error} onValue={(v) => set("price_cents", Math.round(Number(v) * 100))} hint="Affichage seulement : le prix réellement encaissé vient de la configuration du produit." />
        </>
      );
    case "testimonials":
    case "faq": {
      const [a, b, la, lb] = block.type === "faq" ? ["question", "answer", "Question", "Réponse"] : ["quote", "author", "Témoignage", "Auteur"];
      const items = (block.items as Record<string, string>[]) ?? [];
      const setItems = (next: Record<string, string>[]) => set("items", next, false);
      return (
        <>
          {items.map((it, i) => (
            <div className="ed-pair" key={i}>
              <Field label={`${la} ${i + 1}`} textarea value={it[a] ?? ""} error={error} onValue={(v) => set("items", items.map((x, j) => (j === i ? { ...x, [a]: v } : x)))} />
              <Field label={lb} value={it[b] ?? ""} onValue={(v) => set("items", items.map((x, j) => (j === i ? { ...x, [b]: v } : x)))} />
              {items.length > 1 && <button type="button" className="ed-mini" onClick={() => setItems(items.filter((_, j) => j !== i))}>Retirer</button>}
            </div>
          ))}
          <button type="button" className="ed-mini" onClick={() => setItems([...items, { [a]: "", [b]: "" }])}>+ Ajouter</button>
          {block.type === "testimonials" && <div className="ed-hint">Ne mets que de vrais témoignages de clients.</div>}
        </>
      );
    }
    case "timer":
      return (
        <>
          <Field label="Date de fin" type="datetime-local" value={String(block.ends_at ?? "").slice(0, 16)} error={error} onValue={(v) => v && set("ends_at", new Date(v).toISOString().replace(/\.\d+Z$/, "Z"))} hint="Date fixe, la même pour tous les visiteurs." />
          {text("expired_redirect", "Rediriger à l'échéance vers", { optional: true, hint: "Chemin /p/... ou adresse https." })}
        </>
      );
    case "popup":
      return <>{text("trigger_label", "Texte du bouton d'ouverture")}{text("title", "Titre du pop-up")}</>;
    default:
      return null;
  }
}

function SettingsFields({ block, onEdit }: { block: Block; onEdit: OnEdit }) {
  const id = block.id as string;
  const s = block.settings ?? {};
  const put = (patch: Record<string, string | null>) => {
    const next: Record<string, string> = { ...(s as Record<string, string>) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete next[k];
      else next[k] = v;
    }
    onEdit([{ op: "set_props", block_id: id, props: { settings: Object.keys(next).length ? next : null } }]);
  };
  return (
    <>
      <div className="ed-f"><label>Alignement</label>
        <Seg label="Alignement" value={(s.align ?? null) as string | null} options={[{ v: null, label: "Auto" }, { v: "left", label: "Gauche" }, { v: "center", label: "Centre" }, { v: "right", label: "Droite" }]} onPick={(v) => put({ align: v })} />
      </div>
      <div className="ed-f"><label>Couleur du texte</label>
        <div className="ed-sw">
          {COLORS.map((c) => (
            <button key={c.label} type="button" title={c.label} aria-label={c.label} className={(s.color ?? null) === c.v ? "on" : ""} style={{ background: c.bg }} onClick={() => put({ color: c.v })} />
          ))}
        </div>
      </div>
      <div className="ed-f"><label>Espacement autour</label>
        <Seg label="Espacement" value={(s.spacing ?? null) as string | null} options={[{ v: null, label: "Auto" }, { v: "none", label: "Aucun" }, { v: "s", label: "S" }, { v: "m", label: "M" }, { v: "l", label: "L" }, { v: "xl", label: "XL" }]} onPick={(v) => put({ spacing: v })} />
      </div>
    </>
  );
}

/** Réglages de l'élément sélectionné, puis réglages de la page empilés dessous (choix de conception n°4). */
export function Inspector({ page, block, onEdit }: { page: Page; block: Block | null; onEdit: OnEdit }) {
  const share = page.share;
  const shareErr = useTry(onEdit);
  const setShare = (k: "title" | "description" | "image", v: string) => shareErr.run([{ op: "set_share", share: { [k]: v === "" ? null : v } }], `share:${k}`);
  return (
    <>
      <section className="ed-set" aria-label="Réglages de l'élément">
        <div className="ed-pagehd"><h3>{block ? BLOCK_LABELS[block.type] : "Élément"}</h3>{block && <span className="ed-tag">Sélectionné</span>}</div>
        {block ? (
          <>
            <BlockFields key={block.id} block={block} onEdit={onEdit} />
            <SettingsFields key={`s-${block.id}`} block={block} onEdit={onEdit} />
          </>
        ) : (
          <div className="ed-empty-sel" style={{ marginTop: 10 }}>Clique un élément sur la page pour régler son texte, son lien, sa couleur, son alignement et son espacement.</div>
        )}
      </section>
      <section className="ed-set" aria-label="Réglages de la page">
        <div className="ed-pagehd"><h3>Réglages de la page</h3><span className="ed-tag">Page</span></div>
        <PageTitle value={page.title} onEdit={onEdit} />
        <Field label="Titre de partage" optional value={share.title ?? ""} error={shareErr.error} onValue={(v) => shareErr.run([{ op: "set_share", share: { title: v === "" ? null : v } }], "share:title")} hint="Sans choix de ta part, on prend le titre de la page." />
        <Field label="Texte de partage" optional textarea value={share.description ?? ""} onValue={(v) => setShare("description", v)} />
        <Field label="Image de partage" optional value={share.image ?? ""} error={shareErr.error} onValue={(v) => shareErr.run([{ op: "set_share", share: { image: v === "" ? null : v } }], "share:image")} hint="Adresse https. Sans choix, la première image de la page est utilisée." />
      </section>
    </>
  );
}

function PageTitle({ value, onEdit }: { value: string; onEdit: OnEdit }) {
  const { error, run } = useTry(onEdit);
  return <Field label="Titre de la page" value={value} error={error} onValue={(v) => v.trim() && run([{ op: "set_title", title: v }], "title")} />;
}
