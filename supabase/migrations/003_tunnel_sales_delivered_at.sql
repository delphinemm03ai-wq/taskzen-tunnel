-- Migration 003 : trace de l'email de livraison d'une vente (story s04, passe de correction).
--
-- delivered_at reste null tant que l'email de livraison n'est pas parti. Le
-- webhook Stripe le relit à chaque événement payé, rejeu compris : null, il
-- renvoie l'email puis pose la date. Un échec d'envoi répond 500, Stripe
-- réessaie, et le rejeu reprend là où ça s'est arrêté.

alter table public.tunnel_sales add column delivered_at timestamptz;

comment on column public.tunnel_sales.delivered_at is 'Envoi de l''email de livraison (null = pas encore parti).';
