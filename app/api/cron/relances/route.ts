import { NextRequest } from "next/server";
import { success, errors } from "@/lib/api-response";
import { listLeadsForFollowup, markFollowupSent } from "@/lib/airtable";
import { sendFollowupEmail, isResendConfigured, type FollowupStage } from "@/lib/resend";

const STAGES: { stage: FollowupStage; minDays: number }[] = [
  { stage: "j7", minDays: 7 },
  { stage: "j4", minDays: 4 },
  { stage: "j2", minDays: 2 },
];

function daysSince(dateStr: string): number {
  const created = new Date(`${dateStr}T00:00:00Z`).getTime();
  const now = Date.now();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

/**
 * Appelée une fois par jour par le cron Vercel (voir vercel.json).
 * Pour chaque lead encore "optin", envoie la relance la plus avancée qui
 * est due et pas encore envoyée (j7 avant j4 avant j2, pour ne pas envoyer
 * j2 à un lead qui a déjà 8 jours et jamais reçu ses relances).
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return errors.unauthorized("Secret invalide");
  }

  if (!isResendConfigured()) {
    return success({ sent: 0, skipped: "resend_not_configured" });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://taskzen.fr";
  const leads = await listLeadsForFollowup();

  let sent = 0;
  const failures: { email: string; reason?: string }[] = [];

  for (const lead of leads) {
    if (!lead.email) continue;
    const age = daysSince(lead.createdAt);

    const due = STAGES.find(({ stage, minDays }) => {
      if (age < minDays) return false;
      if (stage === "j2" && lead.relanceJ2Sent) return false;
      if (stage === "j4" && lead.relanceJ4Sent) return false;
      if (stage === "j7" && lead.relanceJ7Sent) return false;
      return true;
    });

    if (!due) continue;

    const result = await sendFollowupEmail({
      stage: due.stage,
      to: lead.email,
      firstName: lead.firstName,
      siteUrl,
    });

    if (result.ok) {
      await markFollowupSent(lead.id, due.stage);
      sent++;
    } else {
      failures.push({ email: lead.email, reason: result.reason });
    }
  }

  if (failures.length) {
    console.error("[cron/relances] envois échoués:", failures);
  }

  return success({ sent, failed: failures.length, total: leads.length });
}
