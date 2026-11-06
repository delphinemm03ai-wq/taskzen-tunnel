import { randomUUID } from "node:crypto";
import type { Page } from "@/lib/page-format/schema";

export type PageStatus = "draft" | "published";

export interface PageRecord {
  page: Page;
  version: number;
  status: PageStatus;
  /** Copie de la page au moment de la dernière publication (ce que voient les visiteurs). */
  published: Page | null;
  funnelId?: string;
  updatedAt: string;
}

export interface FunnelStep {
  id: string;
  slug: string;
  kind: "capture" | "sales" | "order" | "thanks" | "other";
  pageId: string;
}
export interface FunnelRecord {
  id: string;
  name: string;
  slug: string;
  steps: FunnelStep[];
  status: PageStatus;
}

export interface SequenceEmail {
  id: string;
  /** Délai en heures après l'email précédent (le premier : après le déclencheur). */
  delay_hours: number;
  subject: string;
  body: string;
}
export interface SequenceRecord {
  id: string;
  name: string;
  trigger: { type: "signup" | "purchase" | "tag_added" | "date"; tag?: string; date?: string };
  emails: SequenceEmail[];
  exit_on: ("purchase" | "unsubscribe")[];
  status: "scheduled";
  /** Rien ne part tant que ce champ est vide. */
  activated_at: string | null;
}

export interface ContactRecord {
  email: string;
  tags: string[];
  consent: boolean;
}

export interface CallLogEntry {
  at: string;
  keyId: string;
  tool: string;
  requestBytes: number;
  responseBytes: number;
  ok: boolean;
}

/** Conflit d'écriture : la page a changé (ou existe déjà) depuis la lecture. */
export class StoreConflictError extends Error {
  constructor(message = "Conflit de version") {
    super(message);
  }
}

export interface PutPageOptions {
  /** Création : échoue si l'identifiant existe déjà. */
  insert?: boolean;
  /** Mise à jour : échoue si la version stockée n'est plus celle-ci. */
  expectedVersion?: number;
}

export interface FunnelBundle {
  funnel: FunnelRecord;
  pages: PageRecord[];
  sequence: SequenceRecord | null;
}

/** Port de stockage. Une implémentation durable (base de données) se branche ici plus tard. */
export interface Store {
  newId(prefix: string): string;
  getPage(id: string): Promise<PageRecord | null>;
  putPage(id: string, rec: PageRecord, opts?: PutPageOptions): Promise<void>;
  /** Écrit un tunnel, ses pages et sa séquence en bloc : tout ou rien. */
  saveFunnelBundle(bundle: FunnelBundle): Promise<void>;
  deletePage(id: string): Promise<void>;
  findPublishedByPath(funnelSlug: string, stepSlug: string): Promise<PageRecord | null>;
  getFunnel(id: string): Promise<FunnelRecord | null>;
  listFunnels(): Promise<FunnelRecord[]>;
  putFunnel(rec: FunnelRecord): Promise<void>;
  findFunnelBySlug(slug: string): Promise<FunnelRecord | null>;
  putSequence(rec: SequenceRecord): Promise<void>;
  getSequence(id: string): Promise<SequenceRecord | null>;
  listContacts(tag?: string): Promise<ContactRecord[]>;
  putContact(c: ContactRecord): Promise<void>;
  logCall(e: CallLogEntry): Promise<void>;
  callLog(): Promise<CallLogEntry[]>;
}

export class MemoryStore implements Store {
  private pages = new Map<string, PageRecord>();
  private funnels = new Map<string, FunnelRecord>();
  private sequences = new Map<string, SequenceRecord>();
  private contacts = new Map<string, ContactRecord>();
  private log: CallLogEntry[] = [];

  newId(prefix: string) {
    return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  }
  async getPage(id: string) {
    const r = this.pages.get(id);
    return r ? structuredClone(r) : null;
  }
  async putPage(id: string, rec: PageRecord, opts: PutPageOptions = {}) {
    const current = this.pages.get(id);
    if (opts.insert && current) throw new StoreConflictError("Cette page existe déjà");
    if (opts.expectedVersion !== undefined && current?.version !== opts.expectedVersion) throw new StoreConflictError();
    this.pages.set(id, structuredClone(rec));
  }
  async saveFunnelBundle(b: FunnelBundle) {
    if (await this.findFunnelBySlug(b.funnel.slug)) throw new StoreConflictError("Cette adresse de tunnel existe déjà");
    for (const p of b.pages) this.pages.set(p.page.id, structuredClone(p));
    this.funnels.set(b.funnel.id, structuredClone(b.funnel));
    if (b.sequence) this.sequences.set(b.sequence.id, structuredClone(b.sequence));
  }
  async deletePage(id: string) {
    this.pages.delete(id);
  }
  async findPublishedByPath(funnelSlug: string, stepSlug: string) {
    const f = await this.findFunnelBySlug(funnelSlug);
    if (!f) return null;
    const step = f.steps.find((s) => s.slug === stepSlug);
    if (!step) return null;
    const rec = await this.getPage(step.pageId);
    return rec && rec.status === "published" && rec.published ? rec : null;
  }
  async listFunnels() {
    return structuredClone([...this.funnels.values()]);
  }
  async getFunnel(id: string) {
    const f = this.funnels.get(id);
    return f ? structuredClone(f) : null;
  }
  async putFunnel(rec: FunnelRecord) {
    this.funnels.set(rec.id, structuredClone(rec));
  }
  async findFunnelBySlug(slug: string) {
    for (const f of this.funnels.values()) if (f.slug === slug) return structuredClone(f);
    return null;
  }
  async putSequence(rec: SequenceRecord) {
    this.sequences.set(rec.id, structuredClone(rec));
  }
  async getSequence(id: string) {
    const s = this.sequences.get(id);
    return s ? structuredClone(s) : null;
  }
  async listContacts(tag?: string) {
    const all = [...this.contacts.values()];
    return structuredClone(tag ? all.filter((c) => c.tags.includes(tag)) : all);
  }
  async putContact(c: ContactRecord) {
    this.contacts.set(c.email, structuredClone(c));
  }
  async logCall(e: CallLogEntry) {
    this.log.push(e);
  }
  async callLog() {
    return structuredClone(this.log);
  }
}

const g = globalThis as unknown as { __tzStore?: Store };
/**
 * Instance partagée du processus. Supabase si SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont définis
 * (sauf TUNNEL_STORE=memory), sinon mémoire (tests, développement sans base).
 * Le choix est fait dans lib/store/index.ts pour éviter un import circulaire.
 */
export function setStore(s: Store) {
  g.__tzStore = s;
}
export function currentStore(): Store | undefined {
  return g.__tzStore;
}
