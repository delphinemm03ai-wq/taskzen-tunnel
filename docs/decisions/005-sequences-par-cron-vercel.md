# ADR 005 — Séquences d'emails par table d'état et cron Vercel

- Status: accepted
- Date: 2026-10-10
- Scope: framing

## Context
Les séquences (J+0, J+2...) exigent des envois différés. Vercel est serverless : aucun processus ne vit entre deux requêtes. Le repo a déjà un cron Vercel quotidien (api/cron/relances).

## Decision
À la pose d'un tag déclencheur, les envois sont matérialisés dans une table `scheduled_emails` (un enregistrement par email dû, avec due_at). Un cron Vercel (`api/cron/emails`, toutes les 15 minutes) envoie ce qui est dû via Resend et marque l'état. Unicité par contact, séquence et index d'email : rien ne part deux fois.

## Considered options
- Service d'emailing externe (Brevo, Loops, MailerLite) — rejeté : on recrée une dépendance type Systeme.io, données dehors, abonnement.
- File d'attente dédiée (QStash, Inngest) — rejetée en v1 : un service de plus pour un besoin qu'une table et un cron couvrent à notre échelle (centaines de contacts).

## Consequences
- Plus facile : état des envois lisible en SQL et dans l'admin, reprise après panne triviale (le cron rattrape).
- Plus dur : précision de l'ordre de 15 minutes, suffisante pour des J+2.
- À surveiller : fuseaux (stocker en UTC, afficher en Europe/Paris) ; désinscription qui annule les envois programmés.
