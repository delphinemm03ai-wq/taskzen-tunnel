import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { success, errors } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";
import { patchPageFromEditor, readPageForEditor } from "@/lib/pages-api";
import { PageError } from "@/lib/page-format/ops";

export const dynamic = "force-dynamic";

/** Éditeur visuel : lit une page (admin). Mêmes données que l'outil MCP get_page. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return errors.unauthorized("Secret invalide");
  const res = await readPageForEditor(getStore(), (await params).id);
  return res ? success(res) : errors.notFound("Page introuvable");
}

/**
 * Éditeur visuel : enregistre uniquement les changements (mêmes opérations que update_page).
 * Version attendue obligatoire : si l'IA a modifié la page entre-temps, réponse 409 et la page n'est pas écrasée.
 * La réponse 409 contient la version actuelle pour que l'éditeur la recharge sans autre appel.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(req)) return errors.unauthorized("Secret invalide");
  const { id } = await params;
  let body: { changes?: unknown; expected_version?: unknown };
  try {
    body = await req.json();
  } catch {
    return errors.badRequest("Données invalides");
  }
  if (typeof body.expected_version !== "number") return errors.badRequest("expected_version est obligatoire");
  try {
    return success(await patchPageFromEditor(getStore(), id, { changes: body.changes, expected_version: body.expected_version }));
  } catch (e) {
    if (e instanceof PageError && e.code === "version_conflict") {
      const current = await readPageForEditor(getStore(), id);
      return Response.json({ ok: false, error: { code: "version_conflict", message: e.message }, current }, { status: 409 });
    }
    if (e instanceof PageError) return errors.badRequest(e.message, e.code === "page_not_found" ? 404 : 400);
    if (e instanceof ZodError) return errors.badRequest(e.issues[0]?.message ?? "Changements invalides");
    console.error("[admin/pages] error:", e instanceof Error ? e.message : e);
    return errors.internal("Enregistrement impossible");
  }
}
