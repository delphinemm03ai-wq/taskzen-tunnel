import { describe, expect, it, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { newPage, applyChanges, type Change } from "@/lib/page-format/ops";
import type { Block, Page } from "@/lib/page-format/schema";
import { renderPageHtml } from "@/lib/page-format/render";
import { diffPages, samePage } from "@/lib/editor/diff";
import { edit, initState, isDirty, markSaved, pendingOps, rebaseOnServer, redo, undo, MAX_UNDO } from "@/lib/editor/history";
import { cloneWithNewIds, defaultBlock, locate } from "@/lib/editor/tree";
import { BLOCK_TYPES } from "@/lib/page-format/schema";

function sample(): Page {
  return newPage("pg_ed", {
    title: "Page de test",
    blocks: [
      { id: "h", type: "heading", level: 1, text: "Titre" },
      { id: "t", type: "text", text: "Texte" },
      { id: "s", type: "section", title: "Section", children: [{ id: "s1", type: "text", text: "Dedans" }, { id: "s2", type: "button", label: "Go", href: "/x" }] },
      { id: "c", type: "columns", columns: [[{ id: "c1", type: "text", text: "G" }], [{ id: "c2", type: "text", text: "D" }]] },
      { id: "b", type: "button", label: "Fin", href: "https://exemple.fr", settings: { align: "center", color: "#7d51d2" } },
    ],
  });
}
const NOW = 1_000_000;
const ids = (p: Page) => (p.blocks as Block[]).map((b) => b.id);

describe("annuler / rétablir (20 actions)", () => {
  it("annule et rétablit une modification", () => {
    let s = initState(sample(), 1);
    s = edit(s, [{ op: "set_title", title: "Autre" }], { now: NOW });
    expect(s.page.title).toBe("Autre");
    s = undo(s);
    expect(s.page.title).toBe("Page de test");
    s = redo(s);
    expect(s.page.title).toBe("Autre");
  });

  it("garde seulement les 20 dernières actions", () => {
    let s = initState(sample(), 1);
    for (let i = 0; i < 30; i++) s = edit(s, [{ op: "set_title", title: `T${i}` }], { now: NOW + i * 5000 });
    expect(s.undo).toHaveLength(MAX_UNDO);
    for (let i = 0; i < 25; i++) s = undo(s);
    expect(s.page.title).toBe("T9"); // 30 modifications, 20 annulées : on revient à la 10e
    expect(s.redo).toHaveLength(MAX_UNDO);
  });

  it("une nouvelle édition vide la pile de rétablissement", () => {
    let s = initState(sample(), 1);
    s = edit(s, [{ op: "set_title", title: "A" }], { now: NOW });
    s = undo(s);
    s = edit(s, [{ op: "set_title", title: "B" }], { now: NOW + 5000 });
    expect(s.redo).toHaveLength(0);
  });

  it("les frappes rapides dans un même champ comptent pour une seule action", () => {
    let s = initState(sample(), 1);
    "Bonjour".split("").forEach((_, i) => {
      s = edit(s, [{ op: "set_props", block_id: "t", props: { text: "Bonjour".slice(0, i + 1) } }], { key: "t:text", now: NOW + i * 100 });
    });
    expect(s.undo).toHaveLength(1);
    s = undo(s);
    expect((s.page.blocks[1] as Block).text).toBe("Texte");
    // une pause de plus d'une seconde commence une nouvelle action
    s = edit(s, [{ op: "set_props", block_id: "t", props: { text: "x" } }], { key: "t:text", now: NOW });
    s = edit(s, [{ op: "set_props", block_id: "t", props: { text: "xy" } }], { key: "t:text", now: NOW + 3000 });
    expect(s.undo).toHaveLength(2);
  });

  it("une valeur refusée par le format ne change rien", () => {
    const s = initState(sample(), 1);
    expect(() => edit(s, [{ op: "set_props", block_id: "b", props: { href: "javascript:alert(1)" } }], { now: NOW })).toThrow();
    expect(isDirty(s)).toBe(false);
  });
});

describe("conversion édition vers opérations (X5)", () => {
  it("rien n'a changé : aucune opération", () => {
    expect(diffPages(sample(), sample())).toEqual([]);
  });

  it("un titre changé donne une seule opération minuscule", () => {
    const s = edit(initState(sample(), 1), [{ op: "set_title", title: "Nouveau" }], { now: NOW });
    expect(pendingOps(s)).toEqual([{ op: "set_title", title: "Nouveau" }]);
  });

  it("un texte changé donne un set_props avec la seule propriété modifiée", () => {
    const s = edit(initState(sample(), 1), [{ op: "set_props", block_id: "t", props: { text: "Autre" } }], { now: NOW });
    expect(pendingOps(s)).toEqual([{ op: "set_props", block_id: "t", props: { text: "Autre" } }]);
  });

  it("réglage vidé : la propriété est retirée (null), le partage aussi", () => {
    let s = initState(sample(), 1);
    s = edit(s, [{ op: "set_props", block_id: "b", props: { settings: null } }, { op: "set_share", share: { title: "Partage" } }], { now: NOW });
    s = markSaved(s, s.page, 2);
    s = edit(s, [{ op: "set_share", share: { title: null } }], { now: NOW + 5000 });
    expect(pendingOps(s)).toEqual([{ op: "set_share", share: { title: null } }]);
    const back = applyChanges(s.saved, pendingOps(s)).page;
    expect(back.share).toEqual({});
  });

  it("ajout, déplacement, suppression et copie se convertissent et se rejouent à l'identique", () => {
    const base = sample();
    let s = initState(base, 1);
    const copy = cloneWithNewIds((base.blocks as Block[])[2]); // copie de la section avec ses enfants
    s = edit(s, [
      { op: "add_block", block: defaultBlock("faq"), after_id: "h" },
      { op: "add_block", block: copy as Record<string, unknown>, after_id: "b" },
      { op: "move_block", block_id: "b", after_id: undefined },
      { op: "move_block", block_id: "c2", parent_id: "s", after_id: "s1" }, // d'une colonne vers une section
      { op: "remove_block", block_id: "t" },
      { op: "set_props", block_id: "s2", props: { label: "Autre libellé" } },
    ], { now: NOW });
    const ops = pendingOps(s);
    expect(samePage(applyChanges(base, ops).page, s.page)).toBe(true);
    expect(ops.length).toBeLessThan(12);
  });

  it("supprimer une section qui contient un bloc déplacé ailleurs garde ce bloc", () => {
    const base = sample();
    const s = edit(initState(base, 1), [{ op: "move_block", block_id: "s1", after_id: "h" }, { op: "remove_block", block_id: "s" }], { now: NOW });
    const ops = pendingOps(s);
    expect(samePage(applyChanges(base, ops).page, s.page)).toBe(true);
    expect(ids(s.page)).toContain("s1");
  });

  it("annuler après un enregistrement produit les opérations inverses", () => {
    let s = initState(sample(), 1);
    s = edit(s, [{ op: "remove_block", block_id: "h" }], { now: NOW });
    s = markSaved(s, s.page, 2); // enregistré sans le titre
    s = undo(s); // la page locale retrouve le titre
    expect(isDirty(s)).toBe(true);
    const ops = pendingOps(s);
    expect(ops).toHaveLength(1); // le titre est remis en place en une seule opération
    expect(samePage(applyChanges(s.saved, ops).page, s.page)).toBe(true);
  });

  it("scénarios aléatoires : les opérations produites rejouent toujours la page éditée (300 séries)", () => {
    let seed = 42;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n);
    for (let run = 0; run < 300; run++) {
      const base = sample();
      let s = initState(base, 1);
      for (let k = 0; k < 1 + rnd(8); k++) {
        const all: string[] = [];
        const collect = (l: Block[]) => l.forEach((b) => { all.push(b.id as string); (b.type === "section" ? [b.children as Block[]] : b.type === "columns" ? (b.columns as Block[][]) : []).forEach(collect); });
        collect(s.page.blocks as Block[]);
        const pick = () => all[rnd(all.length)];
        const kind = rnd(5);
        let ch: Change | null = null;
        if (kind === 0) ch = { op: "add_block", block: defaultBlock(BLOCK_TYPES[rnd(BLOCK_TYPES.length)]), after_id: rnd(2) ? pick() : undefined, ...(rnd(2) ? {} : {}) };
        else if (kind === 1 && all.length > 2) ch = { op: "remove_block", block_id: pick() };
        else if (kind === 2) ch = { op: "move_block", block_id: pick(), after_id: pick() };
        else if (kind === 3) ch = { op: "set_props", block_id: "t", props: { text: `v${rnd(1000)}` } };
        else ch = { op: "set_title", title: `Titre ${rnd(100)}` };
        try {
          s = edit(s, [ch], { now: NOW + (run * 10 + k) * 5000 });
        } catch {
          /* opération refusée par le format (parent différent, etc.) : on passe */
        }
        if (rnd(6) === 0) s = undo(s);
      }
      const ops = pendingOps(s); // lève une erreur si le rejeu ne redonne pas la page
      expect(samePage(ops.length ? applyChanges(s.saved, ops).page : s.saved, s.page)).toBe(true);
    }
  });

  it("locate retrouve parent, colonne et position", () => {
    const p = sample();
    expect(locate(p, "c2")).toMatchObject({ parent_id: "c", column: 1, index: 0 });
    expect(locate(p, "s2")).toMatchObject({ parent_id: "s", index: 1 });
    expect(locate(p, "t")).toMatchObject({ parent_id: undefined, index: 1 });
  });
});

