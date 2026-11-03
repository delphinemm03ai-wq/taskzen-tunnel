import { describe, expect, it } from "vitest";
import { makeEnv } from "./helpers";
import { pageSchema } from "@/lib/page-format/schema";
import { patchPageFromEditor, readPageForEditor } from "@/lib/pages-api";

function bigBlocks(n: number) {
  return Array.from({ length: n }, (_, i) => ({ type: "text", text: `Paragraphe numéro ${i} `.repeat(40) }));
}

describe("X4 : la taille d'une réponse ne dépend pas de la taille de la page", () => {
  it("create_page et update_page répondent pareil pour 1 bloc ou 150 blocs", async () => {
    const { call } = makeEnv();
    const small = await call("create_page", { title: "Petite", blocks: bigBlocks(1) });
    const large = await call("create_page", { title: "Grande", blocks: bigBlocks(150) });
    expect(large.requestBytes).toBeGreaterThan(small.requestBytes * 50);
    expect(Math.abs(large.responseBytes - small.responseBytes)).toBeLessThanOrEqual(4);
    expect(large.responseBytes).toBeLessThan(120);

    const u1 = await call("update_page", { page_id: small.data.page_id, changes: [{ op: "set_title", title: "Autre" }] });
    const u2 = await call("update_page", { page_id: large.data.page_id, changes: [{ op: "set_title", title: "Autre" }] });
    expect(Math.abs(u1.responseBytes - u2.responseBytes)).toBeLessThanOrEqual(4);
    console.log(`[X4] create_page: réponse ${small.responseBytes} o (1 bloc) contre ${large.responseBytes} o (150 blocs, demande ${large.requestBytes} o)`);
  });

  it("create_funnel : la réponse ne contient ni bloc ni texte de page", async () => {
    const { call } = makeEnv();
    const r = await call("create_funnel", { name: "F", steps: [{ title: "Une", blocks: bigBlocks(40) }] });
    expect(JSON.stringify(r.data)).not.toContain("Paragraphe");
    expect(r.responseBytes).toBeLessThan(300);
  });
});

describe("X5 : modifier une page n'envoie que le changement", () => {
  it("changer un titre : demande minuscule, page entière inchangée sinon", async () => {
    const { call } = makeEnv();
    const created = await call("create_page", { title: "Titre", blocks: [{ id: "t1", type: "heading", text: "Ancien" }, ...bigBlocks(100)] });
    const before = (await call("get_page", { page_id: created.data.page_id })).data.page;

    const upd = await call("update_page", { page_id: created.data.page_id, changes: [{ op: "set_props", block_id: "t1", props: { text: "Nouveau" } }] });
    expect(upd.isError).toBe(false);
    expect(upd.requestBytes).toBeLessThan(250);
    expect(upd.requestBytes).toBeLessThan(created.requestBytes / 100);
    expect(upd.responseBytes).toBeLessThan(120);

    const after = (await call("get_page", { page_id: created.data.page_id })).data.page;
    expect(after.blocks[0].text).toBe("Nouveau");
    expect(after.blocks.slice(1)).toEqual(before.blocks.slice(1)); // le reste est intact, mêmes id compris
    console.log(`[X5] création ${created.requestBytes} o, modification ${upd.requestBytes} o, réponse ${upd.responseBytes} o`);
  });

  it("ajouter, déplacer et supprimer un bloc par différence", async () => {
    const { call } = makeEnv();
    const c = await call("create_page", { title: "P", blocks: [{ id: "a", type: "text", text: "A" }, { id: "b", type: "text", text: "B" }] });
    await call("update_page", {
      page_id: c.data.page_id,
      changes: [
        { op: "add_block", block: { id: "n", type: "divider" }, after_id: "a" },
        { op: "move_block", block_id: "b", after_id: "a" },
        { op: "remove_block", block_id: "a" },
      ],
    });
    const p = (await call("get_page", { page_id: c.data.page_id })).data.page;
    expect(p.blocks.map((b: { id: string }) => b.id)).toEqual(["b", "n"]);
  });

  it("refuse un changement invalide sans toucher la page, et détecte un conflit de version", async () => {
    const { call } = makeEnv();
    const c = await call("create_page", { title: "P", blocks: [{ id: "a", type: "button", label: "Go", href: "https://exemple.fr" }] });
    const bad = await call("update_page", { page_id: c.data.page_id, changes: [{ op: "set_props", block_id: "a", props: { href: "javascript:alert(1)" } }] });
    expect(bad.isError).toBe(true);
    const still = (await call("get_page", { page_id: c.data.page_id })).data;
    expect(still.version).toBe(1);
    expect(still.page.blocks[0].href).toBe("https://exemple.fr");
    const conflict = await call("update_page", { page_id: c.data.page_id, expected_version: 7, changes: [{ op: "set_title", title: "x" }] });
    expect(conflict.data.error).toBe("version_conflict");
  });
});

