-- Migration 004 : pages, tunnels, séquences d'emails et journal des appels MCP (lot 1 du serveur d'outils IA).
--
-- Tables préfixées tunnel_ dans le schéma public (ADR 006), comme les migrations 001 à 003.
-- À lancer par Delphine elle-même (SQL editor Supabase). Rien ne l'applique automatiquement.
--
--   * tunnel_pages : une page = un JSON versionné (colonne page) ; `version` sert au verrou optimiste
--     (UPDATE ... WHERE version = <lue>) ; `published` garde la copie vue par les visiteurs.
--   * tunnel_funnels : slug unique (adresse publique /p/<slug>/<étape>).
--   * tunnel_email_sequences : séquences programmées (déclencheur, emails, délais).
--   * tunnel_mcp_calls : journal des appels du serveur d'outils (tailles en octets).
--   * tunnel_create_funnel(bundle) : écrit un tunnel, ses pages et sa séquence dans UNE transaction.
--
-- RLS activée partout, zéro policy : seule la clé service_role (serveur uniquement) y accède.
-- Les identifiants sont du texte préfixé (pg_..., fn_..., seq_...) générés par le serveur.

create table public.tunnel_pages (
  id text primary key,
  version integer not null check (version >= 1),
  status text not null check (status in ('draft', 'published')),
  page jsonb not null,
  published jsonb,
  funnel_id text,
  updated_at timestamptz not null default now()
);
comment on table public.tunnel_pages is 'Pages du serveur d''outils : description JSON versionnée (format 1), rendue côté serveur.';

create table public.tunnel_funnels (
  id text primary key,
  name text not null,
  slug text not null unique,
  status text not null check (status in ('draft', 'published')),
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.tunnel_funnels is 'Tunnels créés par le serveur d''outils (étapes ordonnées dans steps).';

create table public.tunnel_email_sequences (
  id text primary key,
  name text not null,
  trigger jsonb not null,
  emails jsonb not null,
  exit_on jsonb not null default '["purchase","unsubscribe"]'::jsonb,
  status text not null check (status in ('scheduled')),
  created_at timestamptz not null default now()
);
comment on table public.tunnel_email_sequences is 'Séquences d''emails programmées. Enregistrées seulement : l''envoi réel viendra avec le lot 2.';

create table public.tunnel_mcp_calls (
  id bigint generated always as identity primary key,
  at timestamptz not null,
  key_id text not null,
  tool text not null,
  request_bytes integer not null,
  response_bytes integer not null,
  ok boolean not null
);
comment on table public.tunnel_mcp_calls is 'Journal des appels du serveur d''outils (taille de la demande consignée, exigence X2).';
create index tunnel_mcp_calls_at_idx on public.tunnel_mcp_calls (at desc);

-- Création d'un tunnel complet en une transaction : une erreur annule tout (slug déjà pris, ligne invalide).
-- security invoker (par défaut) : appelée avec la clé service_role, elle passe outre la RLS comme le reste.
create or replace function public.tunnel_create_funnel(bundle jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  f jsonb := bundle -> 'funnel';
  p jsonb;
  s jsonb := bundle -> 'sequence';
begin
  insert into public.tunnel_funnels (id, name, slug, status, steps)
  values (f ->> 'id', f ->> 'name', f ->> 'slug', f ->> 'status', f -> 'steps');

  for p in select * from jsonb_array_elements(bundle -> 'pages') loop
    insert into public.tunnel_pages (id, version, status, page, published, funnel_id, updated_at)
    values (
      p ->> 'id', (p ->> 'version')::integer, p ->> 'status', p -> 'page',
      case when jsonb_typeof(p -> 'published') = 'object' then p -> 'published' else null end,
      p ->> 'funnel_id', (p ->> 'updated_at')::timestamptz
    );
  end loop;

  if s is not null and jsonb_typeof(s) = 'object' then
    insert into public.tunnel_email_sequences (id, name, trigger, emails, exit_on, status)
    values (s ->> 'id', s ->> 'name', s -> 'trigger', s -> 'emails', s -> 'exit_on', s ->> 'status');
  end if;
end;
$$;

-- Seule la clé service_role peut l'appeler.
revoke execute on function public.tunnel_create_funnel(jsonb) from public, anon, authenticated;
grant execute on function public.tunnel_create_funnel(jsonb) to service_role;

alter table public.tunnel_pages enable row level security;
alter table public.tunnel_funnels enable row level security;
alter table public.tunnel_email_sequences enable row level security;
alter table public.tunnel_mcp_calls enable row level security;
