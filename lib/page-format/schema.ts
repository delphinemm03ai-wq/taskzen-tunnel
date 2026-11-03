import { z } from "zod";

/**
 * Format de page Taskzen Tunnel (version 1).
 * Une page = une description structurée (JSON). Le serveur la rend en HTML.
 * Aucun HTML n'est accepté en entrée (sauf futur bloc de code libre, hors lot 1).
 */
export const PAGE_FORMAT_VERSION = 1;

const text = (max: number) => z.string().max(max);
/** Lien interne ("/p/..." ou "#ancre") ou https. Refuse javascript: et data:. */
export const safeLink = z
  .string()
  .max(2048)
  .refine(
    (v) => /^(https:\/\/|\/|#|mailto:)/.test(v) || v === "@next" || /^@step:[a-z0-9-]{1,60}$/.test(v),
    "Lien invalide : https, chemin interne, ancre, mailto, @next ou @step:slug uniquement"
  );
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #rrggbb");

export const settingsSchema = z
  .object({
    align: z.enum(["left", "center", "right"]).optional(),
    color: color.optional(),
    spacing: z.enum(["none", "s", "m", "l", "xl"]).optional(),
  })
  .strict();

const idField = z.string().regex(/^[a-z0-9_-]{1,40}$/, "id : minuscules, chiffres, - et _");

const base = { id: idField.optional(), settings: settingsSchema.optional() };

export const BLOCK_TYPES = [
  "heading", "text", "list", "image", "video", "button", "divider",
  "columns", "section", "signup_form", "payment_button", "testimonials",
  "faq", "timer", "popup",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export type Block = {
  id?: string;
  type: BlockType;
  settings?: z.infer<typeof settingsSchema>;
  [key: string]: unknown;
};

// Les blocs conteneurs sont récursifs : on type le schéma à la main.
export const blockSchema: z.ZodType<Block> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ ...base, type: z.literal("heading"), text: text(300), level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2) }).strict(),
    z.object({ ...base, type: z.literal("text"), text: text(5000) }).strict(),
    z.object({ ...base, type: z.literal("list"), items: z.array(text(300)).min(1).max(50), ordered: z.boolean().default(false) }).strict(),
    z.object({ ...base, type: z.literal("image"), src: safeLink, alt: text(300) }).strict(),
    z.object({ ...base, type: z.literal("video"), src: z.string().url().startsWith("https://"), title: text(200).optional() }).strict(),
    z.object({ ...base, type: z.literal("button"), label: text(80), href: safeLink }).strict(),
    z.object({ ...base, type: z.literal("divider") }).strict(),
    z.object({ ...base, type: z.literal("columns"), columns: z.array(z.array(blockSchema).max(30)).min(2).max(4) }).strict(),
    z.object({ ...base, type: z.literal("section"), title: text(200).optional(), children: z.array(blockSchema).max(50) }).strict(),
    z.object({
      ...base, type: z.literal("signup_form"), label: text(80).default("Je m'inscris"),
      fields: z.array(z.enum(["email", "first_name"])).min(1).default(["email"]),
      tag: text(60).optional(), next_step: safeLink.optional(),
    }).strict(),
    z.object({
      ...base, type: z.literal("payment_button"), label: text(80), product: idField,
      price_cents: z.number().int().min(0).max(10_000_000), currency: z.literal("EUR").default("EUR"),
    }).strict(),
    z.object({ ...base, type: z.literal("testimonials"), items: z.array(z.object({ quote: text(600), author: text(120) }).strict()).min(1).max(20) }).strict(),
    z.object({ ...base, type: z.literal("faq"), items: z.array(z.object({ question: text(300), answer: text(2000) }).strict()).min(1).max(30) }).strict(),
    z.object({ ...base, type: z.literal("timer"), mode: z.literal("fixed_date"), ends_at: z.string().datetime(), expired_redirect: safeLink.optional() }).strict(),
    z.object({
      ...base, type: z.literal("popup"), trigger_label: text(80), title: text(200), children: z.array(blockSchema).max(20),
    }).strict(),
  ]) as unknown as z.ZodType<Block>
);

export const shareSchema = z
  .object({ title: text(120).optional(), description: text(300).optional(), image: safeLink.optional() })
  .strict();

export const pageSchema = z
  .object({
    format: z.literal(PAGE_FORMAT_VERSION),
    id: idField,
    title: text(200).min(1),
    slug: z.string().regex(/^[a-z0-9-]{1,60}$/, "slug : minuscules, chiffres et -"),
    share: shareSchema.default({}),
    blocks: z.array(blockSchema).max(200),
  })
  .strict();

export type Page = z.infer<typeof pageSchema>;

/** Contenu fourni par l'IA ou l'éditeur pour créer une page (sans id de page ni version de format). */
export const pageInputSchema = z
  .object({
    title: text(200).min(1),
    slug: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(),
    share: shareSchema.optional(),
    blocks: z.array(blockSchema).max(200),
  })
  .strict();
export type PageInput = z.infer<typeof pageInputSchema>;

export function slugify(s: string): string {
  return (
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "page"
  );
}
