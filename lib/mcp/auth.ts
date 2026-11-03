import { timingSafeEqual } from "node:crypto";
import { parseKeys, type CallerKey } from "./server";

/** Authentification par clé en en-tête "Authorization: Bearer ...". Retourne null si absente ou fausse. */
export function authenticate(headers: Headers, rawKeys = process.env.TUNNEL_MCP_KEYS): CallerKey | null {
  const token = /^Bearer (.+)$/.exec(headers.get("authorization") ?? "")?.[1];
  if (!token) return null;
  const a = Buffer.from(token);
  for (const k of parseKeys(rawKeys)) {
    const b = Buffer.from(k.secret);
    if (a.length === b.length && timingSafeEqual(a, b)) return { id: k.id, scope: k.scope };
  }
  return null;
}