describe("X6 : actions sensibles confirmées", () => {
  async function withContacts() {
    const env = makeEnv();
    await env.store.putContact({ email: "a@exemple.fr", tags: ["lead"], consent: true });
    await env.store.putContact({ email: "b@exemple.fr", tags: ["lead"], consent: true });
    await env.store.putContact({ email: "c@exemple.fr", tags: ["lead"], consent: false });
    return env;
  }

  it("envoi réel à une liste refusé sans confirmation : action, raison, manière de confirmer", async () => {
    const { call, mailer } = await withContacts();
    const r = await call("send_email_to_list", { tag: "lead", subject: "S", body: "B" });
    expect(r.isError).toBe(false);
    expect(r.data).toMatchObject({ refused: true, action: "send_email_to_list" });
    expect(r.data.reason).toMatch(/test_reviewed et recipients_consent/);
    expect(r.data.how_to_confirm).toMatch(/confirm/);
    expect(mailer.sent).toHaveLength(0);
  });

  it("une seule des deux cases ne suffit pas", async () => {
    const { call, mailer } = await withContacts();
    const r = await call("send_email_to_list", { tag: "lead", subject: "S", body: "B", confirm: { test_reviewed: true } });
    expect(r.data.refused).toBe(true);
    expect(r.data.reason).toMatch(/recipients_consent/);
    expect(mailer.sent).toHaveLength(0);
  });

  it("avec les deux cases : envoi aux seuls contacts consentants (double de test)", async () => {
    const { call, mailer } = await withContacts();
    const r = await call("send_email_to_list", { tag: "lead", subject: "S", body: "B", confirm: { test_reviewed: true, recipients_consent: true } });
    expect(r.data).toEqual({ sent: 2 });
    expect(mailer.sent.map((m) => m.to)).toEqual(["a@exemple.fr", "b@exemple.fr"]);
  });

  it("suppression d'une page refusée sans confirmation, puis acceptée", async () => {
    const { call } = makeEnv();
    const c = await call("create_page", { title: "À supprimer", blocks: [] });
    const refused = await call("delete_page", { page_id: c.data.page_id });
    expect(refused.data).toMatchObject({ refused: true, action: "delete_page" });
    expect((await call("get_page", { page_id: c.data.page_id })).isError).toBe(false);
    const ok = await call("delete_page", { page_id: c.data.page_id, confirm: true });
    expect(ok.data.deleted).toBe(true);
    expect((await call("get_page", { page_id: c.data.page_id })).data.error).toBe("page_not_found");
  });

  it("publier un changement de prix demande confirmation ; un premier prix non", async () => {
    const { call } = makeEnv();
    const c = await call("create_page", { title: "Vente", blocks: [{ id: "pay", type: "payment_button", label: "Acheter", product: "offre", price_cents: 9700 }] });
    expect((await call("publish_page", { page_id: c.data.page_id })).data.status).toBe("published");
    await call("update_page", { page_id: c.data.page_id, changes: [{ op: "set_props", block_id: "pay", props: { price_cents: 19700 } }] });
    const refused = await call("publish_page", { page_id: c.data.page_id });
    expect(refused.data).toMatchObject({ refused: true, action: "publish_page" });
    expect(refused.data.reason).toMatch(/97 EUR vers 197 EUR/);
    expect((await call("publish_page", { page_id: c.data.page_id, confirm: true })).data.status).toBe("published");
  });

  it("une clé en lecture seule ne peut rien écrire", async () => {
    const { call } = makeEnv("ro");
    const r = await call("create_page", { title: "x", blocks: [] });
    expect(r.data.error).toBe("forbidden");
  });
});

describe("X7 : même page pour l'IA et pour l'éditeur", () => {
  it("page créée par l'IA : s'ouvre et se modifie via l'interface de l'éditeur, puis se relit par l'IA", async () => {
    const { call, store } = makeEnv();
    const created = await call("create_page", { title: "Page IA", blocks: [{ id: "h", type: "heading", text: "Bonjour" }, { id: "t", type: "text", text: "Texte" }] });
    const id = created.data.page_id;

    const opened = await readPageForEditor(store, id);
    expect(() => pageSchema.parse(opened!.page)).not.toThrow(); // même schéma des deux côtés
    expect(opened!.page.blocks.map((b) => b.id)).toEqual(["h", "t"]);

    // modification « à la souris » : l'éditeur envoie les mêmes opérations
    await patchPageFromEditor(store, id, {
      expected_version: 1,
      changes: [
        { op: "set_props", block_id: "h", props: { text: "Modifié à la souris" } },
        { op: "move_block", block_id: "t", after_id: undefined },
      ],
    });

    const reread = (await call("get_page", { page_id: id })).data;
    expect(reread.version).toBe(2);
    expect(reread.page.blocks[0]).toMatchObject({ id: "t" });
    expect(reread.page.blocks[1]).toMatchObject({ id: "h", text: "Modifié à la souris" });
  });

  it("l'éditeur ne peut pas écrire un bloc que l'IA ne pourrait pas écrire", async () => {
    const { call, store } = makeEnv();
    const c = await call("create_page", { title: "P", blocks: [{ id: "a", type: "text", text: "x" }] });
    await expect(
      patchPageFromEditor(store, c.data.page_id, { changes: [{ op: "add_block", block: { type: "image", src: "javascript:alert(1)", alt: "x" } }] })
    ).rejects.toThrow();
  });
});
