import { NextRequest, after } from "next/server";
import { optinSchema } from "@/lib/schemas";
import { success, errors } from "@/lib/api-response";
import {
  createLead,
  findLeadByEmail,
  updateLead,
  isAirtableConfigured,
} from "@/lib/airtable";
import { sendResourceEmail, isResendConfigured } from "@/lib/resend";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const RATE_LIMIT = { limit: 5, windowSeconds: 60 };

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const { allowed } = checkRateLimit(`lead:${ip}`, RATE_LIMIT);
    if (!allowed) {
      return errors.tooManyRequests("Trop de requêtes. Réessaie dans une minute.");
    }

    const body = await req.json();
    const parsed = optinSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return errors.badRequest(firstError?.message || "Données invalides");
    }

    const { email, firstName, utmSource, utmMedium, utmCampaign } = parsed.data;
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // Envoi de la ressource par email (non bloquant). No-op si Resend non configuré.
    if (isResendConfigured()) {
      after(async () => {
        const result = await sendResourceEmail({ to: email, firstName, siteUrl });
        if (!result.ok) console.error(`[lead] envoi ressource échoué (${email}):`, result.reason);
      });
    }

    // Mode démo : pas d'Airtable -> on accepte quand même le lead.
    if (!isAirtableConfigured()) {
      console.log("[lead] mode démo (Airtable non configuré):", email);
      return success({ id: `demo_${Date.now()}`, demo: true }, 201);
    }

    const utm = {
      ...(utmSource && { "UTM Source": utmSource }),
      ...(utmMedium && { "UTM Medium": utmMedium }),
      ...(utmCampaign && { "UTM Campaign": utmCampaign }),
    };

    const existing = await findLeadByEmail(email);
    if (existing) {
      const updated = await updateLead(existing.id, {
        ...(firstName && { Prenom: firstName }),
        Statut: "optin",
        ...utm,
      });
      return success({ id: updated.id });
    }

    const record = await createLead({
      Email: email,
      ...(firstName && { Prenom: firstName }),
      Statut: "optin",
      Source: "Tunnel",
      ...utm,
    });

    return success({ id: record.id }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/lead] error:", message);
    return errors.internal("Erreur lors de l'enregistrement du lead.");
  }
}
