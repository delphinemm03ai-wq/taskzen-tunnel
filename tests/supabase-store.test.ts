import { describe, expect, it, vi, afterEach } from "vitest";
import { SupabaseStore, fetchRest } from "@/lib/store/supabase-store";
import { MemoryStore, StoreConflictError, type PageRecord } from "@/lib/store/store";
import { newPage } from "@/lib/page-format/ops";
import { handleRpc, type CallerKey } from "@/lib/mcp/server";
import type { ToolContext } from "@/lib/mcp/tools";
import { FakeRest } from "./fake-rest";
import { FakeMailer, SAMPLE_FUNNEL, SAMPLE_SEQUENCE } from "./helpers";

function rec(id: string, title = "T"): PageRecord {
  return { page: newPage(id, { title, blocks: [{ id: "a", type: "text", text: "x" }] }), version: 1, status: "draft", published: null, updatedAt: "2026-11-03T10:00:00.000Z" };
}
function setup() {
  const fake = new FakeRest();
  return { fake, store: new SupabaseStore(fake.rest) };
}

describe("SupabaseStore : pages et verrou de version", () => {
  it("écrit puis relit une page (JSON versionné)", async () => {
    const { store } = setup();
    await store.putPage("pg_1", rec("pg_1"), { insert: true });
    const back = await store.getPage("pg_1");
    expect(back!.version).toBe(1);
    expect(back!.page.title).toBe("T");
    expect(back!.page.format).toBe(1);
    expect(await store.getPage("inconnue")).toBeNull();
  });

  it("refuse de créer deux fois la même page", async () => {
    const { store } = setup();
    await store.putPage("pg_1", rec("pg_1"), { insert: true });
    await expect(store.putPage("pg_1", rec("pg_1"), { insert: true })).rejects.toBeInstanceOf(StoreConflictError);
  });

  it("conflit de version : la deuxième écriture sur une version périmée échoue et ne change rien", async () => {
    const { store, fake } = setup();
    await store.putPage("pg_1", rec("pg_1"), { insert: true });
    const a = (await store.getPage("pg_1"))!;
    const b = (await store.getPage("pg_1"))!;
    a.version = 2;
    a.page.title = "Version A";
    await store.putPage("pg_1", a, { expectedVersion: 1 });
    b.version = 2;
    b.page.title = "Version B";
    await expect(store.putPage("pg_1", b, { expectedVersion: 1 })).rejects.toBeInstanceOf(StoreConflictError);
    expect((await store.getPage("pg_1"))!.page.title).toBe("Version A");
    // la requête de mise à jour porte bien le filtre de version (verrou côté base)
    const patch = fake.requests.filter((r) => r.method === "PATCH");
    expect(patch.every((r) => r.query?.version === "eq.1" && r.query?.id === "eq.pg_1")).toBe(true);
  });

  it("outil update_page sur le magasin Supabase : conflit remonté en version_conflict", async () => {
    const { store } = setup();
    const ctx: ToolContext = { store, mailer: new FakeMailer(), baseUrl: "https://t.test" };
    const caller: CallerKey = { id: "sb-conflict", scope: "rw" };
    const call = async (name: string, args: unknown) => {
      const res = await handleRpc(ctx, caller, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, 10);
      return JSON.parse((res!.result as { content: { text: string }[] }).content[0].text);
    };
    const created = await call("create_page", { title: "P", blocks: [{ id: "h", type: "heading", text: "A" }] });
    const ok = await call("update_page", { page_id: created.page_id, expected_version: 1, changes: [{ op: "set_props", block_id: "h", props: { text: "B" } }] });
    expect(ok.version).toBe(2);
    const stale = await call("update_page", { page_id: created.page_id, expected_version: 1, changes: [{ op: "set_props", block_id: "h", props: { text: "C" } }] });
    expect(stale.error).toBe("version_conflict");
    expect((await call("get_page", { page_id: created.page_id })).page.blocks[0].text).toBe("B");
  });
});

describe("SupabaseStore : tunnel écrit tout ou rien", () => {
  const bundle = (store: SupabaseStore, slug: string) => ({
    funnel: { id: store.newId("fn"), name: "F", slug, status: "draft" as const, steps: [] },
    pages: [rec("pg_a"), rec("pg_b"), rec("pg_c")],
    sequence: { id: "seq_1", name: "S", trigger: { type: "signup" as const }, emails: [], exit_on: ["purchase" as const], status: "scheduled" as const },
  });

  it("écrit le tunnel, ses pages et sa séquence en un seul appel réseau", async () => {
    const { store, fake } = setup();
    await store.saveFunnelBundle(bundle(store, "mon-tunnel"));
    expect(fake.requests).toHaveLength(1);
    expect(fake.requests[0].path).toBe("rpc/tunnel_create_funnel");
    expect(fake.tables.tunnel_pages).toHaveLength(3);
    expect(fake.tables.tunnel_funnels).toHaveLength(1);
    expect(fake.tables.tunnel_email_sequences).toHaveLength(1);
  });

  it("une erreur au milieu annule tout : aucune page, aucun tunnel, aucune séquence", async () => {
    const { store, fake } = setup();
    fake.failOnPageIndex = 2;
    await expect(store.saveFunnelBundle(bundle(store, "casse"))).rejects.toThrow();
    expect(fake.tables.tunnel_pages).toHaveLength(0);
    expect(fake.tables.tunnel_funnels).toHaveLength(0);
    expect(fake.tables.tunnel_email_sequences).toHaveLength(0);
  });

  it("une adresse déjà prise donne un conflit et ne laisse rien derrière", async () => {
    const { store, fake } = setup();
    await store.saveFunnelBundle(bundle(store, "pris"));
    const before = structuredClone(fake.tables);
    const second = { ...bundle(store, "pris"), pages: [rec("pg_x")], sequence: null };
    await expect(store.saveFunnelBundle(second)).rejects.toBeInstanceOf(StoreConflictError);
    expect(fake.tables).toEqual(before);
  });
});

