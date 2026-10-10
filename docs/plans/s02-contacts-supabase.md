---
validated: yes
---
# Plan : Story s02-contacts-supabase

Branch: `feature/s02-contacts-supabase`
Research: `docs/research/s02-contacts-supabase.md` : read it first; this plan does not repeat it.

## Target story
Contacts, tags et liaisons dans Supabase (migration SQL versionnée), upsert par email unique, import CSV Systeme.io rejouable sans doublon, export CSV, vue contacts dans /admin protégée par le secret existant. Exécution EN DEUX TEMPS (fait n°1 de la recherche) : temps 1, tout le code + la migration écrite, vérifiable sans base vivante ; temps 2, après réveil du projet et go explicite de Delphine, application de la migration et vérifications réelles.

## Tasks (ordered) : temps 1 (sans base vivante)
1. [x] `supabase/migrations/001_tunnel_contacts.sql` : tables `tunnel_contacts` (id uuid, email citext ou text UNIQUE NOT NULL, first_name, created_at, updated_at, unsubscribed_at nullable), `tunnel_tags` (id, name UNIQUE), `tunnel_contact_tags` (contact_id FK, tag_id FK, created_at, PK composite) ; RLS ENABLE sur les trois, zéro policy ; commentaires SQL en français. Si citext : `create extension if not exists citext` sinon index unique sur lower(email).
2. [x] `types/contacts.ts` : types Contact, Tag, ContactWithTags partagés par lib, routes et admin.
3. [x] `lib/supabase.ts` : motif lib/airtable.ts : `isSupabaseConfigured()`, fetch REST PostgREST avec SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (process.env, jamais NEXT_PUBLIC), fonctions `upsertContact({email, firstName})` (Prefer: resolution=merge-duplicates, on_conflict=email, retourne la ligne), `ensureTags(names[])`, `tagContact(contactId, tagIds[])` (upsert ignore-duplicates), `listContacts({search, limit, offset})` (jointure embarquée tunnel_contact_tags(tunnel_tags(name)), recherche ilike sur email), `countContacts(search)`.
4. [x] `app/api/admin/contacts/route.ts` : GET protégé (secret en en-tête `x-admin-secret`, accepté aussi en query pour cohérence avec l'existant), params `search`, `page`, `format=json|csv` ; le CSV (export) sort email;prenom;tags;cree_le avec BOM UTF-8 pour Excel.
5. [x] `scripts/import-systemeio.mjs` (Node pur, zéro dépendance) : lit un CSV (détection ; ou , et du BOM), mapping de colonnes par options `--email-col --prenom-col --tags-col` avec défauts (email, first_name, tags), upsert idempotent via lib REST (réutilise les mêmes endpoints), `--dry-run` par défaut, `--apply` pour écrire, rapport final (lignes lues, contacts créés/mis à jour, tags posés, erreurs). Relançable sans doublon par construction (upsert + PK composite).
6. [x] Vue contacts dans l'admin : section "Contacts" dans la page /admin (réutilise le secret déjà saisi par FunnelDashboard) : tableau email / prénom / tags / date, champ de recherche par email, pagination simple, bouton "Exporter CSV", état vide explicite ("Base vide ou projet endormi"), erreurs affichées en toutes lettres.
7. [x] `.env.example` : ajouter les NOMS SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY commentés en français (jamais de valeur). Créer `.env.local` LOCAL (non commité, déjà ignoré) avec les valeurs copiées du .env AIOS : vérifier qu'il est bien ignoré par git avant d'y écrire.
8. [x] Vérifications temps 1 : `npm run build` (exit 0) ; grep interdits (cadratin, NEXT_PUBLIC_SUPABASE, "use client" hors composants admin existants) ; `node scripts/import-systemeio.mjs --help` et un `--dry-run` sur un CSV d'exemple commité dans `scripts/fixtures/exemple-systemeio.csv` (3 lignes fictives, domaine example.com) qui N'APPELLE PAS le réseau (le dry-run parse et rapporte sans toucher la base) ; verification record écrit dans docs/verif/s02-contacts-supabase.md, section "Temps 2 en attente".

## Tasks : temps 2 (APRÈS le réveil du projet ET le go explicite de Delphine, hors de ce run)
9. [x] Vérifier l'absence de tables tunnel_* préexistantes ; appliquer 001 via l'API de gestion (SQL) ; prouver : upsert double du même email = 1 ligne ; import du CSV d'exemple rejoué 2 fois = mêmes comptes ; recherche et export depuis l'admin ; compléter le record et la review.

## Run interdicts
- AUCUN appel réseau vers la base Supabase ni vers l'API de gestion supabase.com dans ce run (projet en pause ; engagement pris envers Delphine). Le dry-run de l'import et le build doivent passer sans réseau.
- Diff vide sur : `config.ts`, `app/page.tsx`, `app/ressource/`, `app/reserver/`, `app/merci/`, `middleware.ts`, `app/api/lead/`, `app/api/funnel/`, `app/api/cron/`, `lib/airtable.ts`, `funnels/`, `types/funnel*`, `app/t/`.
- Aucune dépendance npm ajoutée (lib REST en fetch pur, script d'import en Node pur).
- Jamais la clé service_role côté client ni dans un fichier commité ; `.env.local` jamais commité (vérifier .gitignore avant d'écrire dedans).
- Pas de tiret cadratin ; textes admin en français, tutoiement.
- Aucun push.

## The point everything turns on
L'idempotence portée par la base, pas par le code : UNIQUE(email) + upsert merge-duplicates, UNIQUE(name) sur les tags, PK composite sur les liaisons. Les trois endroits où ça peut se tromper :
1. L'upsert PostgREST sans `on_conflict=email` crée des doublons au lieu de fusionner : comparer l'appel de lib/supabase.ts à la contrainte déclarée dans 001.
2. La casse des emails : Email@X et email@x doivent être le même contact (citext ou lower()) : vérifier la migration ET la normalisation (trim + lower) côté lib.
3. Le secret admin : une route qui lit `x-admin-secret` mais oublie le repli query casserait la page existante ; une route sans timing-safe compare est acceptable ici (même niveau que l'existant), mais le secret ne doit jamais partir dans une réponse.

## Files touched
- Nouveaux : `supabase/migrations/001_tunnel_contacts.sql`, `types/contacts.ts`, `lib/supabase.ts`, `app/api/admin/contacts/route.ts`, `scripts/import-systemeio.mjs`, `scripts/fixtures/exemple-systemeio.csv`, section Contacts dans `components/admin/` (nouveau composant ContactsPanel.tsx), `docs/verif/s02-contacts-supabase.md`.
- Modifiés : `app/admin/page.tsx` (monte ContactsPanel), `components/admin/FunnelDashboard.tsx` seulement si nécessaire pour partager le secret (minimal), `.env.example` (noms commentés).

## Test strategy
Pas de runner (Test: -). Filet du temps 1 :
- Typage strict (build) sur types/contacts.ts et lib/supabase.ts.
- Le dry-run de l'import sur la fixture commitée est un test exécutable et déterministe. La fixture fait 3 lignes dont un doublon d'email volontaire (avec casse différente) : le rapport attendu est exactement "3 lignes lues, 2 contacts uniques, 4 tags à poser", exit 0, zéro appel réseau. C'est le seul test runtime du temps 1, gratuit et rejouable.
- L'idempotence réelle (upsert, re-import) ne peut PAS être prouvée sans base : c'est le cœur du temps 2, dit explicitement dans le record. Budget : 0 test runtime sur 25 au temps 1.

## Definition of Done
- Temps 1 : critères 1 (migration écrite et versionnée), 3 partiel (script + dry-run fixture), 4 partiel (endpoint export codé), 5 partiel (UI codée, build vert) ; record écrit avec la liste exacte de ce qui reste au temps 2 ; diff vide sur les interdits ; aucun appel réseau Supabase ; commits conventionnels, aucun push.
- Temps 2 (hors de ce run) : critères 2, 3, 4, 5 prouvés en vrai, record complété, puis review et ship de la story entière.
