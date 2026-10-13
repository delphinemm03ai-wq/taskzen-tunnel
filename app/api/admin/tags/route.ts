import { NextRequest } from "next/server";
import { success, errors } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/admin-auth";
import { isSupabaseConfigured, listTagNames } from "@/lib/supabase";

/** Noms de tags existants, pour le filtre de l'onglet Contacts. */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return errors.unauthorized("Secret invalide");
  if (!isSupabaseConfigured()) {
    return errors.internal("Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  try {
    return success({ tags: await listTagNames() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/tags] error:", message);
    return errors.internal(message);
  }
}
