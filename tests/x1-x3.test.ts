import { describe, expect, it, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { makeEnv, SAMPLE_FUNNEL, SAMPLE_SEQUENCE } from "./helpers";

describe("X1 : parcours complet sans navigateur (route MCP réelle, HTTP simulé)", () => {
  beforeAll(() => {
    process.env.TUNNEL_MCP_KEYS = "test:secret-factice-123:rw";
  });

  async function rpc(method: string, params: unknown, id: number | undefined = 1, token = "secret-factice-123") {
    const { POST } = await import("@/app/api/mcp/route");
    const req = new NextRequest("https://tunnel.test/api/mcp", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    return POST(req);
  }
  const tool = async (name: string, args: unknown) => {
    const res = await rpc("tools/call", { name, arguments: args });
    const body = await res.json();
    return JSON.parse(body.result.content[0].text);
  };

  it("refuse une requête sans clé valide", async () => {
    const res = await rpc("initialize", {}, 1, "mauvaise-cle");
    expect(res.status).toBe(401);
  });

  it("initialize et tools/list annoncent les outils", async () => {
    const init = await (await rpc("initialize", {})).json();
    expect(init.result.serverInfo.name).toBe("taskzen-tunnel");
    const list = await (await rpc("tools/list", {})).json();
    const names = list.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(expect.arrayContaining(["create_page", "update_page", "create_funnel", "schedule_email_sequence", "send_email_to_list", "publish_funnel"]));
    for (const t of list.result.tools) expect(t.inputSchema.type).toBe("object");
  });

  it("créer un tunnel, le publier, programmer des emails, puis lire la page publique", async () => {
    const created = await tool("create_funnel", SAMPLE_FUNNEL);
    expect(created.funnel_id).toMatch(/^fn_/);
    expect(created.steps).toHaveLength(3);

    const published = await tool("publish_funnel", { funnel_id: created.funnel_id });
    expect(published.status).toBe("published");

    const seq = await tool("schedule_email_sequence", SAMPLE_SEQUENCE);
    expect(seq.status).toBe("scheduled");

    const { GET } = await import("@/app/p/[funnel]/[step]/route");
    const url = new URL(created.steps[0].url);
    const [, , funnel, step] = url.pathname.split("/");
    const page = await GET(new NextRequest(created.steps[0].url), { params: Promise.resolve({ funnel, step }) });
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Reçois le guide");
    // le lien @next a été résolu vers l'étape suivante
    expect(html).toContain(`data-next="/p/${funnel}/offre"`);
  });

  it("une page non publiée n'est pas visible", async () => {
    const created = await tool("create_funnel", { ...SAMPLE_FUNNEL, name: "Brouillon seul" });
    const { GET } = await import("@/app/p/[funnel]/[step]/route");
    const u = new URL(created.steps[0].url).pathname.split("/");
    const res = await GET(new NextRequest(created.steps[0].url), { params: Promise.resolve({ funnel: u[2], step: u[3] }) });
    expect(res.status).toBe(404);
  });
});

describe("X2 : un tunnel de plusieurs pages en UN appel, sans HTML, taille mesurée", () => {
  it("un seul appel crée 3 pages, la demande ne contient aucun HTML, la taille est consignée", async () => {
    const { call, store } = makeEnv();
    const r = await call("create_funnel", SAMPLE_FUNNEL);
    expect(r.isError).toBe(false);
    expect(r.data.steps).toHaveLength(3);
    expect(JSON.stringify(SAMPLE_FUNNEL)).not.toMatch(/<\/?[a-z][^>]*>/i);
    const log = await store.callLog();
    expect(log).toHaveLength(1);
    expect(log[0].tool).toBe("create_funnel");
    expect(log[0].requestBytes).toBeGreaterThan(0);
    expect(log[0].requestBytes).toBe(r.requestBytes);
    console.log(`[X2] create_funnel 3 pages : demande ${log[0].requestBytes} octets, réponse ${log[0].responseBytes} octets`);
  });

  it("refuse un champ HTML (le format n'accepte que des blocs structurés)", async () => {
    const { call } = makeEnv();
    const r = await call("create_funnel", { name: "x", steps: [{ title: "a", blocks: [], html: "<p>x</p>" }] });
    expect(r.isError).toBe(true);
    expect(r.data.error).toBe("invalid_arguments");
  });

  it("tout ou rien : un lien cassé n'écrit aucune page", async () => {
    const { call, store } = makeEnv();
    const bad = { name: "casse", steps: [{ title: "a", blocks: [{ type: "button", label: "ok", href: "@step:nope" }] }] };
    const r = await call("create_funnel", bad);
    expect(r.data.error).toBe("unresolved_link");
    expect(await store.findFunnelBySlug("casse")).toBeNull();
  });
});

describe("X3 : séquence de 5 emails en UN appel", () => {
  it("un appel programme 5 emails avec leurs délais", async () => {
    const { call, store } = makeEnv();
    const r = await call("schedule_email_sequence", SAMPLE_SEQUENCE);
    expect(r.isError).toBe(false);
    expect(r.data.emails).toBe(5);
    expect((await store.callLog()).filter((c) => c.tool === "schedule_email_sequence")).toHaveLength(1);
    const seq = await store.getSequence(r.data.sequence_id);
    expect(seq!.emails.map((e) => e.delay_hours)).toEqual([0, 24, 48, 96, 168]);
    expect(seq!.exit_on).toEqual(["purchase", "unsubscribe"]);
  });

  it("n'envoie rien : programmer n'est pas envoyer", async () => {
    const { call, mailer } = makeEnv();
    await call("schedule_email_sequence", SAMPLE_SEQUENCE);
    expect(mailer.sent).toHaveLength(0);
  });

  it("exige la balise du déclencheur tag_added", async () => {
    const { call } = makeEnv();
    const r = await call("schedule_email_sequence", { ...SAMPLE_SEQUENCE, trigger: { type: "tag_added" } });
    expect(r.data.error).toBe("invalid_trigger");
  });
});
