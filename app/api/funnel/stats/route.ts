import { NextRequest } from "next/server";
import { success, errors } from "@/lib/api-response";
import { countEvent, isPostHogQueryConfigured } from "@/lib/posthog-query";
import { FUNNEL_STEPS } from "@/lib/events";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const adminSecret = process.env.ADMIN_SECRET;

  if (!adminSecret || secret !== adminSecret) {
    return errors.unauthorized("Secret invalide");
  }

  if (!isPostHogQueryConfigured()) {
    return errors.internal("PostHog non configuré (POSTHOG_PERSONAL_API_KEY / POSTHOG_PROJECT_ID).");
  }

  const days = Math.min(
    parseInt(req.nextUrl.searchParams.get("days") || "30", 10),
    90
  );

  try {
    const counts = await Promise.all(FUNNEL_STEPS.map((s) => countEvent(s.event, days)));
    const steps = FUNNEL_STEPS.map((s, i) => ({
      key: s.key,
      label: s.label,
      count: counts[i] ?? 0,
    }));
    return success({ days, steps });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[funnel/stats] error:", message);
    return errors.internal(message);
  }
}
