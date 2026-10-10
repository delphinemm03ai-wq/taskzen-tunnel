import { NextRequest, after } from "next/server";
import { funnelOptinSchema } from "@/lib/schemas";
import { success, errors } from "@/lib/api-response";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  ensureTags,
  isSupabaseConfigured,
  tagContact,
  upsertContact,
} from "@/lib/supabase";
import { isResendConfigured, sendFunnelConfirmationEmail } from "@/lib/resend";
import { getFunnel } from "@/funnels";
import type { OptinBlock } from "@/types/funnel";

const RATE_LIMIT = { limit: 5, windowSeconds: 60 };

/**
 * Opt-in du moteur de pages (bloc `optin`).
 *
 * Ordre imposé : rate-limit, validation, honeypot, puis seulement Supabase,
 * et l'email dans after() une fois le contact écrit. Une soumission refusée
 * ou un robot ne persistent rien et n'envoient rien.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const { allowed } = checkRateLimit(`optin:${ip}`, RATE_LIMIT);
    if (!allowed) {
      return errors.tooManyRequests("Trop de requêtes. Réessaie dans une minute.");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errors.badRequest("Données invalides");
    }
    const parsed = funnelOptinSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return errors.badRequest(firstError?.message || "Données invalides");
    }

    const { email, firstName, funnel: funnelSlug, step: stepSlug, website } = parsed.data;

    // Le tunnel, l'étape et son bloc optin viennent de la config, jamais du client.
    const funnel = getFunnel(funnelSlug);
    const step = funnel?.etapes.find((e) => e.slug === stepSlug);
    const block = step?.blocs.find((b): b is OptinBlock => b.type === "optin");
    if (!funnel || !block) {
      return errors.badRequest("Formulaire inconnu");
    }
    const nextStep = funnel.etapes.find((e) => e.slug === block.etapeSuivante);
    if (!nextStep) {
      return errors.badRequest("Étape suivante inconnue");
    }
    const redirectTo = `/t/${funnel.slug}/${nextStep.slug}`;

    // Honeypot rempli : réponse neutre, identique à un succès, sans rien écrire ni envoyer.
    if (website && website.trim() !== "") {
      return success({ redirectTo });
    }

    if (block.prenomRequis && !firstName) {
      return errors.badRequest("Le prénom est requis");
    }

    if (!isSupabaseConfigured()) {
      console.error("[optin] Supabase non configuré");
      return errors.internal("Inscription indisponible pour le moment. Réessaie plus tard.");
    }

    // Idempotent : même email = même contact, tag déjà posé ignoré.
    const contact = await upsertContact({ email, firstName });
    const tags = await ensureTags([block.tag]);
    await tagContact(
      contact.id,
      tags.map((t) => t.id)
    );

    // Email de confirmation APRÈS l'écriture réussie, non bloquant. No-op si Resend non configuré.
    if (isResendConfigured()) {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      after(async () => {
        const result = await sendFunnelConfirmationEmail({
          to: email,
          firstName,
          subject: block.email.objet,
          title: block.email.titre,
          text: block.email.texte,
          buttonLabel: block.email.boutonTexte,
          buttonUrl: `${siteUrl}${redirectTo}`,
        });
        if (result.ok) {
          console.log(`[optin] email de confirmation envoyé (${funnel.slug}/${step?.slug})`);
        } else {
          console.error(`[optin] envoi confirmation échoué (${email}):`, result.reason);
        }
      });
    } else {
      console.log("[optin] Resend non configuré : email de confirmation ignoré");
    }

    return success({ redirectTo });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/optin] error:", message);
    return errors.internal("Erreur lors de l'inscription. Réessaie dans un instant.");
  }
}
