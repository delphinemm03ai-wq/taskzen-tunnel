# Verification : story s02-contacts-supabase (temps 1 et temps 2)

> Écrit par l'implémenteur juste avant le commit, et commité avec lui.
> Temps 1 : tâches 1 à 8 du plan (commit e08452e, tree e96374a1680c1de9c5cf078bf37b426c71b6c88d
> à l'époque). Temps 2 : tâche 9, sur le projet Supabase dédié "tunnel-maison"
> (ref ueoibcaihsklbdnjzdij), voir la section "Temps 2 : prouvé sur base vivante".
> Aucun fichier de code n'a changé au temps 2 : seuls ce record et la case de la tâche 9
> du plan (sous `docs/`) bougent.

Tree: 8dab18e69f50ed60e1986205538be957d7a80395

| Run | Command | Result | When |
| --- | --- | --- | --- |
| Test (full suite) | aucune | n'existe pas dans ce projet (réglage `Test` non défini dans AGENTS.local.md) | non lancé |
| Typecheck | aucune | réglage `Typecheck` non défini ; le type check passe par le build (ligne suivante) | non lancé |
| Build | `npm run build` | exit 0 · "Compiled successfully" · "Linting and checking validity of types" passé · 14/14 pages statiques · nouvelle route `ƒ /api/admin/contacts` | 2026-10-10T17:10:21Z |
| Dry-run import (test runtime du plan) | `node scripts/import-systemeio.mjs scripts/fixtures/exemple-systemeio.csv --dry-run` (lancé avec `fetch` remplacé par une fonction qui lève une erreur, et SUPABASE_* retirées de l'env) | exit 0 · "3 lignes lues, 2 contacts uniques, 4 tags à poser" · Erreurs : 0 · aucun appel réseau | 2026-10-10T17:11:44Z |
| Aide du script | `node scripts/import-systemeio.mjs --help` | exit 0 | 2026-10-10T17:11:44Z |
| E2E | aucune | n'existe pas dans ce projet (réglage `E2E` non défini) | non lancé |

Le build a été lancé après la dernière modification de code (route.ts, messages zod en
français) ; aucune modification de code après lui. Il compte comme type check (AGENTS.local.md :
"`npm run build` type-checks").

Sortie verbatim du dry-run :

```
Import Systeme.io : scripts/fixtures/exemple-systemeio.csv
Séparateur ";", encodage utf-8 (BOM)
Mode : dry-run (rien n'est écrit, aucun appel réseau). Relance avec --apply pour écrire.
3 lignes lues, 2 contacts uniques, 4 tags à poser
Erreurs : 0
```

La fixture (BOM UTF-8, séparateur `;`) contient `alice.martin@example.com` et
`Alice.Martin@Example.com` : la fusion par email normalisé donne 2 contacts uniques, et les
paires contact/tag uniques sont alice/prospect, alice/sommet-ia, alice/vip, bob/client = 4.

## Vérifications complémentaires du temps 1 (hors base)

- **Route `/api/admin/contacts` en local** (`next start`, ADMIN_SECRET=valeur de test,
  SUPABASE_URL pointé sur 127.0.0.1, jamais sur Supabase) :
  - sans secret ou secret faux : 401 `Secret invalide` ; `/api/funnel/stats` toujours 401 sans secret ;
  - base injoignable (127.0.0.1:9) : 500 `Supabase injoignable (projet en pause ?) : fetch failed`, en json comme en csv ;
  - `page=0` : 400 `Page invalide` ; `format=xml` : 400 `Format invalide (json ou csv)` ;
  - contre un faux PostgREST local jetable (scratchpad, non commité) : json 200 avec tags aplatis
    et triés, `total` lu dans Content-Range ; csv 200, BOM `ef bb bf`, en-tête
    `email;prenom;tags;cree_le`, `Content-Disposition: attachment`, cellule `=Bob; "le"` exportée
    `"'=Bob; ""le"""` (anti-injection Excel + échappement) ; recherche `a*l%` envoyée en
    `email=ilike.*al*` (jokers retirés) ; en-tête `apikey` présent ; secret jamais dans la réponse.
  Ce faux serveur rejoue des lignes fixes : il prouve la mise en forme et les paramètres envoyés,
  pas le comportement réel de PostgREST.
- **Interdits** : 0 tiret cadratin dans les lignes ajoutées ; `NEXT_PUBLIC_SUPABASE` absent du
  code (seule occurrence : le texte du plan) ; seul nouveau `"use client"` :
  `components/admin/ContactsPanel.tsx` ; diff vide sur config.ts, app/page.tsx, app/ressource/,
  app/reserver/, app/merci/, middleware.ts, app/api/lead/, app/api/funnel/, app/api/cron/,
  lib/airtable.ts, funnels/, types/funnel*, app/t/ ; package.json et package-lock.json inchangés.
- **Secrets** : `.env.local` créé après `git check-ignore .env.local` (règle `.gitignore:18`),
  non suivi par git ; aucune des deux valeurs présente dans le diff indexé (vérifié par script).
- **Zéro appel réseau vers Supabase ou api.supabase.com** au temps 1.

## Temps 2 : prouvé sur base vivante

Projet Supabase dédié "tunnel-maison" (ref ueoibcaihsklbdnjzdij, neuf et vide), go de Delphine
donné pour ce run. Clés lues dans `.env.local` (ignoré par git) ; aucune valeur de clé ou de
jeton n'apparaît dans les sorties ci-dessous ni dans le dépôt. Les appels à l'API de gestion
passent par un petit script jetable du scratchpad (non commité) qui envoie le SQL en POST sur
`https://api.supabase.com/v1/projects/<ref>/database/query` avec `SUPABASE_TUNNEL_ACCESS_TOKEN`.
Le SQL de gestion sert à appliquer la migration, à inspecter le catalogue, à compter et à
nettoyer ; les assertions sur le comportement passent par le code de l'application.

| Run | Command | Result | When |
| --- | --- | --- | --- |
| Tables préexistantes | API de gestion : `select table_schema, table_name from information_schema.tables where table_name like 'tunnel%'` | HTTP 201 · `[]` (zéro table tunnel_*) | 2026-10-10T18:08:00Z |
| Migration | API de gestion : contenu de `supabase/migrations/001_tunnel_contacts.sql` en une seule requête | HTTP 201 · `[]` · exit 0 | 2026-10-10T18:08:12Z |
| Catalogue après migration | API de gestion : pg_class.relrowsecurity + pg_policies ; information_schema.table_constraints ; type de `email` | voir détail 1 | 2026-10-10T18:08:25Z |
| Upsert double (lib) | `node <scratchpad>/upsert-proof.mts` : importe `lib/supabase.ts`, appelle `upsertContact` deux fois, puis `listContacts` et `countContacts` | exit 0 · 1 seule ligne, même id, prénom mis à jour (détail 2) | 2026-10-10T18:08:44Z |
| Contrainte citext seule | POST PostgREST brut avec l'email en MAJUSCULES (sans la normalisation de la lib) | HTTP 200 · toujours 1 ligne (détail 2) | 2026-10-10T18:09:23Z |
| Import, 1er passage | `node scripts/import-systemeio.mjs scripts/fixtures/exemple-systemeio.csv --apply` | exit 0 · 2 créés, 0 mis à jour, 4 tags nouveaux · base : 2 contacts, 4 tags, 4 liaisons (détail 3) | 2026-10-10T18:09:50Z |
| Import, 2e passage | même commande | exit 0 · 0 créé, 2 mis à jour, 0 nouveau, 4 déjà posés · base : 2 / 4 / 4, inchangée (détail 3) | 2026-10-10T18:09:52Z |
| Route admin sur base vivante | `ADMIN_SECRET=<valeur de test locale> npx next start -p 3457` (build du temps 1, code inchangé) puis `curl` | 200 recherche, 200 liste, 401 mauvais secret, 200 export CSV avec BOM (détail 4) | 2026-10-10T18:10:25Z à 18:10:37Z |
| RLS clé anon | `node <scratchpad>/rls-proof.mjs` : GET sur les 3 tables et POST avec la clé anon | 200 `[]` sur les 3 tables alors que la base contient 2 contacts ; POST refusé 401 / 42501 (détail 5) | 2026-10-10T18:10:53Z |
| Nettoyage | API de gestion : suppression des contacts et tags de la fixture | base : 0 contact, 0 tag, 0 liaison ; route : `total: 0` | 2026-10-10T18:11:12Z |

### Détail 1 : catalogue après migration

```
[{"relname":"tunnel_contact_tags","relrowsecurity":true,"policies":0},{"relname":"tunnel_contacts","relrowsecurity":true,"policies":0},{"relname":"tunnel_tags","relrowsecurity":true,"policies":0}]
[{"table_name":"tunnel_contact_tags","constraint_type":"PRIMARY KEY","cols":"contact_id,tag_id"},{"table_name":"tunnel_contacts","constraint_type":"PRIMARY KEY","cols":"id"},{"table_name":"tunnel_contacts","constraint_type":"UNIQUE","cols":"email"},{"table_name":"tunnel_tags","constraint_type":"PRIMARY KEY","cols":"id"},{"table_name":"tunnel_tags","constraint_type":"UNIQUE","cols":"name"}]
[{"attname":"email","typ":"citext","extname":"citext","ext_schema":"extensions"}]
```

Les trois tables existent, RLS activée, zéro policy ; UNIQUE(email) en citext (extension dans
le schéma `extensions`), UNIQUE(name), PK composite (contact_id, tag_id).

### Détail 2 : upsert double

Via `lib/supabase.ts` (le code sous test) : `upsertContact({ email: "Test.Idempotence@Example.com", firstName: "Premier" })`
puis `upsertContact({ email: "test.idempotence@example.com", firstName: "Second" })`.

```
1er upsert : { email: 'test.idempotence@example.com', first_name: 'Premier', id_suffix: '41fada' }
2e upsert  : { email: 'test.idempotence@example.com', first_name: 'Second', id_suffix: '41fada' }
même id : true | updated_at avancé : true
listContacts(search) : 1 ligne(s) [ { email: 'test.idempotence@example.com', first_name: 'Second', tags: [] } ]
countContacts(search) : 1
```

`countContacts` a été appelé avec `"TEST.IDEMPOTENCE"` : la recherche ilike est insensible à la casse.

Contrôle de la migration seule, sans la normalisation de la lib : un POST PostgREST brut
`on_conflict=email` avec `TEST.IDEMPOTENCE@EXAMPLE.COM` répond 200 et la base garde 1 seule
ligne (`[{"email":"TEST.IDEMPOTENCE@EXAMPLE.COM","first_name":"Troisieme"}]`). La contrainte
citext fusionne bien les casses. Constat : merge-duplicates réécrit aussi la colonne email
avec la casse envoyée ; sans conséquence ici, car lib/supabase.ts et le script d'import
envoient toujours l'email en minuscules. Contact de test supprimé ensuite par l'API de gestion
(réponse `[{"email":"TEST.IDEMPOTENCE@EXAMPLE.COM"}]`), base revenue à 0 / 0 / 0 avant l'import.

### Détail 3 : import rejoué deux fois (sorties verbatim)

1er passage (exit 0) :

```
Import Systeme.io : scripts/fixtures/exemple-systemeio.csv
Séparateur ";", encodage utf-8 (BOM)
Mode : apply (écriture dans Supabase).
3 lignes lues, 2 contacts uniques, 4 tags à poser
Contacts créés : 2, mis à jour : 0
Tags posés : 4 nouveaux, 0 déjà posés
Erreurs : 0
```

Comptes en base : `[{"contacts":2,"tags":4,"liens":4}]`

2e passage (exit 0) :

```
Import Systeme.io : scripts/fixtures/exemple-systemeio.csv
Séparateur ";", encodage utf-8 (BOM)
Mode : apply (écriture dans Supabase).
3 lignes lues, 2 contacts uniques, 4 tags à poser
Contacts créés : 0, mis à jour : 2
Tags posés : 0 nouveaux, 4 déjà posés
Erreurs : 0
```

Comptes en base : `[{"contacts":2,"tags":4,"liens":4}]` (identiques : aucun doublon).

### Détail 4 : route `/api/admin/contacts` sur base vivante

`next start` sur le build du temps 1 (aucun code modifié depuis), `.env.local` chargé par Next,
`ADMIN_SECRET` = valeur de test locale passée seulement à ce processus.

- `?search=alice`, en-tête `x-admin-secret` : HTTP 200,
  `{"contacts":[{"email":"alice.martin@example.com","first_name":"Alice",...,"tags":["prospect","sommet-ia","vip"]}],"total":1,"page":1,"pageSize":25}`.
- sans recherche, secret en query `?secret=` : HTTP 200, 2 contacts (bob : `["client"]`,
  alice : `["prospect","sommet-ia","vip"]`), `total: 2`.
- `?search=ALICE.MARTIN` : HTTP 200, alice trouvée (insensible à la casse).
- `?search=personne` : HTTP 200, `{"contacts":[],"total":0,"page":1,"pageSize":25}`.
- mauvais secret (en-tête) : HTTP 401 `{"ok":false,"error":{"code":"unauthorized","message":"Secret invalide"}}` ;
  même 401 sur `format=csv&secret=faux`.
- `?format=csv` : HTTP 200, `content-type: text/csv; charset=utf-8`,
  `content-disposition: attachment; filename="contacts-2026-10-10.csv"`, trois premiers octets
  `ef bb bf` (BOM), contenu :

```
email;prenom;tags;cree_le
bob.durand@example.com;Bob;client;2026-10-10T18:09:50.936661+00:00
alice.martin@example.com;Alice;prospect,sommet-ia,vip;2026-10-10T18:09:50.936661+00:00
```

  Le secret de test n'apparaît pas dans l'export (`grep -c` : 0).
- Après nettoyage : HTTP 200, `{"contacts":[],"total":0,...}` (état vide côté API).

### Détail 5 : RLS, clé anon

```
tunnel_contacts (anon, apikey + Bearer) : HTTP 200 []
tunnel_tags (anon, apikey + Bearer) : HTTP 200 []
tunnel_contact_tags (anon, apikey + Bearer) : HTTP 200 []
tunnel_contacts (anon, apikey seul) : HTTP 200 []
POST tunnel_contacts (anon) : HTTP 401 {"code":"42501","details":null,"hint":null,"message":"new row violates row-level security policy for table \"tunnel_contacts\""}
```

Au même moment, la base contenait 2 contacts, 4 tags, 4 liaisons (compté par l'API de gestion
juste après) : la clé anon ne voit rien et ne peut rien écrire.

### Nettoyage décidé

Les lignes de la fixture (`alice.martin@example.com`, `bob.durand@example.com`, domaine réservé
example.com) et les 4 tags qu'elles avaient créés (`client`, `prospect`, `sommet-ia`, `vip` ;
base neuve, donc créés par la fixture seule) n'ont rien à faire dans la base de production :
supprimés après les preuves. Réponse de gestion :
`[{"contacts_supprimes":"alice.martin@example.com,bob.durand@example.com","tags_supprimes":"client,prospect,sommet-ia,vip"}]`,
puis comptes `[{"contacts":0,"tags":0,"liens":0}]`. Les liaisons partent par `on delete cascade`.
Le contact de test de l'upsert double a été supprimé de la même manière. La base est vide,
tables et contraintes en place.

### Autres vérifications du temps 2

- Interdits : aucun fichier de code, de config ni `package.json` modifié au temps 2
  (`git status` vide et `git diff e08452e --stat` vide avant l'écriture de ce record) ; diff
  vide sur les chemins protégés du plan par construction.
- Build et type check : non relancés, aucun code n'a changé depuis le build du temps 1
  (même contenu hors `docs/`).
- Le serveur local a été arrêté après les essais (port 3457 libéré).

## Not proven here

- **Aucun contrôle visuel dans un navigateur**, ni au temps 1 ni au temps 2 : aucun outil
  navigateur pilotable dans cette session (pas de Playwright dans le projet, pas de MCP
  navigateur). La route qui alimente le panneau Contacts est prouvée sur base vivante
  (liste, recherche, export, état vide côté API, 401), mais l'affichage du panneau lui-même
  (tableau, champ de recherche, pagination, bouton "Exporter CSV", texte d'état vide, erreurs)
  n'a pas été vu. À faire par Delphine ou en review : ouvrir `/admin` et saisir le secret.
- L'ouverture du CSV exporté dans Excel n'a pas été faite : le BOM est vérifié octet par
  octet, mais la fixture ne contient aucun accent.
- La pagination au-delà de 25 contacts n'a pas été exercée sur base vivante (2 contacts).
- Lint et format : pas de commande dédiée au-delà du lint intégré au build.

Verification status: complete (temps 1 et temps 2), sauf contrôle visuel du panneau Contacts
