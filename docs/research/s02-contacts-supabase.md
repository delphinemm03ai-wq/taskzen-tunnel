# Research : Story s02-contacts-supabase

## The five structuring facts
1. PRÉMISSE FAUSSE (double) : le "projet Supabase existant (espace formation)" des notes agentiques n'existe pas sous ce nom ; le seul projet du compte s'appelle "Sommet IA en 5 jours" (ref itqishioqyxizbucyvyt, celui du .env AIOS) et il est EN PAUSE (statut INACTIVE, vérifié par l'API de gestion le 10/10). Son hôte REST ne résout plus tant qu'il dort. À réveiller avant toute vérification en base ; la relance par API a été refusée par le garde-fou (ressource partagée) : Delphine le fait au dashboard, ou autorise l'action.
2. Le mécanisme de protection admin existe et fait foi : `ADMIN_SECRET` comparé côté serveur (app/api/funnel/stats/route.ts:7-13, `errors.unauthorized`) ; FunnelDashboard.tsx:~20 saisit le secret côté client. Les nouvelles routes admin reprennent ce motif tel quel.
3. Le dépôt n'a PAS de client Supabase et n'en a pas besoin : lib/airtable.ts (plain fetch + isConfigured + fallback mode démo) est le motif à répliquer dans lib/supabase.ts via l'API REST PostgREST (zéro dépendance npm, conforme à l'esprit s01).
4. PostgREST n'expose que les schémas `public` et `graphql_public` par défaut : le "schéma dédié tunnel" de l'ADR 002 exigerait une modification de la config API du projet (action de plus sur la ressource partagée). Décision à acter : tables PRÉFIXÉES `tunnel_` dans `public` (ADR 006 à écrire au plan, raffinant l'ADR 002).
5. Contenu actuel du schéma public : INCONNU (projet en pause, impossible à lister). Le préfixe `tunnel_` rend une collision de noms très improbable ; vérifier quand même après réveil, avant d'appliquer la migration.

## Target story
Tables contacts/tags/liaisons dans Supabase (migration SQL versionnée) ; upsert par email unique ; import CSV Systeme.io rejouable sans doublon ; export CSV ; page /admin (protégée par le secret existant) avec liste + recherche. Airtable reste branché (interdit d'y toucher, bascule en s09).

## Current state of the code
- `app/api/lead/route.ts` (78 l.) : zod + rate-limit + Airtable + cookie opt-in : la référence de style pour les routes.
- `lib/airtable.ts` : fetch pur, en-têtes Authorization, isAirtableConfigured() avec repli loggé.
- `lib/api-response.ts` (28 l.) : success/errors homogènes. `lib/rate-limit.ts`, `lib/schemas.ts` : réutilisables.
- `components/admin/FunnelDashboard.tsx` (139 l., client) : saisie du secret (pré-rempli par ?secret=), fetch vers l'API, tableaux. S'étend par onglets ou sections.
- Env : aucune variable SUPABASE_* dans le projet tunnel (ni .env.local, ni .env.example). Les clés vivent dans le .env de l'AIOS : URL, ANON_KEY, SERVICE_ROLE_KEY, ACCESS_TOKEN, PROJECT_REF (noms vérifiés, valeurs jamais lues en clair). À copier dans .env.local du worktree et dans Vercel au ship.

## Anchor points
- `supabase/migrations/001_tunnel_contacts.sql` : contacts, tags, contact_tags préfixés `tunnel_`, contraintes d'unicité (email, name, paire contact/tag), RLS activée avec zéro policy (service_role seul passe outre : accès serveur uniquement, conforme architecture).
- `lib/supabase.ts` : helpers REST (upsertContact, addTag, listContacts, searchByEmail, exportCsv) avec service key, en-tête `Prefer: resolution=merge-duplicates` pour l'upsert.
- `app/api/admin/contacts/route.ts` : GET protégé par ADMIN_SECRET (liste + recherche + export CSV).
- `scripts/import-systemeio.mjs` : lecture CSV (séparateur à détecter : l'export Systeme.io réel n'a pas encore été vu : colonnes supposées email/prénom/tags, à confirmer en s09 sur l'export réel), upsert idempotent, rapport (créés / mis à jour / tags posés).
- `components/admin/` : vue contacts dans la page admin existante.

## Verified APIs / functions
- `errors.unauthorized(msg)` lib/api-response.ts ; `success(data)` idem.
- Gestion Supabase : GET https://api.supabase.com/v1/projects (200, token du .env) : source de vérité du statut projet. POST /restore : refusé par le classifieur, PAS par l'API.
- PostgREST upsert : POST /rest/v1/tunnel_contacts avec `Prefer: resolution=merge-duplicates` + contrainte UNIQUE(email) : standard documenté, à vérifier en vrai après réveil (fait n°1).

## Traps & constraints
- Ne RIEN exécuter contre la base sans le réveil + l'accord explicite de Delphine (engagement pris) : le cycle s02 s'arrête à "migration écrite, code écrit, vérifications locales faites", puis attend le go pour appliquer et vérifier en vrai.
- Le projet en pause se rendort après ~1 semaine d'inactivité (offre gratuite) : la bascule s09 devra considérer un passage payant ou accepter des réveils.
- service_role = pleins pouvoirs : uniquement process.env côté serveur, jamais NEXT_PUBLIC_*.
- Import CSV : encodage Windows possible (export Systeme.io), BOM UTF-8 à gérer.
- L'admin actuel passe le secret en query string (?secret=) : le garder pour la cohérence mais préférer un en-tête sur les nouvelles routes (le query string finit dans les logs).

## Open questions
- Réveil du projet : par Delphine au dashboard (https://supabase.com/dashboard/project/itqishioqyxizbucyvyt) ou en autorisant l'appel restore. Bloquant pour les critères "en vrai", pas pour le code.
- Colonnes exactes de l'export CSV Systeme.io : supposées, à verrouiller en s09 ; l'import prend une option de mapping.
- Après réveil : vérifier l'absence de tables `tunnel_*` préexistantes dans public.

## Real complexity
Score stories : 3. Verdict : 3 confirmé, avec une dépendance externe (réveil du projet) qui coupe la story en deux temps : code + migration (sans base), puis application + vérifications réelles après le go. Pas de split : c'est la même tranche, livrée en deux mouvements.

## Split proposal
Non nécessaire (3), mais exécution en deux temps actée (voir ci-dessus).
