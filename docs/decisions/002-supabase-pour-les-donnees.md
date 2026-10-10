# ADR 002 — Supabase pour contacts, tags, ventes et envois

- Status: accepted
- Date: 2026-10-10
- Scope: framing

## Context
Il faut une base pour l'état vivant (contacts, tags, ventes, commissions, envois programmés). Le tunnel actuel écrit ses leads dans Airtable. Delphine a un projet Supabase (espace formation) et a tranché pour Supabase le 10/10 (question posée au cadrage, recommandation du 27/09).

## Decision
Supabase (Postgres), schéma dédié `tunnel` dans le projet existant, migrations SQL versionnées dans `supabase/migrations/`, accès serveur uniquement.

## Considered options
- Airtable — rejeté : plafond de lignes, pas de contraintes d'unicité ni de transactions, mal adapté à l'idempotence exigée par Stripe et les envois programmés. Garde sa vue tableur, remplacée ici par l'admin.
- SQLite sur Vercel — rejeté : pas de persistance fiable en serverless.

## Consequences
- Plus facile : contraintes d'unicité (email, stripe_event_id), requêtes de stats, volumes.
- Plus dur : Delphine perd la vue tableur native ; l'admin doit offrir liste + recherche dès s02.
- À surveiller : la clé service_role ne doit jamais atteindre le client ; RLS ou accès service uniquement.
