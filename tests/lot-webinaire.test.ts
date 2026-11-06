import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { runSequences, sentKey, type Enrollee, type SequenceRepo } from "@/lib/sequences/engine";
import { fillFirstName, findPlaceholders, renderSequenceEmail } from "@/lib/sequences/render";
import { isValidUnsubscribeToken, unsubscribeToken } from "@/lib/sequences/unsubscribe";
import { produitDePage, resolvePageSale, resolvePageSignup } from "@/lib/page-checkout";
import { renderPageHtml } from "@/lib/page-format/render";
import { MemoryStore, setStore, type SequenceRecord } from "@/lib/store/store";
import { makeEnv } from "./helpers";

const NOW = new Date("2026-11-17T17:00:00Z");
const iso = (s: string) => new Date(s).toISOString();

function seq(over: Partial<SequenceRecord> = {}): SequenceRecord {
  return {
    id: "seq_1",
    name: "Rappels",
    trigger: { type: "tag_added", tag: "webinaire" },
    emails: [{ id: "em_1", delay_hours: 0, subject: "Bienvenue", body: "Salut {first_name}," }],
    exit_on: ["purchase", "unsubscribe"],
    status: "scheduled",
    activated_at: iso("2026-11-10T00:00:00Z"),
    ...over,
  };
}
const person = (over: Partial<Enrollee> = {}): Enrollee => ({
  contactId: "c1",
  email: "a@exemple.fr",
  firstName: "Ana",
  unsubscribedAt: null,
  enrolledAt: iso("2026-11-17T10:00:00Z"),
  ...over,
});

function repo(s: SequenceRecord, people: Enrollee[], sales: [string, string][] = []) {
  const claimed = new Set<string>();
  const r: SequenceRepo = {
    listActive: async () => (s.activated_at ? [s] : []),
    enrollees: async () => people,
    lastSaleByContact: async () => new Map(sales),
    sentKeys: async () => new Set(claimed),
    claim: async (_s, e, c) => {
      const k = sentKey(e, c);
      if (claimed.has(k)) return false;
      claimed.add(k);
      return true;
    },
    release: async (_s, e, c) => void claimed.delete(sentKey(e, c)),
  };
  return { r, claimed };
}

async function run(s: SequenceRecord, people: Enrollee[], opts: { now?: Date; sales?: [string, string][]; fail?: boolean } = {}) {
  const { r, claimed } = repo(s, people, opts.sales);
  const out: string[] = [];
  const report = await runSequences(r, async ({ enrollee, subject }) => {
    if (opts.fail) return { ok: false, reason: "panne" };
    out.push(`${enrollee.email}:${subject}`);
    return { ok: true };
  }, { now: opts.now ?? NOW });
  return { report, out, claimed, r };
}

describe("moteur d'envoi des séquences", () => {
  it("n'envoie rien tant que la séquence n'est pas activée", async () => {
    const { out } = await run(seq({ activated_at: null }), [person()]);
    expect(out).toEqual([]);
  });

  it("envoie une seule fois, même si le passage suivant repasse", async () => {
    const { r } = repo(seq(), [person()]);
    let n = 0;
    const send = async () => (n++, { ok: true });
    await runSequences(r, send, { now: NOW });
    await runSequences(r, send, { now: NOW });
    expect(n).toBe(1);
  });

  it("n'écrit jamais à l'ancienne liste : inscrits avant l'activation exclus, hors date fixe", async () => {
    const { out } = await run(seq(), [person({ enrolledAt: iso("2026-11-01T00:00:00Z") })]);
    expect(out).toEqual([]);
  });

  it("date fixe : la liste déjà inscrite reçoit le rappel, un inscrit arrivé après l'heure non", async () => {
    const s = seq({ trigger: { type: "date", tag: "webinaire", date: iso("2026-11-17T16:45:00Z") } });
    const { out } = await run(s, [person(), person({ contactId: "c2", email: "tard@exemple.fr", enrolledAt: iso("2026-11-17T16:50:00Z") })]);
    expect(out).toEqual(["a@exemple.fr:Bienvenue"]);
  });

  it("date fixe : un rappel en retard de plus d'une heure ne part pas", async () => {
    const s = seq({ trigger: { type: "date", tag: "webinaire", date: iso("2026-11-17T16:45:00Z") } });
    const { out, report } = await run(s, [person()], { now: new Date("2026-11-17T18:30:00Z") });
    expect(out).toEqual([]);
    expect(report.skippedLate).toBe(1);
  });

  it("respecte le délai décimal d'un rappel à 15 minutes près", async () => {
    const s = seq({ emails: [{ id: "em_1", delay_hours: 0.25, subject: "Rappel", body: "x" }], trigger: { type: "date", tag: "webinaire", date: iso("2026-11-17T16:45:00Z") } });
    expect((await run(s, [person()], { now: new Date("2026-11-17T16:59:00Z") })).out).toEqual([]);
    expect((await run(s, [person()], { now: new Date("2026-11-17T17:00:00Z") })).out).toHaveLength(1);
  });

  it("sort les désinscrits et ceux qui ont acheté depuis leur inscription", async () => {
    const { out } = await run(seq(), [
      person({ contactId: "c2", unsubscribedAt: iso("2026-11-17T11:00:00Z") }),
      person({ contactId: "c3" }),
    ], { sales: [["c3", iso("2026-11-17T12:00:00Z")]] });
    expect(out).toEqual([]);
  });

  it("une inscription trop ancienne, hors date fixe, est signalée sans envoi", async () => {
    const { out, report } = await run(seq(), [person({ enrolledAt: iso("2026-11-16T10:00:00Z") })]);
    expect(out).toEqual([]);
    expect(report.skippedLate).toBe(1);
  });

  it("libère la réservation si l'envoi échoue, pour réessayer au passage suivant", async () => {
    const { report, claimed } = await run(seq(), [person()], { fail: true });
    expect(report.failed).toBe(1);
    expect(claimed.size).toBe(0);
  });

  it("plafonne un passage et signale le reste", async () => {
    const people = [person(), person({ contactId: "c2", email: "b@exemple.fr" })];
    const { r } = repo(seq(), people);
    const report = await runSequences(r, async () => ({ ok: true }), { now: NOW, maxSends: 1 });
    expect(report).toMatchObject({ sent: 1, remaining: 1 });
  });
});

