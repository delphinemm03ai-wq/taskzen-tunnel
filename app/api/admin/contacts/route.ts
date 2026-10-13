import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { success, errors } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/admin-auth";
import { countContacts, isSupabaseConfigured, listContacts } from "@/lib/supabase";
import type { ContactsPage, ContactWithTags } from "@/types/contacts";

const PAGE_SIZE = 25;
const EXPORT_CHUNK = 1000;

const querySchema = z.object({
  search: z.string().max(200, "Recherche trop longue (200 caractères max)").optional(),
  tag: z.string().trim().min(1, "Tag vide").max(100, "Tag trop long (100 caractères max)").optional(),
  page: z.coerce
    .number({ invalid_type_error: "Page invalide" })
    .int("Page invalide")
    .min(1, "Page invalide")
    .max(100000, "Page invalide")
    .default(1),
  format: z
    .enum(["json", "csv"], { errorMap: () => ({ message: "Format invalide (json ou csv)" }) })
    .default("json"),
});

/**
 * Contacts du tunnel pour l'admin : liste paginée + recherche par email
 * (format=json), ou export CSV complet de la recherche (format=csv).
 * Filtre optionnel par tag (nom exact). Protégé par ADMIN_SECRET dans
 * l'en-tête x-admin-secret uniquement (lib/admin-auth.ts).
 */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return errors.unauthorized("Secret invalide");
  }

  if (!isSupabaseConfigured()) {
    return errors.internal(
      "Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  const params = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    search: params.get("search") ?? undefined,
    tag: params.get("tag") ?? undefined,
    page: params.get("page") ?? undefined,
    format: params.get("format") ?? undefined,
  });
  if (!parsed.success) {
    return errors.badRequest(parsed.error.issues[0]?.message || "Paramètres invalides");
  }
  const { search, tag, page, format } = parsed.data;

  try {
    if (format === "csv") {
      return csvResponse(await listAll(search, tag));
    }

    const [contacts, total] = await Promise.all([
      listContacts({ search, tag, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
      countContacts(search, tag),
    ]);
    const data: ContactsPage = { contacts, total, page, pageSize: PAGE_SIZE };
    return success(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/contacts] error:", message);
    return errors.internal(message);
  }
}

/** Tous les contacts de la recherche, par paquets (export). */
async function listAll(search?: string, tag?: string): Promise<ContactWithTags[]> {
  const all: ContactWithTags[] = [];
  for (let offset = 0; ; offset += EXPORT_CHUNK) {
    const chunk = await listContacts({ search, tag, limit: EXPORT_CHUNK, offset });
    all.push(...chunk);
    if (chunk.length < EXPORT_CHUNK) return all;
  }
}

/**
 * Cellule CSV : entre guillemets si besoin ; une cellule qui commence par
 * = + - @ est préfixée d'une apostrophe pour qu'Excel ne l'exécute pas.
 */
function cell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Export séparé par ; avec BOM UTF-8, pour qu'Excel lise les accents. */
function csvResponse(contacts: ContactWithTags[]): NextResponse {
  const lines = [
    "email;prenom;tags;cree_le",
    ...contacts.map((c) =>
      [c.email, c.first_name ?? "", c.tags.join(","), c.created_at].map(cell).join(";")
    ),
  ];
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contacts-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
