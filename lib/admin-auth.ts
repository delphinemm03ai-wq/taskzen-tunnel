import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Secret admin lu dans l'en-tête x-admin-secret uniquement (jamais dans
 * l'adresse : les query strings finissent dans les logs). Comparaison en
 * temps constant. Sans ADMIN_SECRET côté serveur, tout est refusé.
 */
export function isAdminRequest(req: NextRequest): boolean {
  const expected = process.env.ADMIN_SECRET;
  const given = req.headers.get("x-admin-secret");
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