describe("SupabaseStore : parcours complet par les outils", () => {
  it("create_funnel, publish_funnel, séquence, page publique relue, journal des appels persisté", async () => {
    const { store, fake } = setup();
    const ctx: ToolContext = { store, mailer: new FakeMailer(), baseUrl: "https://t.test" };
    const caller: CallerKey = { id: "sb-journey", scope: "rw" };
    const call = async (name: string, args: unknown) => {
      const raw = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
      const res = await handleRpc(ctx, caller, JSON.parse(raw), Buffer.byteLength(raw));
      return JSON.parse((res!.result as { content: { text: string }[] }).content[0].text);
    };
    const f = await call("create_funnel", { ...SAMPLE_FUNNEL, email_sequence: SAMPLE_SEQUENCE });
    expect(f.steps).toHaveLength(3);
    expect(fake.tables.tunnel_pages).toHaveLength(3);
    expect(f.sequence_id).toBeTruthy();
    expect((await store.getSequence(f.sequence_id))!.emails).toHaveLength(5);

    expect((await call("publish_funnel", { funnel_id: f.funnel_id })).status).toBe("published");
    const pub = await store.findPublishedByPath("coaching-demo", "guide-gratuit");
    expect(pub!.published!.title).toBe("Guide gratuit");
    expect(await store.findPublishedByPath("coaching-demo", "inexistante")).toBeNull();

    // le journal des appels est écrit en base, avec la taille de la demande (X2)
    await new Promise((r) => setTimeout(r, 0));
    const log = await store.callLog();
    expect(log.map((l) => l.tool)).toEqual(["create_funnel", "publish_funnel"]);
    expect(log[0].requestBytes).toBeGreaterThan(500);
  });

  it("un tunnel dont l'écriture échoue ne laisse aucune page (tout ou rien via l'outil)", async () => {
    const { store, fake } = setup();
    fake.failOnPageIndex = 1;
    const ctx: ToolContext = { store, mailer: new FakeMailer(), baseUrl: "https://t.test" };
    const res = await handleRpc(ctx, { id: "sb-atomic", scope: "rw" }, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_funnel", arguments: SAMPLE_FUNNEL } }, 10);
    expect((res!.result as { isError: boolean }).isError).toBe(true);
    expect(fake.tables.tunnel_pages).toHaveLength(0);
    expect(fake.tables.tunnel_funnels).toHaveLength(0);
  });
});

describe("SupabaseStore : contacts, client réel, choix du magasin", () => {
  it("liste les contacts par étiquette (consentement = non désinscrit)", async () => {
    const { store, fake } = setup();
    fake.tables.tunnel_contacts = [
      { id: "1", email: "a@x.fr", unsubscribed_at: null, tunnel_contact_tags: [{ tunnel_tags: { name: "lead" } }] },
      { id: "2", email: "b@x.fr", unsubscribed_at: "2026-11-01T00:00:00Z", tunnel_contact_tags: [{ tunnel_tags: { name: "lead" } }] },
      { id: "3", email: "c@x.fr", unsubscribed_at: null, tunnel_contact_tags: [] },
    ];
    expect(await store.listContacts("lead")).toEqual([
      { email: "a@x.fr", consent: true, tags: ["lead"] },
      { email: "b@x.fr", consent: false, tags: ["lead"] },
    ]);
    expect(await store.listContacts()).toHaveLength(3);
  });

  it("putContact : upsert du contact, des étiquettes et des liaisons", async () => {
    const { store, fake } = setup();
    await store.putContact({ email: " A@X.fr ", tags: ["lead", "vip"], consent: true });
    expect(fake.tables.tunnel_contacts[0].email).toBe("a@x.fr");
    expect(fake.tables.tunnel_tags).toHaveLength(2);
    expect(fake.tables.tunnel_contact_tags).toHaveLength(2);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.TUNNEL_STORE;
    (globalThis as { __tzStore?: unknown }).__tzStore = undefined;
  });

  it("client réel : clé en en-tête uniquement, jamais dans une erreur (fetch simulé)", async () => {
    process.env.SUPABASE_URL = "https://exemple.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "cle-factice-ne-pas-fuiter";
    const spy = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await fetchRest({ method: "GET", path: "tunnel_pages", query: { id: "eq.pg_1" } });
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toBe("https://exemple.invalid/rest/v1/tunnel_pages?id=eq.pg_1");
    expect(String(url)).not.toContain("cle-factice");
    expect((init.headers as Record<string, string>).apikey).toBe("cle-factice-ne-pas-fuiter");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    await expect(fetchRest({ method: "GET", path: "tunnel_pages" })).rejects.toThrow(/injoignable/);
    await fetchRest({ method: "GET", path: "x" }).catch((e: Error) => expect(e.message).not.toContain("cle-factice"));
  });

  it("getStore : mémoire sans variables, Supabase avec variables, mémoire forcée par TUNNEL_STORE", async () => {
    const { getStore } = await import("@/lib/store");
    const g = globalThis as { __tzStore?: unknown };
    g.__tzStore = undefined;
    expect(getStore()).toBeInstanceOf(MemoryStore);
    g.__tzStore = undefined;
    process.env.SUPABASE_URL = "https://exemple.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "cle-factice";
    expect(getStore()).toBeInstanceOf(SupabaseStore);
    g.__tzStore = undefined;
    process.env.TUNNEL_STORE = "memory";
    expect(getStore()).toBeInstanceOf(MemoryStore);
  });
});
