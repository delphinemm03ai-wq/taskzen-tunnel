import { MemoryStore } from "@/lib/store/store";
import { handleRpc, type CallerKey } from "@/lib/mcp/server";
import type { Mailer, ToolContext } from "@/lib/mcp/tools";

export class FakeMailer implements Mailer {
  sent: { to: string; subject: string; body: string }[] = [];
  async send(m: { to: string; subject: string; body: string }) {
    this.sent.push(m);
  }
}

let counter = 0;
export function makeEnv(scope: "rw" | "ro" = "rw") {
  const store = new MemoryStore();
  const mailer = new FakeMailer();
  const ctx: ToolContext = { store, mailer, baseUrl: "https://tunnel.test" };
  // clé unique par environnement : la limite de débit est partagée au niveau du module
  const caller: CallerKey = { id: `k${++counter}`, scope };
  async function call(tool: string, args: unknown) {
    const raw = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } });
    const res = await handleRpc(ctx, caller, JSON.parse(raw), Buffer.byteLength(raw));
    const result = (res!.result as { content: { text: string }[]; isError: boolean });
    const text = result.content[0].text;
    return { data: JSON.parse(text), isError: result.isError, responseBytes: Buffer.byteLength(text), requestBytes: Buffer.byteLength(raw) };
  }
  return { store, mailer, ctx, caller, call };
}

export const SAMPLE_FUNNEL = {
  name: "Coaching démo",
  steps: [
    {
      title: "Guide gratuit",
      kind: "capture",
      blocks: [
        { type: "heading", level: 1, text: "Reçois le guide" },
        { type: "text", text: "Cinq idées pour gagner du temps." },
        { type: "signup_form", label: "Je veux le guide", next_step: "@next" },
      ],
    },
    {
      title: "Offre",
      kind: "sales",
      blocks: [
        { type: "heading", text: "L'offre" },
        { type: "list", items: ["Un", "Deux", "Trois"] },
        { type: "faq", items: [{ question: "Combien ?", answer: "C'est un exemple." }] },
        { type: "payment_button", label: "Commander", product: "offre", price_cents: 9700 },
      ],
    },
    { title: "Merci", kind: "thanks", blocks: [{ type: "heading", text: "Merci !" }, { type: "button", label: "Retour", href: "@step:guide-gratuit" }] },
  ],
};

export const SAMPLE_SEQUENCE = {
  name: "Bienvenue",
  trigger: { type: "signup" },
  emails: [0, 24, 48, 96, 168].map((d, i) => ({ delay_hours: d, subject: `Email ${i + 1}`, body: `Contenu de l'email ${i + 1}.` })),
};
