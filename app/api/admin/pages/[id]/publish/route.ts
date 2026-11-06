import { NextRequest } from "next/server";
import { success, errors } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";
import { handlers, NotConfiguredMailer, ToolError } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";

/** Éditeur visuel : publie une page par le même outil que l'IA, donc avec la même protection des prix. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return errors.unauthorized("Secret invalide");
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  try {
    const ctx = { store: getStore(), mailer: new NotConfiguredMailer(), baseUrl: "" };
    return success(await handlers.publish_page(ctx, { page_id: id, confirm: body.confirm === true }));
  } catch (e) {
    if (e instanceof ToolError && e.code === "page_not_found") return errors.notFound("Page introuvable");
    if (e instanceof ToolError && e.code === "version_conflict") return errors.badRequest(e.message, 409);
    console.error("[admin/pages/publish] error:", e instanceof Error ? e.message : e);
    return errors.internal("Publication impossible");
  }
}