describe("conflit de version : l'IA a modifié la page entre-temps", () => {
  it("les modifications de l'IA sont gardées et les modifications locales reportées dessus", () => {
    const base = sample();
    let local = initState(base, 1);
    local = edit(local, [{ op: "set_props", block_id: "t", props: { text: "Ma version" } }], { now: NOW });
    const ai = applyChanges(base, [{ op: "set_title", title: "Titre de l'IA" }]).page;
    const r = rebaseOnServer(local, ai, 2);
    expect(r.kept).toBe(true);
    expect(r.hadLocalChanges).toBe(true);
    expect(r.state.version).toBe(2);
    expect(r.state.page.title).toBe("Titre de l'IA"); // l'IA n'est pas écrasée
    expect((r.state.page.blocks[1] as Block).text).toBe("Ma version");
    expect(pendingOps(r.state)).toEqual([{ op: "set_props", block_id: "t", props: { text: "Ma version" } }]);
  });

  it("si l'IA a supprimé le bloc que je modifiais, mes modifications sont abandonnées et signalées", () => {
    const base = sample();
    let local = initState(base, 1);
    local = edit(local, [{ op: "set_props", block_id: "t", props: { text: "Ma version" } }], { now: NOW });
    const ai = applyChanges(base, [{ op: "remove_block", block_id: "t" }]).page;
    const r = rebaseOnServer(local, ai, 2);
    expect(r.kept).toBe(false);
    expect(r.hadLocalChanges).toBe(true);
    expect(samePage(r.state.page, ai)).toBe(true);
    expect(isDirty(r.state)).toBe(false);
  });

  it("sans modification locale, la version de l'IA est simplement chargée", () => {
    const base = sample();
    const ai = applyChanges(base, [{ op: "set_title", title: "IA" }]).page;
    const r = rebaseOnServer(initState(base, 1), ai, 3);
    expect(r.hadLocalChanges).toBe(false);
    expect(r.state.page.title).toBe("IA");
  });
});

