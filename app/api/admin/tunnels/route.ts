import { NextRequest } from "next/server";
import { success, errors } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/admin-auth";
import { getStore } from "@/lib/store";
import { listTunnelsForAdmin } from "@/lib/pages-api";

export const dynamic = "force-dynamic";

/** Tableau de bord du serveur d'outils : tunnels et pages (sans leur contenu). */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return errors.unauthorized("Secret invalide");
  try {
    return success(await listTunnelsForAdmin(getStore()));
  } catch (e) {
    console.error("[admin/tunnels] error:", e instanceof Error ? e.message : e);
    return errors.internal("Lecture des tunnels impossible");
  }
}
