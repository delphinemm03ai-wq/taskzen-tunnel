-- Migration 002 : ventes du tunnel maison (story s04, ADR 004 et 006).
--
-- Une ligne = un paiement confirmé par le webhook Stripe signé, seule source
-- de vérité d'une vente. Les montants viennent de la config produit
-- (funnels/produits.ts), pas de l'événement Stripe.
--
-- Idempotence portée par la base :
--   * stripe_event_id UNIQUE : un événement rejoué n'écrit pas une seconde vente
--     (insert PostgREST on_conflict=stripe_event_id, resolution=ignore-duplicates) ;
--   * stripe_session_id UNIQUE : deux événements d'une même session
--     (checkout.session.completed puis async_payment_succeeded) = une seule vente.
--
-- RLS activée, zéro policy : seule la clé service_role (serveur, lib/supabase.ts)
-- y accède, comme les tables de la migration 001.

create table public.tunnel_sales (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.tunnel_contacts (id) on delete restrict,
  product_slug text not null,
  -- Montants en centimes. TTC = montant encaissé ; HT = round(TTC / (1 + taux/100)).
  amount_ttc integer not null check (amount_ttc >= 0),
  amount_ht integer not null check (amount_ht >= 0),
  -- Taux de TVA en pourcentage au moment de la vente (5.5, 20...).
  vat_rate numeric(5, 2) not null check (vat_rate >= 0),
  stripe_event_id text not null unique,
  stripe_session_id text not null unique,
  -- Code affilié (s06), null tant que l'affiliation n'existe pas.
  affiliate_code text,
  created_at timestamptz not null default now()
);

comment on table public.tunnel_sales is 'Ventes du tunnel maison (s04). Écrites par le webhook Stripe signé, une par session.';

-- Ventes d'un contact.
create index tunnel_sales_contact_id_idx on public.tunnel_sales (contact_id);

-- Liste des ventes récentes d'abord.
create index tunnel_sales_created_at_idx on public.tunnel_sales (created_at desc);

-- RLS : activée, aucune policy. Accès serveur uniquement (service_role).
alter table public.tunnel_sales enable row level security;