describe("rendu des e-mails", () => {
  it("échappe le prénom et le texte, garde les liens https et la mise en forme", () => {
    const html = renderSequenceEmail({ body: "Salut {first_name},\n\n**Important** : [ici](https://exemple.fr/a) et <script>", firstName: "<b>Ana</b>" });
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>Important</strong>");
    expect(html).toContain('href="https://exemple.fr/a"');
  });

  it("n'accepte pas un lien javascript", () => {
    expect(renderSequenceEmail({ body: "[clic](javascript:alert(1))" })).not.toContain("href=");
  });

  it("sans prénom, la salutation reste correcte", () => {
    expect(fillFirstName("Salut {first_name},", null)).toBe("Salut,");
  });

  it("repère les marqueurs à remplir, pas le prénom", () => {
    expect(findPlaceholders("Salut {first_name}, [go]({lien_salle_paylive})")).toEqual(["{lien_salle_paylive}"]);
  });

  it("le lien de désinscription n'est valable que pour son contact", () => {
    const t = unsubscribeToken("c1", "secret");
    expect(isValidUnsubscribeToken("c1", t, "secret")).toBe(true);
    expect(isValidUnsubscribeToken("c2", t, "secret")).toBe(false);
    expect(isValidUnsubscribeToken("c1", t, undefined)).toBe(false);
  });
});

describe("activation d'une séquence", () => {
  const trigger = { type: "tag_added", tag: "webinaire" };
  const emails = [{ delay_hours: 0, subject: "Sujet", body: "Salut {first_name}," }];
  const yes = { test_reviewed: true, recipients_consent: true };

  it("refuse sans les deux confirmations", async () => {
    const { call, store } = makeEnv();
    const { data } = await call("schedule_email_sequence", { name: "S", trigger, emails });
    const r = await call("activate_email_sequence", { sequence_id: data.sequence_id, confirm: { test_reviewed: true } });
    expect(r.data.refused).toBe(true);
    expect((await store.getSequence(data.sequence_id))!.activated_at).toBeNull();
  });

  it("refuse s'il reste un lien à remplir, même confirmée", async () => {
    const { call } = makeEnv();
    const { data } = await call("schedule_email_sequence", { name: "S", trigger, emails: [{ delay_hours: 0, subject: "S", body: "[Go]({lien_salle_paylive})" }] });
    const r = await call("activate_email_sequence", { sequence_id: data.sequence_id, confirm: yes });
    expect(r.isError).toBe(true);
    expect(r.data.error).toBe("placeholders_left");
  });

  it("refuse une séquence sans étiquette, qui toucherait tous les contacts", async () => {
    const { call } = makeEnv();
    const { data } = await call("schedule_email_sequence", { name: "S", trigger: { type: "signup" }, emails });
    expect((await call("activate_email_sequence", { sequence_id: data.sequence_id, confirm: yes })).data.error).toBe("tag_required");
  });

  it("active avec les confirmations, et le test part à une seule adresse", async () => {
    const { call, store, mailer } = makeEnv();
    const { data } = await call("schedule_email_sequence", { name: "S", trigger, emails });
    expect((await call("send_test_email", { sequence_id: data.sequence_id, to: "moi@exemple.fr" })).data.sent).toBe(1);
    expect(mailer.sent[0]).toMatchObject({ to: "moi@exemple.fr", subject: "[TEST] Sujet" });
    await call("activate_email_sequence", { sequence_id: data.sequence_id, confirm: yes });
    expect((await store.getSequence(data.sequence_id))!.activated_at).toBeTruthy();
  });
});

