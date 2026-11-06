import { NextRequest } from "next/server";
import { funnelOptinSchema } from "@/lib/schemas";
import { success, errors } from "@/lib/api-response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { ensureTags, isSupabaseConfigured, tagContact, upsertContact } from "@/lib/supabase";
import { getStore } from "@/lib/store";
import { resolvePageSignup } from "@/lib/page-checkout";

export const dynamic = "force-dynamic";

const RATE_LIMIT = { limit: 5, windowSeconds: 60 };

/** Inscription depuis une page publiée (bloc signup_form). Même ordre que /api/optin : cadence, validation, leurre, puis écriture. */
export async function POST(req: NextRequest) {
  try {
    const { allowed } = checkRateLimit(`page-optin:${getClientIp(req.headers)}`, RATE_LIMIT);
    if (!allowed) return errors.tooManyRequests("Trop de requêtes. Réessaie dans une minute.");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errors.badRequest("Données invalides");
    }
    const parsed = funnelOptinSchema.safeParse(body);
    if (!parsed.success) return errors.badRequest(parsed.error.issues[0]?.message || "Données invalides");
    const { email, firstName, funnel, step, block, website } = parsed.data;

    if (website && website.trim() !== "") return success({});

    const signup = await resolvePageSignup(getStore(), funnel, step, block);
    if (!signup) return errors.badRequest("Formulaire inconnu");
    if (!isSupabaseConfigured()) {
      console.error("[page-optin] Supabase non configuré");
      return errors.internal("Inscription indisponible pour le moment. Réessaie plus tard.");
    }

    const contact = await upsertContact({ email, firstName });
    const tags = await ensureTags([signup.tag]);
    await tagContact(contact.id, tags.map((t) => t.id));
    return success({});
  } catch (err) {
    console.error("[/api/page-optin] error:", err instanceof Error ? err.message : String(err));
    return errors.internal("Erreur lors de l'inscription. Réessaie dans un instant.");
  }
}
