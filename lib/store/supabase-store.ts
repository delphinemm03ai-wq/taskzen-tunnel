/**
 * Magasin durable sur Supabase (tables tunnel_*, migration 004).
 *
 * Même convention que lib/supabase.ts : API REST PostgREST en fetch pur, zéro dépendance,
 * clé service_role côté serveur uniquement. Le client HTTP est injecté (type Rest) :
 * les tests passent un faux client, aucun appel réseau.
 */
import { randomUUID } from "node:crypto";
import {
  StoreConflictError,
  type CallLogEntry, type ContactRecord, type FunnelBundle, type FunnelRecord, type PageRecord,
  type PutPageOptions, type SequenceRecord, type Store,
} from "./store";

export interface RestRequest {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Table, ou "rpc/<fonction>". */
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  prefer?: string;
}
export interface RestResponse {
  status: number;
  body: unknown;
}
export type Rest = (req: RestRequest) => Promise<RestResponse>;

/** Client réel : lit l'environnement à chaque appel, ne renvoie jamais la clé dans une erreur. */
export const fetchRest: Rest = async (req) => {
  const base = String(process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const url = new URL(`${base}/rest/v1/${req.path}`);
  for (const [k, v] of Object.entries(req.query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: req.method,
      cache: "no-store",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(req.prefer && { Prefer: req.prefer }),
      },
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
    });
  } catch (err) {
    throw new Error(`Supabase injoignable (projet en pause ?) : ${err instanceof Error ? err.message : String(err)}`);
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
};

const ok = (r: RestResponse) => r.status >= 200 && r.status < 300;

function must(r: RestResponse, label: string): unknown {
  if (!ok(r)) {
    console.error(`[Supabase] ${label} failed`, { status: r.status, body: r.body });
    throw new Error(`Supabase ${label} failed: ${r.status}`);
  }
  return r.body;
}

const rows = (b: unknown) => (Array.isArray(b) ? (b as Record<string, unknown>[]) : []);

function pageRow(id: string, rec: PageRecord) {
  return {
    id,
    version: rec.version,
    status: rec.status,
    page: rec.page,
    published: rec.published,
    funnel_id: rec.funnelId ?? null,
    updated_at: rec.updatedAt,
  };
}
function pageFromRow(r: Record<string, unknown>): PageRecord {
  return {
    page: r.page as PageRecord["page"],
    version: r.version as number,
    status: r.status as PageRecord["status"],
    published: (r.published ?? null) as PageRecord["published"],
    funnelId: (r.funnel_id as string | null) ?? undefined,
    updatedAt: r.updated_at as string,
  };
}
const funnelRow = (f: FunnelRecord) => ({ id: f.id, name: f.name, slug: f.slug, status: f.status, steps: f.steps });
const sequenceRow = (s: SequenceRecord) => ({ id: s.id, name: s.name, trigger: s.trigger, emails: s.emails, exit_on: s.exit_on, status: s.status });

export class SupabaseStore implements Store {
  constructor(private rest: Rest) {}

  newId(prefix: string) {
    return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  }

  async getPage(id: string) {
    const r = rows(must(await this.rest({ method: "GET", path: "tunnel_pages", query: { select: "*", id: `eq.${id}`, limit: "1" } }), "getPage"));
    return r[0] ? pageFromRow(r[0]) : null;
  }

  async putPage(id: string, rec: PageRecord, opts: PutPageOptions = {}) {
    const row = pageRow(id, rec);
    if (opts.insert) {
      const res = await this.rest({ method: "POST", path: "tunnel_pages", body: [row], prefer: "return=minimal" });
      if (res.status === 409) throw new StoreConflictError("Cette page existe déjà");
      must(res, "putPage(insert)");
      return;
    }
    if (opts.expectedVersion !== undefined) {
      // Verrou optimiste : la ligne n'est modifiée que si sa version est encore celle qu'on a lue.
      const res = await this.rest({
        method: "PATCH",
        path: "tunnel_pages",
        query: { id: `eq.${id}`, version: `eq.${opts.expectedVersion}`, select: "id" },
        body: row,
        prefer: "return=representation",
      });
      if (rows(must(res, "putPage(update)")).length === 0) throw new StoreConflictError();
      return;
    }
    must(await this.rest({ method: "POST", path: "tunnel_pages", query: { on_conflict: "id" }, body: [row], prefer: "resolution=merge-duplicates,return=minimal" }), "putPage(upsert)");
  }

  async deletePage(id: string) {
    must(await this.rest({ method: "DELETE", path: "tunnel_pages", query: { id: `eq.${id}` }, prefer: "return=minimal" }), "deletePage");
  }

  /** Un seul appel : la fonction SQL tunnel_create_funnel écrit tout dans une transaction. */
  async saveFunnelBundle(b: FunnelBundle) {
    const res = await this.rest({
      method: "POST",
      path: "rpc/tunnel_create_funnel",
      body: { bundle: { funnel: funnelRow(b.funnel), pages: b.pages.map((p) => pageRow(p.page.id, p)), sequence: b.sequence ? sequenceRow(b.sequence) : null } },
    });
    if (res.status === 409) throw new StoreConflictError("Cette adresse de tunnel existe déjà");
    must(res, "saveFunnelBundle");
  }

