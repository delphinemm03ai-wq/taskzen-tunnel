import { z } from "zod";
import { randomUUID } from "node:crypto";
import { Block, Page, PageInput, blockSchema, pageSchema, PAGE_FORMAT_VERSION, shareSchema, slugify } from "./schema";

export class PageError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export function childLists(b: Block): Block[][] {
  if (b.type === "columns") return (b.columns as Block[][]) ?? [];
  if (b.type === "section" || b.type === "popup") return [(b.children as Block[]) ?? []];
  return [];
}

/** Parcourt tous les blocs (y compris imbriqués) avec leur liste parente. */
export function walk(blocks: Block[], fn: (b: Block, siblings: Block[], index: number) => void) {
  blocks.forEach((b, i) => {
    fn(b, blocks, i);
    for (const child of childLists(b)) walk(child, fn);
  });
}

function shortId(): string {
  return "b" + randomUUID().replace(/-/g, "").slice(0, 8);
}

/** Donne un id stable à chaque bloc qui n'en a pas et vérifie l'unicité. */
export function assignIds(blocks: Block[]): Block[] {
  const seen = new Set<string>();
  walk(blocks, (b) => {
    if (!b.id) b.id = shortId();
    if (seen.has(b.id)) throw new PageError("duplicate_id", `Identifiant de bloc en double : ${b.id}`);
    seen.add(b.id);
  });
  return blocks;
}

export function newPage(id: string, input: PageInput): Page {
  const blocks = assignIds(structuredClone(input.blocks) as Block[]);
  return pageSchema.parse({
    format: PAGE_FORMAT_VERSION,
    id,
    title: input.title,
    slug: input.slug ?? slugify(input.title),
    share: input.share ?? {},
    blocks,
  });
}

export function findBlock(page: Page, id: string): { block: Block; siblings: Block[]; index: number } | null {
  let found: { block: Block; siblings: Block[]; index: number } | null = null;
  walk(page.blocks as Block[], (b, siblings, index) => {
    if (b.id === id) found = { block: b, siblings, index };
  });
  return found;
}

export function allBlockIds(page: Page): string[] {
  const ids: string[] = [];
  walk(page.blocks as Block[], (b) => ids.push(b.id as string));
  return ids;
}

/**
 * Modifications : on n'envoie que le changement (X5).
 * Ces opérations sont les mêmes pour l'IA (MCP) et pour l'éditeur (interface web), ce qui garantit le format unique (X7).
 */
const changeSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_title"), title: z.string().min(1).max(200) }).strict(),
  z.object({ op: z.literal("set_share"), share: shareSchema }).strict(),
  z.object({ op: z.literal("set_props"), block_id: z.string(), props: z.record(z.unknown()) }).strict(),
  z
    .object({
      op: z.literal("add_block"),
      block: z.record(z.unknown()),
      after_id: z.string().optional(),
      parent_id: z.string().optional(),
      column: z.number().int().min(0).max(3).optional(),
    })
    .strict(),
  z.object({ op: z.literal("remove_block"), block_id: z.string() }).strict(),
  z
    .object({
      op: z.literal("move_block"),
      block_id: z.string(),
      after_id: z.string().optional(),
      parent_id: z.string().optional(),
      column: z.number().int().min(0).max(3).optional(),
    })
    .strict(),
]);
export const changesSchema = z.array(changeSchema).min(1).max(100);
export type Change = z.infer<typeof changeSchema>;

function listFor(page: Page, parent_id: string | undefined, column: number | undefined): Block[] {
  if (!parent_id) return page.blocks as Block[];
  const p = findBlock(page, parent_id);
  if (!p) throw new PageError("block_not_found", `Bloc parent introuvable : ${parent_id}`);
  if (p.block.type === "columns") {
    const cols = p.block.columns as Block[][];
    const c = column ?? 0;
    if (!cols[c]) throw new PageError("bad_column", `Colonne ${c} inexistante`);
    return cols[c];
  }
  if (p.block.type === "section" || p.block.type === "popup") return p.block.children as Block[];
  throw new PageError("not_a_container", `Le bloc ${parent_id} ne peut pas contenir d'autres blocs`);
}

function insert(list: Block[], block: Block, after_id?: string) {
  if (!after_id) return void list.unshift(block);
  const i = list.findIndex((b) => b.id === after_id);
  if (i < 0) throw new PageError("block_not_found", `Bloc introuvable dans cette liste : ${after_id}`);
  list.splice(i + 1, 0, block);
}

/** Applique les changements sur une copie ; la page entière est revalidée. */
export function applyChanges(page: Page, rawChanges: unknown): { page: Page; applied: number } {
  const changes = changesSchema.parse(rawChanges);
  const next = structuredClone(page) as Page;
  for (const c of changes) {
    switch (c.op) {
      case "set_title":
        next.title = c.title;
        break;
      case "set_share":
        next.share = { ...next.share, ...c.share };
        break;
      case "set_props": {
        const f = findBlock(next, c.block_id);
        if (!f) throw new PageError("block_not_found", `Bloc introuvable : ${c.block_id}`);
        if ("id" in c.props || "type" in c.props) throw new PageError("immutable", "id et type d'un bloc ne se modifient pas");
        Object.assign(f.block, c.props);
        break;
      }
      case "add_block": {
        const block = structuredClone(c.block) as Block;
        const parsed = blockSchema.safeParse(block);
        if (!parsed.success) throw new PageError("invalid_block", parsed.error.issues[0]?.message ?? "Bloc invalide");
        assignIds([block]);
        const existing = new Set(allBlockIds(next));
        walk([block], (b) => {
          if (existing.has(b.id as string)) throw new PageError("duplicate_id", `Identifiant déjà utilisé : ${b.id}`);
        });
        insert(listFor(next, c.parent_id, c.column), block, c.after_id);
        break;
      }
      case "remove_block": {
        const f = findBlock(next, c.block_id);
        if (!f) throw new PageError("block_not_found", `Bloc introuvable : ${c.block_id}`);
        f.siblings.splice(f.index, 1);
        break;
      }
      case "move_block": {
        const f = findBlock(next, c.block_id);
        if (!f) throw new PageError("block_not_found", `Bloc introuvable : ${c.block_id}`);
        if (c.parent_id && findBlock({ ...next, blocks: [f.block] } as Page, c.parent_id)) {
          throw new PageError("bad_move", "Un bloc ne peut pas être déplacé dans lui-même");
        }
        f.siblings.splice(f.index, 1);
        insert(listFor(next, c.parent_id, c.column), f.block, c.after_id);
        break;
      }
    }
  }
  const validated = pageSchema.parse(next);
  assignIds(validated.blocks as Block[]);
  return { page: validated, applied: changes.length };
}

/** Liens de sortie des blocs (vérification des liens entre étapes). */
export function collectLinks(page: Page): string[] {
  const links: string[] = [];
  walk(page.blocks as Block[], (b) => {
    for (const k of ["href", "next_step", "expired_redirect"]) {
      const v = b[k];
      if (typeof v === "string") links.push(v);
    }
  });
  return links;
}

/** Prix demandés par les boutons de paiement, par produit (utile pour détecter un changement de prix, X6). */
export function collectPrices(page: Page): Record<string, number> {
  const prices: Record<string, number> = {};
  walk(page.blocks as Block[], (b) => {
    if (b.type === "payment_button") prices[`${b.product}`] = b.price_cents as number;
  });
  return prices;
}
