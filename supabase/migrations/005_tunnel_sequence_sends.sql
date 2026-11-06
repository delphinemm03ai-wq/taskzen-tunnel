-- Migration 005 : envoi réel des séquences d'e-mails. À lancer après la 004.
--
--   * activated_at : une séquence ne part jamais tant qu'elle n'est pas activée.
--   * tunnel_sequence_sends : une ligne par e-mail réservé pour un contact. La clé primaire
--     empêche d'envoyer deux fois le même e-mail à la même personne, même si deux passages se croisent.
--
-- RLS activée, zéro policy : seule la clé service_role (serveur uniquement) y accède.

alter table public.tunnel_email_sequences add column activated_at timestamptz;

comment on table public.tunnel_email_sequences is 'Séquences d''e-mails. Envoyées seulement une fois activated_at rempli.';

create table public.tunnel_sequence_sends (
  sequence_id text not null references public.tunnel_email_sequences (id) on delete cascade,
  email_id text not null,
  contact_id uuid not null references public.tunnel_contacts (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (sequence_id, email_id, contact_id)
);

comment on table public.tunnel_sequence_sends is 'E-mails de séquence réservés ou envoyés, un au plus par contact.';

create index tunnel_sequence_sends_contact_id_idx on public.tunnel_sequence_sends (contact_id);

alter table public.tunnel_sequence_sends enable row level security;
