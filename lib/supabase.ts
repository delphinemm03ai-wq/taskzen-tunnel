/**
 * Supabase : contacts et tags du tunnel maison (tables tunnel_*, ADR 006).
 *
 * Accès serveur uniquement, par l'API REST PostgREST en fetch pur (zéro
 * dépendance). La clé service_role passe outre la RLS : elle ne quitte
 * jamais le serveur (process.env, jamais exposée au navigateur).
 *
 * Si les variables d'env ne sont pas configurées, isSupabaseConfigured()
 * renvoie false et les appelants répondent une erreur explicite.
 */

import type { Contact, ContactWithTags, Tag } from "@/types/contacts";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function restUrl(table: string): URL {
  return new URL(`${String(SUPABASE_URL).replace(/\/+$/, "")}/rest/v1/${table}`);
}

function headers(prefer?: string): Record<string, string> {
  return {
    apikey: String(SUPABASE_SERVICE_ROLE_KEY),
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(prefer && { Prefer: prefer }),
  };
}

/** fetch avec un message lisible si l'hôte ne répond pas (projet en pause). */
async function call(url: URL, init: RequestInit, label: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url.toString(), { ...init, cache: "no-store" });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Supabase injoignable (projet en pause ?) : ${reason}`);
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`[Supabase] ${label} failed`, { status: res.status, body: text });
    throw new Error(`Supabase ${label} failed: ${res.status}`);
  }
  return res;
}

/** Même contact quelle que soit la casse ou les espaces (la colonne est citext). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Crée ou met à jour le contact (clé : email). Réinsérer le même email met
 * à jour la fiche : on_conflict=email + resolution=merge-duplicates, adossés
 * à la contrainte UNIQUE(email) de la migration 001.
 * Un prénom absent ne remplace pas un prénom déjà connu.
 */
export async function upsertContact(input: {
  email: string;
  firstName?: string | null;
}): Promise<Contact> {
  const row: Record<string, string> = { email: normalizeEmail(input.email) };
  const firstName = input.firstName?.trim();
  if (firstName) row.first_name = firstName;

  const url = restUrl("tunnel_contacts");
  url.searchParams.set("on_conflict", "email");
  const res = await call(
    url,
    {
      method: "POST",
      headers: headers("resolution=merge-duplicates,return=representation"),
      body: JSON.stringify([row]),
    },
    "upsertContact"
  );
  const rows: Contact[] = await res.json();
  return rows[0];
}

/**
 * Garantit l'existence des tags et renvoie leurs lignes (id + nom).
 * merge-duplicates (et non ignore-duplicates) pour que les tags déjà
 * présents reviennent aussi dans la réponse, avec leur id.
 */
export async function ensureTags(names: string[]): Promise<Tag[]> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const url = restUrl("tunnel_tags");
  url.searchParams.set("on_conflict", "name");
  url.searchParams.set("select", "id,name");
  const res = await call(
    url,
    {
      method: "POST",
      headers: headers("resolution=merge-duplicates,return=representation"),
      body: JSON.stringify(unique.map((name) => ({ name }))),
    },
    "ensureTags"
  );
  return res.json();
}

/** Pose les tags sur le contact. Une paire déjà posée est ignorée (PK composite). */
export async function tagContact(contactId: string, tagIds: string[]): Promise<void> {
  const unique = [...new Set(tagIds)];
  if (unique.length === 0) return;

  const url = restUrl("tunnel_contact_tags");
  url.searchParams.set("on_conflict", "contact_id,tag_id");
  await call(
    url,
    {
      method: "POST",
      headers: headers("resolution=ignore-duplicates,return=minimal"),
      body: JSON.stringify(unique.map((tag_id) => ({ contact_id: contactId, tag_id }))),
    },
    "tagContact"
  );
}

/** Filtre ilike sur l'email ; * et % retirés (jokers PostgREST et SQL). */
function applySearch(url: URL, search?: string): void {
  const term = search?.replace(/[*%]/g, "").trim();
  if (term) url.searchParams.set("email", `ilike.*${term}*`);
}

interface ContactRow extends Contact {
  tunnel_contact_tags: { tunnel_tags: { name: string } | null }[];
}

/** Contacts récents d'abord, avec leurs tags (jointure embarquée PostgREST). */
export async function listContacts(opts: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<ContactWithTags[]> {
  const url = restUrl("tunnel_contacts");
  url.searchParams.set(
    "select",
    "id,email,first_name,created_at,updated_at,unsubscribed_at,tunnel_contact_tags(tunnel_tags(name))"
  );
  url.searchParams.set("order", "created_at.desc,id.asc");
  url.searchParams.set("limit", String(opts.limit));
  url.searchParams.set("offset", String(opts.offset));
  applySearch(url, opts.search);

  const res = await call(url, { headers: headers() }, "listContacts");
  const rows: ContactRow[] = await res.json();
  return rows.map(({ tunnel_contact_tags, ...contact }) => ({
    ...contact,
    tags: tunnel_contact_tags
      .map((link) => link.tunnel_tags?.name)
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b, "fr")),
  }));
}

/** Nombre de contacts correspondant à la recherche (en-tête Content-Range). */
export async function countContacts(search?: string): Promise<number> {
  const url = restUrl("tunnel_contacts");
  url.searchParams.set("select", "id");
  url.searchParams.set("limit", "1");
  applySearch(url, search);

  const res = await call(url, { headers: headers("count=exact") }, "countContacts");
  // Content-Range : "0-0/123" ou "*/0".
  const total = res.headers.get("content-range")?.split("/")[1];
  return total && total !== "*" ? parseInt(total, 10) : 0;
}
