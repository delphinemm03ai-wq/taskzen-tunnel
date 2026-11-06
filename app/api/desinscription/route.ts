import { NextRequest } from "next/server";
import { markUnsubscribed } from "@/lib/supabase";
import { isValidUnsubscribeToken } from "@/lib/sequences/unsubscribe";
import { esc } from "@/lib/page-format/render";

export const dynamic = "force-dynamic";

function page(title: string, content: string, status = 200) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#090b1e;color:#f3f0f9;font:17px/1.6 system-ui,sans-serif;padding:20px;box-sizing:border-box">
<main style="max-width:460px;background:#1b1c36;border:1px solid #313047;border-radius:1.5rem;padding:28px"><h1 style="font-size:1.4rem;margin:0 0 12px">${esc(title)}</h1>${content}</main></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

const invalid = () => page("Lien invalide", "<p>Ce lien de désinscription n'est pas valable. Réponds à l'un de mes e-mails, je m'en occupe.</p>", 400);

/** Le lien n'agit pas tout seul : les antivirus de messagerie ouvrent les liens, ils désinscriraient les gens à leur insu. */
export async function GET(req: NextRequest) {
  const c = req.nextUrl.searchParams.get("c") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!isValidUnsubscribeToken(c, t, process.env.CRON_SECRET)) return invalid();
  return page(
    "Te désinscrire ?",
    `<p>Tu ne recevras plus mes e-mails automatiques.</p><form method="post" action="/api/desinscription?c=${encodeURIComponent(c)}&t=${encodeURIComponent(t)}"><button style="min-height:48px;padding:.75rem 1.6rem;border:0;border-radius:999px;background:linear-gradient(135deg,#8a55e0,#6a3fc0);color:#fff;font:600 1rem system-ui,sans-serif;cursor:pointer">Oui, me désinscrire</button></form>`
  );
}

/** Reçoit aussi le « désinscription en un clic » des messageries (List-Unsubscribe-Post). */
export async function POST(req: NextRequest) {
  const c = req.nextUrl.searchParams.get("c") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!isValidUnsubscribeToken(c, t, process.env.CRON_SECRET)) return invalid();
  try {
    await markUnsubscribed(c);
    return page("C'est fait", "<p>Tu es bien désinscrit(e). Tu ne recevras plus mes e-mails automatiques.</p>");
  } catch (err) {
    console.error("[desinscription] error:", err instanceof Error ? err.message : String(err));
    return page("Ça n'a pas marché", "<p>Ta désinscription n'a pas pu être enregistrée. Réessaie dans un instant, ou réponds à l'un de mes e-mails.</p>", 500);
  }
}
