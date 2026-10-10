-- Migration 001 : contacts, tags et liaisons du tunnel maison (story s02).
--
-- Tables préfixées tunnel_ dans le schéma public (ADR 006, raffine l'ADR 002) :
-- PostgREST n'expose que public par défaut, le préfixe porte la frontière.
--
-- Idempotence portée par la base, pas par le code :
--   * tunnel_contacts.email UNIQUE (citext : Email@X et email@x sont le même contact)
--   * tunnel_tags.name UNIQUE
--   * tunnel_contact_tags : clé primaire composite (contact_id, tag_id)
-- L'upsert PostgREST (on_conflict=email, resolution=merge-duplicates) s'appuie
-- sur la contrainte UNIQUE de la colonne email : un index sur lower(email) ne
-- serait pas reconnu comme cible de ON CONFLICT, d'où le choix de citext.
--
-- RLS activée sur les trois tables, zéro policy : seule la clé service_role
-- (serveur uniquement, lib/supabase.ts) y accède. anon et authenticated ne
-- voient rien.

-- citext : texte insensible à la casse. Installé dans le schéma extensions
-- (convention Supabase) ; s'il existe déjà ailleurs, cette ligne ne fait rien
-- et le type reste résolu par le search_path.
create extension if not exists citext with schema extensions;

-- Met à jour updated_at à chaque modification d'une ligne.
create or replace function public.tunnel_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Contacts : un email = un contact.
create table public.tunnel_contacts (
  id uuid primary key default gen_random_uuid(),
  -- L'email arrive déjà nettoyé (trim + minuscules) par lib/supabase.ts.
  email citext not null unique,
  first_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Rempli à la désinscription (s05), null tant que le contact reçoit les emails.
  unsubscribed_at timestamptz
);

comment on table public.tunnel_contacts is 'Contacts du tunnel maison (s02). Email unique, insensible à la casse.';

create trigger tunnel_contacts_set_updated_at
  before update on public.tunnel_contacts
  for each row execute function public.tunnel_set_updated_at();

-- Tags : un nom = un tag.
create table public.tunnel_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

comment on table public.tunnel_tags is 'Tags du tunnel maison (s02). Nom unique.';

-- Liaisons contact <-> tag : la paire est unique par construction.
create table public.tunnel_contact_tags (
  contact_id uuid not null references public.tunnel_contacts (id) on delete cascade,
  tag_id uuid not null references public.tunnel_tags (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);

comment on table public.tunnel_contact_tags is 'Tags posés sur les contacts (s02). Une paire contact/tag au plus.';

-- Recherche des contacts par tag (la PK couvre déjà contact_id en tête).
create index tunnel_contact_tags_tag_id_idx on public.tunnel_contact_tags (tag_id);

-- Liste admin triée par date de création.
create index tunnel_contacts_created_at_idx on public.tunnel_contacts (created_at desc);

-- RLS : activée, aucune policy. Accès serveur uniquement (service_role).
alter table public.tunnel_contacts enable row level security;
alter table public.tunnel_tags enable row level security;
alter table public.tunnel_contact_tags enable row level security;
