import { sendEmail } from "@/lib/resend";
import { findContactByEmail, isSupabaseConfigured } from "@/lib/supabase";
import { ToolError, type Mailer } from "@/lib/mcp/tools";
import { fillFirstName, renderSequenceEmail } from "./render";
import { unsubscribeUrl } from "./unsubscribe";
import type { SendEmail } from "./engine";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "https://pages.taskzen.fr";

/** En-têtes qui font apparaître « Se désinscrire » dans les messageries, en un clic. */
function unsubscribeHeaders(url: string): Record<string, string> {
  return { "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}

/** Envoi d'une séquence : prénom, lien de désinscription signé. */
export const sendSequenceEmail: SendEmail = async ({ enrollee, subject, body }) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return { ok: false, reason: "CRON_SECRET absent : lien de désinscription impossible" };
  const url = unsubscribeUrl(siteUrl(), enrollee.contactId, secret);
  return sendEmail({
    to: enrollee.email,
    subject: fillFirstName(subject, enrollee.firstName),
    html: renderSequenceEmail({ body, firstName: enrollee.firstName, unsubscribeUrl: url }),
    headers: unsubscribeHeaders(url),
  });
};

/** Port Mailer du serveur d'outils (test d'e-mail, envoi à une liste). */
export class ResendMailer implements Mailer {
  async send(msg: { to: string; subject: string; body: string }): Promise<void> {
    const contact = isSupabaseConfigured() ? await findContactByEmail(msg.to) : null;
    const secret = process.env.CRON_SECRET;
    const url = contact && secret ? unsubscribeUrl(siteUrl(), contact.id, secret) : undefined;
    const result = await sendEmail({
      to: msg.to,
      subject: fillFirstName(msg.subject, contact?.first_name),
      html: renderSequenceEmail({ body: msg.body, firstName: contact?.first_name, unsubscribeUrl: url }),
      ...(url ? { headers: unsubscribeHeaders(url) } : {}),
    });
    if (!result.ok) throw new ToolError("email_failed", `L'e-mail n'est pas parti : ${result.reason ?? "raison inconnue"}.`);
  }
}
