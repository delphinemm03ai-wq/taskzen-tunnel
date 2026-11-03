import { z } from "zod";
import {
  Block, Page, blockSchema, pageInputSchema, safeLink, shareSchema, slugify,
} from "@/lib/page-format/schema";
import { PageError, applyChanges, changesSchema, collectPrices, newPage, walk } from "@/lib/page-format/ops";
import type { FunnelRecord, FunnelStep, PageRecord, SequenceRecord, Store } from "@/lib/store/store";

/** Port d'envoi d'email. L'implémentation réelle (Resend) se branche ici ; aucune n'est faite au lot 1. */
export interface Mailer {
  send(msg: { to: string; subject: string; body: string }): Promise<void>;
}
export class NotConfiguredMailer implements Mailer {
  async send(): Promise<void> {
    throw new ToolError("email_not_configured", "Aucun service d'envoi d'email n'est connecté à ce compte.");
  }
}

export class ToolError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

export interface ToolContext {
  store: Store;
  mailer: Mailer;
  baseUrl: string;
}

/** Réponse standard d'une action sensible refusée faute de confirmation (X6). */
export function refusal(action: string, reason: string, howToConfirm: string) {
  return { refused: true as const, action, reason, how_to_confirm: howToConfirm };
}

const id = z.string().min(1).max(60);

// ---------- Schémas d'entrée ----------

const stepInput = z
  .object({
    title: z.string().min(1).max(200),
    slug: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(),
    kind: z.enum(["capture", "sales", "order", "thanks", "other"]).default("other"),
    share: shareSchema.optional(),
    blocks: z.array(blockSchema).max(200),
  })
  .strict();

const sequenceInput = z
  .object({
    name: z.string().min(1).max(120),
    trigger: z
      .object({
        type: z.enum(["signup", "purchase", "tag_added", "date"]),
        tag: z.string().max(60).optional(),
        date: z.string().datetime().optional(),
      })
      .strict(),
    emails: z
      .array(
        z
          .object({
            delay_hours: z.number().int().min(0).max(24 * 365),
            subject: z.string().min(1).max(200),
            body: z.string().min(1).max(10000),
          })
          .strict()
      )
      .min(1)
      .max(30),
  })
  .strict();

export const schemas = {
  create_page: pageInputSchema,
  update_page: z.object({ page_id: id, expected_version: z.number().int().optional(), changes: changesSchema }).strict(),
  get_page: z.object({ page_id: id }).strict(),
  publish_page: z.object({ page_id: id, confirm: z.boolean().optional() }).strict(),
  delete_page: z.object({ page_id: id, confirm: z.boolean().optional() }).strict(),
  create_funnel: z
    .object({
      name: z.string().min(1).max(120),
      slug: z.string().regex(/^[a-z0-9-]{1,60}$/).optional(),
      steps: z.array(stepInput).min(1).max(12),
      email_sequence: sequenceInput.optional(),
    })
    .strict(),
  publish_funnel: z.object({ funnel_id: id, confirm: z.boolean().optional() }).strict(),
  schedule_email_sequence: sequenceInput,
  send_email_to_list: z
    .object({
      tag: z.string().max(60).optional(),
      subject: z.string().min(1).max(200),
      body: z.string().min(1).max(10000),
      confirm: z.object({ test_reviewed: z.boolean(), recipients_consent: z.boolean() }).partial().optional(),
    })
    .strict(),
};

export type ToolName = keyof typeof schemas;

export const TOOL_META: Record<ToolName, { description: string; write: boolean }> = {
  create_page: { description: "Crée une page à partir d'une description structurée (liste de blocs, sans HTML). Renvoie l'id et l'adresse.", write: true },
  update_page: { description: "Modifie une page en n'envoyant que les changements (set_title, set_share, set_props, add_block, remove_block, move_block). Renvoie la version.", write: true },
  get_page: { description: "Lit la description complète d'une page.", write: false },
  publish_page: { description: "Publie une page. Un changement de prix d'un bouton de paiement demande confirm:true.", write: true },
  delete_page: { description: "Supprime une page. Action sensible : demande confirm:true.", write: true },
  create_funnel: { description: "Crée un tunnel complet (toutes les étapes et leurs pages, séquence d'emails facultative) en UN appel. Liens entre étapes : \"@next\" ou \"@step:slug\".", write: true },
  publish_funnel: { description: "Publie toutes les pages d'un tunnel.", write: true },
  schedule_email_sequence: { description: "Programme une séquence complète d'emails en UN appel (déclencheur, puis emails avec délai en heures après le précédent).", write: true },
  send_email_to_list: { description: "Envoie un email réel à une liste. Action sensible : exige confirm.test_reviewed et confirm.recipients_consent à true.", write: true },
};

// ---------- Outils ----------