  async findPublishedByPath(funnelSlug: string, stepSlug: string) {
    const f = await this.findFunnelBySlug(funnelSlug);
    const step = f?.steps.find((s) => s.slug === stepSlug);
    if (!step) return null;
    const rec = await this.getPage(step.pageId);
    return rec && rec.status === "published" && rec.published ? rec : null;
  }

  async getFunnel(id: string) {
    const r = rows(must(await this.rest({ method: "GET", path: "tunnel_funnels", query: { select: "*", id: `eq.${id}`, limit: "1" } }), "getFunnel"));
    return r[0] ? (r[0] as unknown as FunnelRecord) : null;
  }
  async findFunnelBySlug(slug: string) {
    const r = rows(must(await this.rest({ method: "GET", path: "tunnel_funnels", query: { select: "*", slug: `eq.${slug}`, limit: "1" } }), "findFunnelBySlug"));
    return r[0] ? (r[0] as unknown as FunnelRecord) : null;
  }
  async putFunnel(rec: FunnelRecord) {
    must(await this.rest({ method: "POST", path: "tunnel_funnels", query: { on_conflict: "id" }, body: [funnelRow(rec)], prefer: "resolution=merge-duplicates,return=minimal" }), "putFunnel");
  }

  async putSequence(rec: SequenceRecord) {
    must(await this.rest({ method: "POST", path: "tunnel_email_sequences", query: { on_conflict: "id" }, body: [sequenceRow(rec)], prefer: "resolution=merge-duplicates,return=minimal" }), "putSequence");
  }
  async getSequence(id: string) {
    const r = rows(must(await this.rest({ method: "GET", path: "tunnel_email_sequences", query: { select: "*", id: `eq.${id}`, limit: "1" } }), "getSequence"));
    return r[0] ? (r[0] as unknown as SequenceRecord) : null;
  }

  /** Contacts du tunnel (tables 001). Consentement = contact non désinscrit (unsubscribed_at nul). */
  async listContacts(tag?: string): Promise<ContactRecord[]> {
    const r = rows(
      must(await this.rest({ method: "GET", path: "tunnel_contacts", query: { select: "email,unsubscribed_at,tunnel_contact_tags(tunnel_tags(name))", order: "created_at.asc,id.asc" } }), "listContacts")
    );
    const all = r.map((c) => ({
      email: String(c.email),
      consent: c.unsubscribed_at == null,
      tags: ((c.tunnel_contact_tags as { tunnel_tags: { name: string } | null }[]) ?? []).map((l) => l.tunnel_tags?.name).filter((n): n is string => Boolean(n)),
    }));
    return tag ? all.filter((c) => c.tags.includes(tag)) : all;
  }
  async putContact(c: ContactRecord) {
    const email = c.email.trim().toLowerCase();
    const created = rows(
      must(
        await this.rest({
          method: "POST", path: "tunnel_contacts", query: { on_conflict: "email", select: "id" },
          body: [{ email, unsubscribed_at: c.consent ? null : new Date().toISOString() }],
          prefer: "resolution=merge-duplicates,return=representation",
        }),
        "putContact"
      )
    );
    const contactId = created[0]?.id as string;
    const names = [...new Set(c.tags)];
    if (!names.length) return;
    const tags = rows(
      must(await this.rest({ method: "POST", path: "tunnel_tags", query: { on_conflict: "name", select: "id,name" }, body: names.map((name) => ({ name })), prefer: "resolution=merge-duplicates,return=representation" }), "putContact(tags)")
    );
    must(
      await this.rest({ method: "POST", path: "tunnel_contact_tags", query: { on_conflict: "contact_id,tag_id" }, body: tags.map((t) => ({ contact_id: contactId, tag_id: t.id })), prefer: "resolution=ignore-duplicates,return=minimal" }),
      "putContact(link)"
    );
  }

  async logCall(e: CallLogEntry) {
    must(
      await this.rest({ method: "POST", path: "tunnel_mcp_calls", body: [{ at: e.at, key_id: e.keyId, tool: e.tool, request_bytes: e.requestBytes, response_bytes: e.responseBytes, ok: e.ok }], prefer: "return=minimal" }),
      "logCall"
    );
  }
  async callLog(): Promise<CallLogEntry[]> {
    const r = rows(must(await this.rest({ method: "GET", path: "tunnel_mcp_calls", query: { select: "*", order: "at.asc,id.asc" } }), "callLog"));
    return r.map((x) => ({ at: String(x.at), keyId: String(x.key_id), tool: String(x.tool), requestBytes: x.request_bytes as number, responseBytes: x.response_bytes as number, ok: x.ok as boolean }));
  }
}
