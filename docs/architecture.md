# Architecture — Tunnel maison Taskzen

## Stack
- Next.js 15 (App Router, génération statique pour les pages de tunnel), React 19, TypeScript 5 strict.
- Tailwind CSS 4 (via PostCSS) + variables CSS maison dans `app/globals.css` (thème argile, mousse, papier).
- Zod pour la validation des entrées (lib/schemas.ts).
- Données : Supabase (Postgres) pour contacts, tags, ventes, commissions, envois programmés (ADR 002). Airtable reste branché sur l'ancienne route `api/lead` jusqu'à la bascule (s09).
- Emails : Resend (domaine taskzen.fr vérifié, expéditeur contact@taskzen.fr).
- Paiement : Stripe Checkout + webhook signé (ADR 004).
- Stats : PostHog (posthog-js côté client, requêtes via lib/posthog-query.ts).
- RDV : Cal.com (@calcom/embed-react), déjà en prod sur /reserver.
- Hébergement : Vercel (projet taskzen-tunnel, compte delphinemm03ai-wq), cron Vercel (vercel.json).

## Repo structure
- `config.ts` : source unique du tunnel historique 4 pages (reste en l'état, prod).
- `funnels/` (nouveau) : un fichier de config TS par tunnel, la source de vérité des pages (ADR 003).
- `types/` : types partagés ; `types/funnel.ts` (nouveau) décrit FunnelConfig, étapes et blocs.
- `app/` : routes App Router. Existant : `/`, `/ressource`, `/reserver`, `/merci`, `/admin`, `api/lead`, `api/funnel/stats`, `api/cron/relances`. Nouveau : `app/t/[funnel]/[step]/` (rendu générique), `api/optin`, `api/stripe/webhook`, `api/cron/emails`, `/desinscription`.
- `components/funnel/` : blocs de page (OptinForm, CalEmbed, PageView, ResourceViewer, BookingCta, plus la bibliothèque de blocs du moteur).
- `components/admin/` : tableau de bord (FunnelDashboard, plus contacts, envois, commissions).
- `lib/` : un fichier = un job (airtable, resend, schemas, rate-limit, api-response, funnel, posthog-*). Nouveau : `lib/supabase.ts`, `lib/stripe.ts`.
- `middleware.ts` : gating des étapes par cookie.
- `docs/` : PRD, stories, architecture, décisions (ADR), revues ; `supabase/migrations/` (nouveau) : SQL versionné.

## Patterns & conventions
- Une page de tunnel = de la donnée (config TS typée), jamais du code par page. Le rendu est une fonction pure config vers HTML : aucun LLM dans le chemin de rendu (ADR 003).
- Source unique : tout contenu éditable vit dans `config.ts` ou `funnels/*.ts`, versionné dans git. Un changement de texte = un commit.
- Validation d'entrée systématique avec zod dans les routes API, réponses via `lib/api-response.ts`, limitation de cadence via `lib/rate-limit.ts`.
- Secrets uniquement dans `.env.local` (dev) et les variables Vercel (prod). La clé service_role Supabase et la clé secrète Stripe ne touchent jamais le client.
- Textes visibles en français, tutoiement, jamais de tiret cadratin. Code et commentaires suivent le style du dépôt (commentaires français).
- Idempotence partout où de l'argent ou un email circule : contrainte d'unicité en base (stripe_event_id, envoi par contact et par étape de séquence).
- Les routes prod actuelles ne se cassent pas : le moteur vit à côté sous `/t/`, la migration des 4 pages historiques attendra.

## Data model
En base (Supabase, schéma `tunnel`) : l'état qui vit et bouge.
- `contacts` (id, email unique, first_name, created_at, unsubscribed_at nullable)
- `tags` (id, name unique) et `contact_tags` (contact_id, tag_id, created_at)
- `sales` (id, contact_id, product_slug, amount_ttc, amount_ht, vat_rate, stripe_event_id unique, stripe_session_id, affiliate_code nullable, created_at)
- `commissions` (id, sale_id, affiliate_code, amount, status a_payer|payee, created_at)
- `scheduled_emails` (id, contact_id, sequence_slug, email_index, due_at, status programme|envoye|echoue|annule, sent_at, error)
- `rule_log` (s08 : contact_id, rule, result, created_at)

En config versionnée (repo) : la définition, qui ne bouge qu'en connaissance de cause.
- Tunnels et pages (`funnels/*.ts`), produits (nom, prix TTC, taux TVA, email de livraison), séquences d'emails, affiliés (nom, email, code), règles d'automatisation (s08).

## Integration points
- Resend : confirmation d'opt-in (s03), livraison d'achat (s04), séquences (s05, via `api/cron/emails`, entrée cron à ajouter dans vercel.json). Désinscription par token signé.
- Stripe : Checkout Session créée côté serveur, code affilié passé en metadata, webhook `api/stripe/webhook` avec vérification de signature, mode test jusqu'à validation explicite de Delphine.
- PostHog : événement de vue par étape (tunnel, étape) ; lectures agrégées dans l'admin.
- Supabase : client serveur uniquement (`lib/supabase.ts`), migrations SQL dans `supabase/migrations/`.
- Cal.com : inchangé (bloc réservation réutilisable par le moteur plus tard).
- Admin : protégé par le secret existant vérifié côté serveur (même mécanisme que `api/funnel/stats`).

## Design / UX
- Les pages de tunnel héritent du thème existant (variables CSS de globals.css, boutons et formulaires de components/funnel) : pas de nouveau design system, la v1 vise la parité fonctionnelle.
- L'admin reste utilitaire : tableaux lisibles (contacts, envois, commissions, stats), recherche simple, pas de fioritures.
- Design source : interne (AGENTS.local.md) ; les maquettes des nouveaux écrans admin se font en HTML dans le style du FunnelDashboard existant.
