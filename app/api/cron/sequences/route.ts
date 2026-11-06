import { NextRequest } from "next/server";
import { success, errors } from "@/lib/api-response";
import { isResendConfigured } from "@/lib/resend";
import { isSupabaseConfigured } from "@/lib/supabase";
import { runSequences } from "@/lib/sequences/engine";
import { SupabaseSequenceRepo } from "@/lib/sequences/supabase-repo";
import { sendSequenceEmail } from "@/lib/sequences/mailer";

export const dynamic = "force-dynamic";

/**
 * Envoie les e-mails de séquence arrivés à échéance. Appelée toutes les 5 minutes depuis l'extérieur.
 * La pause et le plafond par passage respectent la limite de débit de Resend ; le reste part au passage suivant.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return errors.unauthorized("Secret invalide");
  }
  if (!isResendConfigured() || !isSupabaseConfigured()) {
    return success({ sent: 0, skipped: "not_configured" });
  }
  try {
    return success(await runSequences(new SupabaseSequenceRepo(), sendSequenceEmail, { maxSends: 50, pauseMs: 600 }));
  } catch (err) {
    console.error("[cron/sequences] error:", err instanceof Error ? err.message : String(err));
    return errors.internal("Envoi des séquences impossible");
  }
}
