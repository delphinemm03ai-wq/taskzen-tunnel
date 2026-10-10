/**
 * Contacts et tags du tunnel maison (story s02).
 * Partagés par lib/supabase.ts, la route admin et le panneau admin.
 * Les noms de champs suivent les colonnes des tables tunnel_* (snake_case).
 */

export interface Contact {
  id: string;
  email: string;
  first_name: string | null;
  created_at: string;
  updated_at: string;
  unsubscribed_at: string | null;
}

export interface Tag {
  id: string;
  name: string;
}

export interface ContactWithTags extends Contact {
  tags: string[];
}

/** Page de contacts renvoyée par GET /api/admin/contacts (format json). */
export interface ContactsPage {
  contacts: ContactWithTags[];
  total: number;
  page: number;
  pageSize: number;
}