function resolveLinks(blocks: Block[], stepSlugs: string[], index: number, urlFor: (slug: string) => string | null) {
  walk(blocks, (b) => {
    for (const k of ["href", "next_step", "expired_redirect"]) {
      const v = b[k];
      if (typeof v !== "string" || !v.startsWith("@")) continue;
      let target: string | null = null;
      if (v === "@next") target = index + 1 < stepSlugs.length ? urlFor(stepSlugs[index + 1]) : null;
      else target = urlFor(v.slice("@step:".length));
      if (!target) throw new ToolError("unresolved_link", `Lien « ${v} » sans étape correspondante (bloc ${b.id ?? b.type}).`);
      b[k] = target;
    }
  });
}

function assertNoPlaceholders(blocks: Block[]) {
  walk(blocks, (b) => {
    for (const k of ["href", "next_step", "expired_redirect"]) {
      const v = b[k];
      if (typeof v === "string" && v.startsWith("@")) {
        throw new ToolError("unresolved_link", `Les liens « @next » et « @step: » n'existent que dans create_funnel (bloc ${b.id ?? b.type}).`);
      }
    }
  });
}

async function uniqueFunnelSlug(ctx: ToolContext, wanted: string): Promise<string> {
  let slug = wanted;
  let n = 2;
  while (await ctx.store.findFunnelBySlug(slug)) slug = `${wanted}-${n++}`;
  return slug;
}

const pageUrl = (ctx: ToolContext, funnelSlug: string, stepSlug: string) => `${ctx.baseUrl}/p/${funnelSlug}/${stepSlug}`;

async function loadPage(ctx: ToolContext, pageId: string): Promise<PageRecord> {
  const rec = await ctx.store.getPage(pageId);
  if (!rec) throw new ToolError("page_not_found", `Page introuvable : ${pageId}`);
  return rec;
}

function sequenceRecord(ctx: ToolContext, input: z.infer<typeof sequenceInput>): SequenceRecord {
  if (input.trigger.type === "tag_added" && !input.trigger.tag) throw new ToolError("invalid_trigger", "Le déclencheur tag_added demande un champ tag.");
  if (input.trigger.type === "date" && !input.trigger.date) throw new ToolError("invalid_trigger", "Le déclencheur date demande un champ date.");
  return {
    id: ctx.store.newId("seq"),
    name: input.name,
    trigger: input.trigger,
    emails: input.emails.map((e) => ({ id: ctx.store.newId("em"), ...e })),
    exit_on: ["purchase", "unsubscribe"],
    status: "scheduled",
  };
}