describe("rendu en mode édition", () => {
  it("même moteur que le public, sans script public, avec cadres de sélection", () => {
    const p = sample();
    const pub = renderPageHtml(p);
    const ed = renderPageHtml(p, { editor: true });
    expect(pub).toContain("<script>");
    expect(ed).not.toContain("<script>");
    expect(ed).toContain("ed-sel");
    expect(ed).toContain('data-block="t"');
    // Seules différences voulues du public : le script et le pied de page légal (lien non cliquable dans l'éditeur).
    expect(ed.replace(/<style>[\s\S]*?<\/style>/, "")).toBe(pub.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<script>[\s\S]*?<\/script>/, "").replace(/<footer class="tz-foot">[\s\S]*?<\/footer>/, ""));
  });
});

describe("X7 : page créée par l'outil MCP, modifiée par l'éditeur, relue par l'IA (routes réelles)", () => {
  beforeAll(() => {
    process.env.TUNNEL_MCP_KEYS = "x7:cle-factice-x7:rw";
    process.env.ADMIN_SECRET = "secret-admin-factice";
    process.env.TUNNEL_STORE = "memory";
  });

  async function mcp(name: string, args: unknown) {
    const { POST } = await import("@/app/api/mcp/route");
    const res = await POST(new NextRequest("https://t.test/api/mcp", { method: "POST", headers: { authorization: "Bearer cle-factice-x7" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }));
    return JSON.parse((await res.json()).result.content[0].text);
  }
  async function admin(method: "GET" | "PATCH", id: string, body?: unknown, secret = "secret-admin-factice") {
    const route = await import("@/app/api/admin/pages/[id]/route");
    const req = new NextRequest(`https://t.test/api/admin/pages/${id}`, { method, headers: { "x-admin-secret": secret }, body: body ? JSON.stringify(body) : undefined });
    const res = await (method === "GET" ? route.GET : route.PATCH)(req, { params: Promise.resolve({ id }) });
    return { status: res.status, json: await res.json() };
  }

  it("l'éditeur ouvre la page de l'IA, l'enregistre par différence, l'IA relit la modification", async () => {
    const created = await mcp("create_page", { title: "Page IA", blocks: [{ id: "h", type: "heading", text: "Bonjour" }, { id: "t", type: "text", text: "Texte" }] });
    const opened = await admin("GET", created.page_id);
    expect(opened.status).toBe(200);
    let s = initState(opened.json.data.page, opened.json.data.version);

    s = edit(s, [{ op: "set_props", block_id: "h", props: { text: "Modifié à la souris" } }, { op: "add_block", block: defaultBlock("divider"), after_id: "t" }], { now: NOW });
    const ops = pendingOps(s);
    const saved = await admin("PATCH", created.page_id, { changes: ops, expected_version: s.version });
    expect(saved.status).toBe(200);
    expect(saved.json.data.version).toBe(2);

    const reread = await mcp("get_page", { page_id: created.page_id });
    expect(reread.version).toBe(2);
    expect(reread.page.blocks[0].text).toBe("Modifié à la souris");
    expect(reread.page.blocks).toHaveLength(3);
    expect(samePage(reread.page, s.page)).toBe(true);
  });

  it("l'IA modifie la page pendant que l'éditeur travaille : conflit signalé, rien n'est écrasé", async () => {
    const created = await mcp("create_page", { title: "Conflit", blocks: [{ id: "t", type: "text", text: "Texte" }] });
    const opened = await admin("GET", created.page_id);
    let s = initState(opened.json.data.page, opened.json.data.version);
    s = edit(s, [{ op: "set_props", block_id: "t", props: { text: "Version humaine" } }], { now: NOW });

    await mcp("update_page", { page_id: created.page_id, changes: [{ op: "set_title", title: "Titre IA" }] }); // l'IA passe avant

    const res = await admin("PATCH", created.page_id, { changes: pendingOps(s), expected_version: s.version });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe("version_conflict");
    expect(res.json.current.page.title).toBe("Titre IA");
    // rien n'a été écrit par l'éditeur
    expect((await mcp("get_page", { page_id: created.page_id })).page.blocks[0].text).toBe("Texte");

    // l'éditeur recharge et reporte ses modifications, puis enregistre sur la bonne version
    const r = rebaseOnServer(s, res.json.current.page, res.json.current.version);
    expect(r.kept).toBe(true);
    const ok = await admin("PATCH", created.page_id, { changes: pendingOps(r.state), expected_version: r.state.version });
    expect(ok.status).toBe(200);
    const final = await mcp("get_page", { page_id: created.page_id });
    expect(final.page.title).toBe("Titre IA");
    expect(final.page.blocks[0].text).toBe("Version humaine");
  });

  it("l'API de l'éditeur exige le secret admin et la version attendue", async () => {
    const created = await mcp("create_page", { title: "Garde", blocks: [] });
    expect((await admin("GET", created.page_id, undefined, "mauvais")).status).toBe(401);
    expect((await admin("PATCH", created.page_id, { changes: [{ op: "set_title", title: "x" }] })).status).toBe(400);
    expect((await admin("PATCH", created.page_id, { changes: [{ op: "set_title", title: "x" }], expected_version: 1 }, "mauvais")).status).toBe(401);
  });
});
