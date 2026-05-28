/**
 * Resend — envoi de la ressource par email après l'opt-in.
 *
 * Si RESEND_API_KEY / RESEND_FROM_EMAIL ne sont pas configurés,
 * isResendConfigured() renvoie false et l'envoi est ignoré (mode démo).
 * Lance /onboarding pour configurer Resend.
 */

import config from "@/config";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

export function isResendConfigured(): boolean {
  return Boolean(RESEND_API_KEY && RESEND_FROM_EMAIL);
}

function resourceEmailHtml(siteUrl: string): string {
  const resourceUrl = `${siteUrl}/ressource`;
  const title = config.resource.title;
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#1c1917;">
    <h1 style="font-size:22px;color:${config.brand.colorPrimary};">${title}</h1>
    <p>Merci pour ton inscription !</p>
    <p>Voici l'accès à ta ressource :</p>
    <p style="margin:28px 0;">
      <a href="${resourceUrl}"
         style="background:${config.brand.colorPrimary};color:#fff;text-decoration:none;
                padding:14px 26px;border-radius:999px;font-weight:600;display:inline-block;">
        Accéder à ma ressource
      </a>
    </p>
    <p style="color:#57534e;font-size:14px;">À très vite,<br/>${config.legal.companyName}</p>
  </div>`;
}

export async function sendResourceEmail(input: {
  to: string;
  firstName?: string;
  siteUrl: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!isResendConfigured()) {
    return { ok: false, reason: "resend_not_configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: input.to,
        subject: `${config.resource.title} — ton accès`,
        html: resourceEmailHtml(input.siteUrl),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, reason: `resend_error_${res.status}: ${text.slice(0, 120)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
