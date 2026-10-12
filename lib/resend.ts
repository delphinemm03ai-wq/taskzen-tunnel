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
    <p style="color:#57534e;font-size:14px;">À très vite,<br/>Delphine Moura-Miranda - Automatisation IA<br/>Taskzen</p>
  </div>`;
}

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
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
        subject: input.subject,
        html: input.html,
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

export async function sendResourceEmail(input: {
  to: string;
  firstName?: string;
  siteUrl: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return sendEmail({
    to: input.to,
    subject: `${config.resource.title} — ton accès`,
    html: resourceEmailHtml(input.siteUrl),
  });
}

/**
 * Séquence de relance J+2 / J+4 / J+7 pour les leads qui ont reçu la
 * ressource mais n'ont pas encore réservé leur diagnostic. Contenu source :
 * memory/funnel/sequence-emails-relance.md
 */
export type FollowupStage = "j2" | "j4" | "j7";

function bookingButton(siteUrl: string): string {
  return `
    <p style="margin:28px 0;">
      <a href="${siteUrl}/reserver"
         style="background:${config.brand.colorPrimary};color:#fff;text-decoration:none;
                padding:14px 26px;border-radius:999px;font-weight:600;display:inline-block;">
        Réserver mon diagnostic gratuit
      </a>
    </p>`;
}

function signature(): string {
  return `<p style="color:#57534e;font-size:14px;">À très vite,<br/>Delphine Moura-Miranda - Automatisation IA<br/>Taskzen</p>`;
}

const FOLLOWUP_CONTENT: Record<
  FollowupStage,
  { subject: string; body: (firstName: string) => string }
> = {
  j2: {
    subject: "Le calcul que tu n'as peut-être pas fait",
    body: (firstName) => `
      <p>Hello ${firstName || "toi"},</p>
      <p>Une question simple en attendant la vidéo.</p>
      <p>Combien de temps tu passes chaque semaine à répondre aux mêmes questions sur WhatsApp ? Tarifs, dispo, programme.</p>
      <p>Si c'est 10 heures, fais le calcul avec ton tarif horaire. La plupart des coachs tombent autour de 2000€ par mois de temps non facturé.</p>
      <p>Ce n'est pas une critique. C'est juste le prix de répondre soi-même à tout, tout le temps.</p>
      <p>Le diagnostic de 30 minutes sert exactement à ça : on regarde ensemble tes messages et on chiffre ce que TOI tu peux récupérer.</p>`,
  },
  j4: {
    subject: '"Mes clients vont détester parler à un robot"',
    body: (firstName) => `
      <p>Hello ${firstName || "toi"},</p>
      <p>C'est la question qu'on me pose le plus souvent. Légitime.</p>
      <p>Sauf que ce n'est pas un chatbot générique qui répond à côté de la plaque. C'est un système qui répond dans TON ton, avec TES réponses type, sur les questions que tes clients posent déjà 50 fois par mois.</p>
      <p>Résultat : le client a sa réponse en moins de 2 minutes, à 22h un dimanche, sans savoir que ce n'est pas toi qui as tapé le message.</p>
      <p>Et dès que la question sort du cadre, ça part directement vers toi. Aucun client n'est laissé avec une réponse à côté.</p>
      <p>Si tu veux voir concrètement à quoi ça ressemble sur tes propres messages, c'est l'objet du diagnostic.</p>`,
  },
  j7: {
    subject: "Dernier message à ce sujet",
    body: (firstName) => `
      <p>Hello ${firstName || "toi"},</p>
      <p>Je ne vais pas te relancer indéfiniment sur ce sujet, donc je fais simple.</p>
      <p>Si l'idée de récupérer 10h par semaine sans embaucher te parle, pas besoin d'attendre la vidéo : le prochain pas, c'est 30 minutes avec moi, gratuites, sans engagement.</p>
      <p>On regarde tes messages clients, je te dis exactement ce que tu peux automatiser et ce que ça change pour toi en temps et en argent. Que tu bosses avec moi après ou pas.</p>
      <p>Si ce n'est pas le bon moment, pas de souci. Tu recevras la vidéo dès sa sortie, et tu me recontactes quand tu veux.</p>`,
  },
};

function followupEmailHtml(stage: FollowupStage, firstName: string, siteUrl: string): string {
  const content = FOLLOWUP_CONTENT[stage];
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#1c1917;">
    ${content.body(firstName)}
    ${bookingButton(siteUrl)}
    ${signature()}
  </div>`;
}

export async function sendFollowupEmail(input: {
  stage: FollowupStage;
  to: string;
  firstName?: string;
  siteUrl: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const content = FOLLOWUP_CONTENT[input.stage];
  return sendEmail({
    to: input.to,
    subject: content.subject,
    html: followupEmailHtml(input.stage, input.firstName || "", input.siteUrl),
  });
}

/**
 * Email de confirmation d'un opt-in du moteur de pages (bloc `optin`).
 * Gabarit fixe aux couleurs du thème, même structure que resourceEmailHtml :
 * la config du tunnel fournit des textes simples, jamais de HTML. Tout est
 * échappé, en particulier le prénom saisi par le visiteur.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function funnelConfirmationEmailHtml(input: {
  firstName?: string;
  title: string;
  text: string;
  buttonLabel?: string;
  buttonUrl?: string;
}): string {
  const greeting = input.firstName ? `Hello ${escapeHtml(input.firstName)},` : "Hello,";
  const button =
    input.buttonLabel && input.buttonUrl
      ? `
    <p style="margin:28px 0;">
      <a href="${escapeHtml(input.buttonUrl)}"
         style="background:${config.brand.colorPrimary};color:#fff;text-decoration:none;
                padding:14px 26px;border-radius:999px;font-weight:600;display:inline-block;">
        ${escapeHtml(input.buttonLabel)}
      </a>
    </p>`
      : "";
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#1c1917;">
    <h1 style="font-size:22px;color:${config.brand.colorPrimary};">${escapeHtml(input.title)}</h1>
    <p>${greeting}</p>
    <p>${escapeHtml(input.text)}</p>
    ${button}
    ${signature()}
  </div>`;
}

export async function sendFunnelConfirmationEmail(input: {
  to: string;
  firstName?: string;
  subject: string;
  title: string;
  text: string;
  buttonLabel?: string;
  buttonUrl?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  return sendEmail({
    to: input.to,
    subject: input.subject,
    html: funnelConfirmationEmailHtml(input),
  });
}
