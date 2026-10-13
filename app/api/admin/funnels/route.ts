import { NextRequest } from "next/server";
import { z } from "zod";
import { success, errors } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/admin-auth";
import { buildAdminFunnels } from "@/lib/admin-funnels";
import type { AdminPeriode } from "@/types/admin";

const querySchema = z.object({
  periode: z
    .enum(["7", "30", "90"], { errorMap: () => ({ message: "Période invalide (7, 30 ou 90 jours)" }) })
    .default("30"),
});

/** Onglet Tunnels de l'admin : structure depuis la config, vues PostHog, inscrits Supabase. */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return errors.unauthorized("Secret invalide");

  const parsed = querySchema.safeParse({ periode: req.nextUrl.searchParams.get("periode") ?? undefined });
  if (!parsed.success) return errors.badRequest(parsed.error.issues[0]?.message || "Paramètres invalides");

  const periode = Number(parsed.data.periode) as AdminPeriode;
  try {
    return success(await buildAdminFunnels(req.nextUrl.origin, periode));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/funnels] error:", message);
    return errors.internal(message);
  }
}
