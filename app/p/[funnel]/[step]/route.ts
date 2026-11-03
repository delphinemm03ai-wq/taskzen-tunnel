import { NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { renderPageHtml } from "@/lib/page-format/render";

export const dynamic = "force-dynamic";

/** Page publique : rendue par le serveur à partir de la description publiée. Aucun appel à une IA. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ funnel: string; step: string }> }) {
  const { funnel, step } = await params;
  const rec = await getStore().findPublishedByPath(funnel, step);
  if (!rec || !rec.published) return new Response("Page introuvable", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(renderPageHtml(rec.published, { funnelSlug: funnel, stepSlug: step }), { headers: { "content-type": "text/html; charset=utf-8" } });
}
