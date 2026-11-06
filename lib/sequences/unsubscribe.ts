import { createHmac, timingSafeEqual } from "node:crypto";

/** Jeton signé : on ne peut désinscrire que le contact du lien, sans deviner un identifiant. */
export function unsubscribeToken(contactId: string, secret: string): string {
  return createHmac("sha256", secret).update(`unsubscribe:${contactId}`).digest("hex");
}

export function isValidUnsubscribeToken(contactId: string, token: string, secret: string | undefined): boolean {
  if (!secret || !contactId || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(unsubscribeToken(contactId, secret));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(siteUrl: string, contactId: string, secret: string): string {
  return `${siteUrl}/api/desinscription?c=${encodeURIComponent(contactId)}&t=${unsubscribeToken(contactId, secret)}`;
}
