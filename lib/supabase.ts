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

/**
 * Filtre par tag sans liste d'identifiants dans l'adresse : une jointure
 * interne aliasée `filtre` ne garde que les contacts porteurs du tag, tandis
 * que l'embed `tunnel_contact_tags(tunnel_tags(name))` continue de renvoyer
 * tous les tags du contact. Le nom du tag est comparé tel quel (eq).
 */
function applyTag(url: URL, select: string, tag?: string): void {
  if (!tag) {
    url.searchParams.set("select", select);
    return;
  }
  url.searchParams.set("select", `${select},filtre:tunnel_contact_tags!inner(tunnel_tags!inner(name))`);
  url.searchParams.set("filtre.tunnel_tags.name", `eq.${tag}`);
}

interface ContactRow extends Contact {
  tunnel_contact_tags: { tunnel_tags: { name: string } | null }[];
}

/** Contacts récents d'abord, avec leurs tags (jointure embarquée PostgREST). */
export async function listContacts(opts: {
  search?: string;
  tag?: string;
  limit: number;
  offset: number;
}): Promise<ContactWithTags[]> {
  const url = restUrl("tunnel_contacts");
  applyTag(
    url,
    "id,email,first_name,created_at,updated_at,unsubscribed_at,tunnel_contact_tags(tunnel_tags(name))",
    opts.tag
  );
  url.searchParams.set("order", "created_at.desc,id.asc");
  url.searchParams.set("limit", String(opts.limit));
  url.searchParams.set("offset", String(opts.offset));
  applySearch(url, opts.search);

  const res = await call(url, { headers: headers() }, "listContacts");
  const rows: (ContactRow & { filtre?: unknown })[] = await res.json();
  return rows.map(({ tunnel_contact_tags, filtre: _filtre, ...contact }) => ({
    ...contact,
    tags: tunnel_contact_tags
      .map((link) => link.tunnel_tags?.name)
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b, "fr")),
  }));
}

/** Lit le total d'un en-tête Content-Range ("0-0/123", ou étoile/0 si vide). */
function totalFromContentRange(res: Response): number {
  const total = res.headers.get("content-range")?.split("/")[1];
  return total && total !== "*" ? parseInt(total, 10) : 0;
}

/** Nombre de contacts correspondant à la recherche et au tag (en-tête Content-Range). */
export async function countContacts(search?: string, tag?: string): Promise<number> {
  const url = restUrl("tunnel_contacts");
  applyTag(url, "id", tag);
  url.searchParams.set("limit", "1");
  applySearch(url, search);

  const res = await call(url, { headers: headers("count=exact") }, "countContacts");
  return totalFromContentRange(res);
}

/** Taille d'une page PostgREST : Supabase plafonne chaque réponse à 1000 lignes (max-rows). */
const PAGE_ROWS = 1000;

/**
 * Nombre d'inscriptions par tag depuis `sinceIso` (date de pose du tag,
 * colonne tunnel_contact_tags.created_at), comptées en mémoire. Lecture par
 * pages de 1000 lignes : Supabase tronque silencieusement au-delà. Un tag
 * sans inscription est absent de la Map. Peu d'appels, donc une panne
 * Supabase ne multiplie pas les connexions en échec.
 */
export async function countContactsPerTag(sinceIso: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (let offset = 0; ; offset += PAGE_ROWS) {
    const url = restUrl("tunnel_contact_tags");
    url.searchParams.set("select", "tunnel_tags(name)");
    url.searchParams.set("created_at", `gte.${sinceIso}`);
    url.searchParams.set("order", "created_at.asc,contact_id.asc,tag_id.asc");
    url.searchParams.set("limit", String(PAGE_ROWS));
    url.searchParams.set("offset", String(offset));
    const res = await call(url, { headers: headers() }, "countContactsPerTag");
    const rows: { tunnel_tags: { name: string } | null }[] = await res.json();
    for (const row of rows) {
      const name = row.tunnel_tags?.name;
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    if (rows.length < PAGE_ROWS) return counts;
  }
}

/** Noms de tags existants, triés, pour le filtre de l'admin. */
export async function listTagNames(): Promise<string[]> {
  const url = restUrl("tunnel_tags");
  url.searchParams.set("select", "name");
  url.searchParams.set("order", "name.asc");
  const res = await call(url, { headers: headers() }, "listTagNames");
  const rows: { name: string }[] = await res.json();
  return rows.map((r) => r.name);
}
