import type { Block, Page } from "@/lib/page-format/schema";
import { applyChanges, childLists, PageError, walk, type Change } from "@/lib/page-format/ops";

/**
 * Conversion « édition vers opérations » : compare la page enregistrée et la page éditée,
 * et produit uniquement les opérations du serveur d'outils (X5 : seul le changement part).
 * Le résultat est vérifié : rejouer les opérations sur l'ancienne page doit redonner exactement la nouvelle.
 */

type Props = Record<string, unknown>;
const STRUCTURAL = new Set(["id", "type", "children", "columns"]);

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export function samePage(a: Page, b: Page): boolean {
  return stable(a) === stable(b);
}

interface ListRef {
  parent_id?: string;
  column?: number;
  blocks: Block[];
}

/** Toutes les listes de blocs d'une page (racine, sections, pop-up, colonnes), de haut en bas. */
function lists(blocks: Block[]): ListRef[] {
  const out: ListRef[] = [{ blocks }];
  const visit = (list: Block[]) => {
    for (const b of list) {
      childLists(b).forEach((l, ci) => {
        out.push({ parent_id: b.id, column: b.type === "columns" ? ci : undefined, blocks: l });
      });
    }
    for (const b of list) for (const l of childLists(b)) visit(l);
  };
  visit(blocks);
  return out;
}

function index(page: Page) {
  const map = new Map<string, Block>();
  const parent = new Map<string, string | undefined>();
  walk(page.blocks as Block[], (b) => map.set(b.id as string, b));
  for (const l of lists(page.blocks as Block[])) for (const b of l.blocks) parent.set(b.id as string, l.parent_id);
  return { map, parent };
}

/** Copie du bloc sans les descendants déjà présents dans l'ancienne page (ils seront déplacés ensuite). */
function stripKept(block: Block, kept: (id: string) => boolean): Block {
  const copy = structuredClone(block) as Block;
  const prune = (b: Block) => {
    if (b.type === "columns") b.columns = (b.columns as Block[][]).map((col) => col.filter((c) => !kept(c.id as string)).map((c) => (prune(c), c)));
    if (b.type === "section" || b.type === "popup") b.children = (b.children as Block[]).filter((c) => !kept(c.id as string)).map((c) => (prune(c), c));
  };
  prune(copy);
  return copy;
}

function ids(list: Block[]): string[] {
  return list.map((b) => b.id as string);
}

function listOf(page: Page, parent_id: string | undefined, column: number | undefined): Block[] {
  if (!parent_id) return page.blocks as Block[];
  const ref = lists(page.blocks as Block[]).find((l) => l.parent_id === parent_id && l.column === column);
  return ref?.blocks ?? [];
}

export class DiffError extends PageError {
  constructor(message: string) {
    super("diff_unsupported", message);
  }
}

export function diffPages(oldPage: Page, newPage: Page): Change[] {
  const ops: Change[] = [];
  let working = oldPage;
  const run = (op: Change) => {
    working = applyChanges(working, [op]).page;
    ops.push(op);
  };
  if (oldPage.title !== newPage.title) run({ op: "set_title", title: newPage.title });

  const shareOps: Record<string, string | null> = {};
  for (const k of ["title", "description", "image"] as const) {
    const a = oldPage.share[k];
    const b = newPage.share[k];
    if (a !== b) shareOps[k] = b === undefined ? null : b;
  }
  if (Object.keys(shareOps).length) run({ op: "set_share", share: shareOps });

  const o = index(oldPage);
  const n = index(newPage);

  // A. Ajouts : un bloc nouveau dont le parent existe déjà. Sa position exacte est réglée à l'étape B.
  for (const l of lists(newPage.blocks as Block[])) {
    for (const b of l.blocks) {
      if (o.map.has(b.id as string)) continue;
      if (l.parent_id && !o.map.has(l.parent_id)) continue; // ajouté avec son parent
      run({ op: "add_block", block: stripKept(b, (id) => o.map.has(id)) as Record<string, unknown>, parent_id: l.parent_id, column: l.column });
    }
  }

  // B. Ordre et parents : on remet chaque liste dans l'ordre voulu, de haut en bas.
  for (const l of lists(newPage.blocks as Block[])) {
    const want = ids(l.blocks);
    for (let i = 0; i < want.length; i++) {
      const have = ids(listOf(working, l.parent_id, l.column)).filter((id) => n.map.has(id));
      if (have[i] === want[i]) continue;
      run({ op: "move_block", block_id: want[i], after_id: i > 0 ? want[i - 1] : undefined, parent_id: l.parent_id, column: l.column });
    }
  }

  // C. Réglages d'un bloc conservé : seulement les propriétés qui changent.
  for (const [id, nb] of n.map) {
    const ob = o.map.get(id);
    if (!ob) continue;
    if (ob.type !== nb.type) throw new DiffError(`Le type du bloc ${id} ne peut pas changer.`);
    if (ob.type === "columns" && (ob.columns as Block[][]).length !== (nb.columns as Block[][]).length) {
      throw new DiffError("Changer le nombre de colonnes n'est pas pris en charge.");
    }
    const props: Props = {};
    for (const k of new Set([...Object.keys(ob), ...Object.keys(nb)])) {
      if (STRUCTURAL.has(k)) continue;
      const a = (ob as Props)[k];
      const b = (nb as Props)[k];
      if (stable(a) !== stable(b)) props[k] = b === undefined ? null : b;
    }
    if (Object.keys(props).length) run({ op: "set_props", block_id: id, props });
  }

  // D. Suppressions : les blocs disparus dont le parent n'a pas disparu aussi.
  for (const id of o.map.keys()) {
    if (n.map.has(id)) continue;
    const p = o.parent.get(id);
    if (p && !n.map.has(p)) continue;
    run({ op: "remove_block", block_id: id });
  }

  // Contrôle : rejouer les opérations doit redonner exactement la page éditée.
  if (!samePage(working, newPage)) throw new DiffError("Les changements n'ont pas pu être convertis en opérations.");
  return ops;
}

/** Rejoue des opérations locales sur la version du serveur. Retourne null si elles ne s'appliquent plus. */
export function rebaseOps(serverPage: Page, ops: Change[]): Page | null {
  if (ops.length === 0) return serverPage;
  try {
    return applyChanges(serverPage, ops).page;
  } catch {
    return null;
  }
}