export const handlers: { [K in ToolName]: (ctx: ToolContext, args: z.infer<(typeof schemas)[K]>) => Promise<unknown> } = {
  async create_page(ctx, args) {
    assertNoPlaceholders(args.blocks as Block[]);
    const pageId = ctx.store.newId("pg");
    const page = newPage(pageId, args);
    await ctx.store.putPage(pageId, { page, version: 1, status: "draft", published: null, updatedAt: new Date().toISOString() });
    return { page_id: pageId, version: 1, status: "draft" };
  },

  async update_page(ctx, args) {
    const rec = await loadPage(ctx, args.page_id);
    if (args.expected_version !== undefined && args.expected_version !== rec.version) {
      throw new ToolError("version_conflict", `La page est en version ${rec.version}, tu attendais la ${args.expected_version}. Relis-la avec get_page.`);
    }
    const { page, applied } = applyChanges(rec.page, args.changes);
    assertNoPlaceholders(page.blocks as Block[]);
    rec.page = page;
    rec.version += 1;
    rec.updatedAt = new Date().toISOString();
    await ctx.store.putPage(args.page_id, rec);
    return { page_id: args.page_id, version: rec.version, applied };
  },

  async get_page(ctx, args) {
    const rec = await loadPage(ctx, args.page_id);
    return { page_id: args.page_id, version: rec.version, status: rec.status, page: rec.page };
  },

  async publish_page(ctx, args) {
    const rec = await loadPage(ctx, args.page_id);
    return publishRecord(ctx, args.page_id, rec, args.confirm === true);
  },

  async delete_page(ctx, args) {
    const rec = await loadPage(ctx, args.page_id);
    if (args.confirm !== true) {
      return refusal("delete_page", `Supprimer la page « ${rec.page.title} » est définitif.`, "Rappelle delete_page avec confirm:true après accord de la personne.");
    }
    if (rec.funnelId) {
      const f = await ctx.store.getFunnel(rec.funnelId);
      if (f) {
        f.steps = f.steps.filter((s) => s.pageId !== args.page_id);
        await ctx.store.putFunnel(f);
      }
    }
    await ctx.store.deletePage(args.page_id);
    return { page_id: args.page_id, deleted: true };
  },

  async create_funnel(ctx, args) {
    const slugs = args.steps.map((s) => s.slug ?? slugify(s.title));
    if (new Set(slugs).size !== slugs.length) throw new ToolError("duplicate_slug", "Deux étapes ont la même adresse (slug).");
    const funnelSlug = await uniqueFunnelSlug(ctx, args.slug ?? slugify(args.name));
    const funnelId = ctx.store.newId("fn");
    const urlFor = (slug: string) => (slugs.includes(slug) ? `/p/${funnelSlug}/${slug}` : null);

    // Tout est validé et construit en mémoire avant la moindre écriture : un tunnel est créé en entier ou pas du tout.
    const built: { step: FunnelStep; rec: PageRecord }[] = args.steps.map((s, i) => {
      const blocks = structuredClone(s.blocks) as Block[];
      resolveLinks(blocks, slugs, i, urlFor);
      const pageId = ctx.store.newId("pg");
      const page = newPage(pageId, { title: s.title, slug: slugs[i], share: s.share, blocks });
      return {
        step: { id: ctx.store.newId("st"), slug: slugs[i], kind: s.kind, pageId },
        rec: { page, version: 1, status: "draft", published: null, funnelId, updatedAt: new Date().toISOString() },
      };
    });
    const sequence = args.email_sequence ? sequenceRecord(ctx, args.email_sequence) : null;

    for (const b of built) await ctx.store.putPage(b.step.pageId, b.rec);
    const funnel: FunnelRecord = { id: funnelId, name: args.name, slug: funnelSlug, steps: built.map((b) => b.step), status: "draft" };
    await ctx.store.putFunnel(funnel);
    if (sequence) await ctx.store.putSequence(sequence);

    return {
      funnel_id: funnelId,
      status: "draft",
      steps: funnel.steps.map((s) => ({ step_id: s.id, page_id: s.pageId, url: pageUrl(ctx, funnelSlug, s.slug) })),
      ...(sequence ? { sequence_id: sequence.id } : {}),
    };
  },

  async publish_funnel(ctx, args) {
    const f = await ctx.store.getFunnel(args.funnel_id);
    if (!f) throw new ToolError("funnel_not_found", `Tunnel introuvable : ${args.funnel_id}`);
    // Contrôle d'abord (aucune publication partielle si une confirmation manque).
    const recs: [string, PageRecord][] = [];
    for (const s of f.steps) recs.push([s.pageId, await loadPage(ctx, s.pageId)]);
    for (const [, rec] of recs) {
      const changed = priceChanges(rec);
      if (changed.length && args.confirm !== true) {
        return refusal("publish_funnel", `Le prix change sur la page « ${rec.page.title} » : ${changed.join(", ")}.`, "Rappelle publish_funnel avec confirm:true après accord de la personne.");
      }
    }
    for (const [pid, rec] of recs) await publishRecord(ctx, pid, rec, true);
    f.status = "published";
    await ctx.store.putFunnel(f);
    return { funnel_id: f.id, status: "published", published: recs.length };
  },

  async schedule_email_sequence(ctx, args) {
    const seq = sequenceRecord(ctx, args);
    await ctx.store.putSequence(seq);
    return { sequence_id: seq.id, status: seq.status, emails: seq.emails.length };
  },

  async send_email_to_list(ctx, args) {
    const c = args.confirm ?? {};
    if (c.test_reviewed !== true || c.recipients_consent !== true) {
      const contacts = await ctx.store.listContacts(args.tag);
      const missing = [c.test_reviewed !== true && "test_reviewed", c.recipients_consent !== true && "recipients_consent"].filter(Boolean).join(" et ");
      return refusal(
        "send_email_to_list",
        `Un envoi réel à ${contacts.length} personne(s) ne se rattrape pas. Confirmation manquante : ${missing}.`,
        "Rappelle send_email_to_list avec confirm:{test_reviewed:true, recipients_consent:true} une fois le test relu et l'accord des destinataires vérifié."
      );
    }
    const contacts = (await ctx.store.listContacts(args.tag)).filter((x) => x.consent);
    for (const contact of contacts) await ctx.mailer.send({ to: contact.email, subject: args.subject, body: args.body });
    return { sent: contacts.length };
  },
};

function priceChanges(rec: PageRecord): string[] {
  if (!rec.published) return [];
  const before = collectPrices(rec.published);
  const after = collectPrices(rec.page);
  const out: string[] = [];
  for (const [product, cents] of Object.entries(after)) {
    if (product in before && before[product] !== cents) out.push(`${product} : ${before[product] / 100} EUR vers ${cents / 100} EUR`);
  }
  return out;
}

async function publishRecord(ctx: ToolContext, pageId: string, rec: PageRecord, confirmed: boolean) {
  const changes = priceChanges(rec);
  if (changes.length && !confirmed) {
    return refusal("publish_page", `Publier changerait un prix déjà en ligne (${changes.join("; ")}).`, "Rappelle publish_page avec confirm:true après accord de la personne.");
  }
  rec.published = structuredClone(rec.page);
  rec.status = "published";
  await ctx.store.putPage(pageId, rec);
  return { page_id: pageId, version: rec.version, status: "published" };
}

export type { Page };
export { PageError, safeLink };