describe("vente et inscription depuis une page publiée", () => {
  const FUNNEL = {
    name: "W",
    slug: "w",
    steps: [
      { title: "Inscription", kind: "capture", blocks: [{ type: "signup_form", label: "Go", tag: "webinaire", next_step: "@next" }] },
      { title: "Audit", kind: "sales", blocks: [{ type: "payment_button", label: "Payer", product: "audit", price_cents: 99700 }] },
      { title: "Merci", kind: "thanks", blocks: [{ type: "heading", text: "Merci" }] },
    ],
  };

  it("prix et retour relus dans la page publiée ; un brouillon ne se vend pas", async () => {
    const { call, store } = makeEnv();
    const { data } = await call("create_funnel", FUNNEL);
    expect(await resolvePageSale(store, "w", "audit")).toBeNull();
    await call("publish_funnel", { funnel_id: data.funnel_id });
    expect(await resolvePageSale(store, "w", "audit")).toEqual({ nom: "Audit", prixTtc: 99700, produit: "audit", successPath: "/p/w/merci", cancelPath: "/p/w/audit" });
    expect(await resolvePageSale(store, "w", "inscription")).toBeNull();
  });

  it("l'étiquette du formulaire vient de la page", async () => {
    const { call, store } = makeEnv();
    const { data } = await call("create_funnel", FUNNEL);
    await call("publish_funnel", { funnel_id: data.funnel_id });
    expect(await resolvePageSignup(store, "w", "inscription")).toEqual({ tag: "webinaire" });
  });

  it("le webhook retient le montant encaissé, et seulement pour une vente de page", () => {
    expect(produitDePage({ source: "page", produit: "audit", nom: "Audit" }, 99700)).toMatchObject({ prixTtc: 99700, tauxTva: 0, tag: "client-audit" });
    expect(produitDePage({ produit: "livre" }, 2700)).toBeUndefined();
    expect(produitDePage({ source: "page", produit: "audit" }, null)).toBeUndefined();
  });

  it("le formulaire de la page vise la nouvelle route et porte le leurre anti-robots", async () => {
    const { call, store } = makeEnv();
    const { data } = await call("create_funnel", FUNNEL);
    const rec = await store.getPage(data.steps[0].page_id);
    const html = renderPageHtml(rec!.page, { funnelSlug: "w", stepSlug: "inscription" });
    expect(html).toContain('data-endpoint="/api/page-optin"');
    expect(html).toContain('name="website"');
    expect(html).not.toContain("/api/lead");
  });
});

describe("bouton Publier de l'éditeur", () => {
  it("publie, refuse sans secret, et demande confirmation si un prix en ligne change", async () => {
    process.env.ADMIN_SECRET = "s3cret";
    const { call, store } = makeEnv();
    setStore(store as MemoryStore);
    const { data } = await call("create_funnel", {
      name: "P",
      slug: "p",
      steps: [{ title: "Vente", kind: "sales", blocks: [{ id: "pay", type: "payment_button", label: "Payer", product: "audit", price_cents: 100 }] }],
    });
    const id = data.steps[0].page_id;
    const { POST } = await import("@/app/api/admin/pages/[id]/publish/route");
    const req = (secret: string, body: object = {}) =>
      new NextRequest(`https://t.test/api/admin/pages/${id}/publish`, { method: "POST", headers: { "x-admin-secret": secret }, body: JSON.stringify(body) });
    const params = { params: Promise.resolve({ id }) };

    expect((await POST(req("faux"), params)).status).toBe(401);
    expect((await store.getPage(id))!.status).toBe("draft");

    expect((await POST(req("s3cret"), params)).status).toBe(200);
    expect((await store.getPage(id))!.status).toBe("published");

    await call("update_page", { page_id: id, changes: [{ op: "set_props", block_id: "pay", props: { price_cents: 200 } }] });
    const refused = await (await POST(req("s3cret"), params)).json();
    expect(refused.data.refused).toBe(true);
    expect((await store.getPage(id))!.published!.blocks[0].price_cents).toBe(100);

    await POST(req("s3cret", { confirm: true }), params);
    expect((await store.getPage(id))!.published!.blocks[0].price_cents).toBe(200);
  });
});
