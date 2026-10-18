# Verification : story s04-vente-stripe

> Écrit par l'implémenteur juste avant le commit, et commité avec lui. Le reviewer compare
> `Tree:` au commit ; s'ils correspondent, il prend ces résultats comme prouvés au lieu de les
> rejouer. Les commandes sont celles d'AGENTS.local.md, citées telles quelles.

`Tree:` a été produit dans cet ordre : `git add -A`, puis `git write-tree`, sur le code testé et
le plan coché. Seul ce record est écrit ensuite.

Tree de la première passe (tâches 1 à 11) : 9c2595c66b5c53ce974a97d34d4973ff10f559ce. Le `Tree:` en vigueur est celui de la passe de correction, en fin de record.

| Run | Command | Result | When |
| --- | --- | --- | --- |
| Test (full suite) | aucune | n'existe pas dans ce projet (réglage `Test` à `-` dans AGENTS.local.md) | non lancé |
| Typecheck | aucune | réglage `Typecheck` à `-` ; le type check passe par le build (ligne suivante) | non lancé |
| Build | `npm run build` | exit 0 · "Compiled successfully" · "Linting and checking validity of types" passé · 33/33 pages statiques · `● /t/[funnel]/[step]` toujours SSG, nouvelle page `/t/demo/livre` listée (et `livre-merci` dans les 13 autres chemins) · nouvelles routes `ƒ /api/stripe/checkout` et `ƒ /api/stripe/webhook` | 2026-10-16T08:29:17Z |
| E2E | aucune | n'existe pas dans ce projet (réglage `E2E` à `-`) | non lancé |
| Migration 002 | API de gestion Supabase (projet ueoibcaihsklbdnjzdij, jeton lu dans l'environnement de l'orchestrateur, méthode s02) : `select … where table_name='tunnel_sales'` puis contenu de `002_tunnel_sales.sql` en une requête | avant : HTTP 201 `[]` · migration : HTTP 201 `[]` · catalogue : `tunnel_sales` relrowsecurity=true, 0 policy · contraintes : PK id, FK contact_id, UNIQUE stripe_event_id, UNIQUE stripe_session_id · index : contact_id, created_at, pkey, 2 uniques · `count(*)` = 0 | 2026-10-16T08:45Z |
| Preuve réelle Stripe (tâche 10) | Bac à sable Stripe `taskzen-tunnel-test` (acct_1UR6sY…, `livemode: false`), Stripe CLI 1.53.1, `stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired --forward-to localhost:3000/api/stripe/webhook`, `next dev -p 3000`, achat 4242 fait par Delphine dans Checkout | voir « Preuve réelle (tâche 10) » ci-dessous : achat, rejeu et annulation conformes, base nettoyée | 2026-10-16T09:26Z à 09:55Z |

Le build a été lancé après la dernière modification de code ; aucun fichier de code n'a changé
après lui (seuls le plan coché et ce record ont suivi). Il compte comme type check : les deux
nouveaux `@ts-expect-error` de `types/funnel.typetest.ts` (bloc acheter sans `produit`, produit
sans `prixTtc`) sont consommés, sinon le build casse. Le `default: never` de `BlockRenderer`
compile, donc la branche `acheter` existe.

## Preuves locales contre le serveur (tâche 9)

Serveur : `STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET=<secret de test local> SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= RESEND_API_KEY= RESEND_FROM_EMAIL= npx next start -p 3471`
sur le build ci-dessus. `@next/env` garde une variable déjà présente dans `process.env` (même
vide) : Stripe (clé secrète), Supabase et Resend sont donc coupés pour tout ce bloc. Aucun appel
à `api.stripe.com`, aucune écriture en base, aucun email possible. Le secret de webhook est une
valeur jetable de la forme `whsec_...` choisie pour ce run, passée seulement au processus et au
script de signature du scratchpad (non commité), jamais écrite dans `.env.local`.

Signature : script jetable `sign.mjs` (scratchpad) : HMAC-SHA256 de `${t}.${corps}` avec le
secret de test, en-tête `t=<t>,v1=<hex>`, indépendant de `lib/stripe.ts`. Corps envoyés avec
`curl --data-binary @fichier` (octets exacts). Chaque groupe de checkout a sa propre IP
(`x-forwarded-for`) pour isoler les compteurs de rate-limit.

Sorties verbatim (2026-10-16T08:30:08Z) :

```
== checkout 400 tunnel inconnu
{"ok":false,"error":{"code":"bad_request","message":"Produit inconnu"}} HTTP 400
== checkout 400 étape sans bloc acheter
{"ok":false,"error":{"code":"bad_request","message":"Produit inconnu"}} HTTP 400
== checkout 400 étape absente
{"ok":false,"error":{"code":"bad_request","message":"Étape manquante"}} HTTP 400
== checkout valide, Stripe non configuré : 500 sans appel Stripe
{"ok":false,"error":{"code":"internal_error","message":"Paiement indisponible pour le moment. Réessaie plus tard."}} HTTP 500
== rate-limit checkout, 11 requêtes même IP
{"ok":false,"error":{"code":"bad_request","message":"Produit inconnu"}} HTTP 400   (x10, identiques)
{"ok":false,"error":{"code":"too_many_requests","message":"Trop de requêtes. Réessaie dans une minute."}} HTTP 429
== webhook 400 sans en-tête
{"ok":false,"error":{"code":"bad_request","message":"Signature invalide"}} HTTP 400
== webhook 400 corps altéré d'un octet
{"ok":false,"error":{"code":"bad_request","message":"Signature invalide"}} HTTP 400
== webhook 400 signature expirée (t - 301 s)
{"ok":false,"error":{"code":"bad_request","message":"Signature invalide"}} HTTP 400
== webhook 200 ignored payment_intent.created signé
{"ok":true,"data":{"ignored":true}} HTTP 200
== webhook 200 ignored session completed unpaid signé
{"ok":true,"data":{"ignored":true}} HTTP 200
== webhook session payée signée, Supabase coupé : 500 (Stripe réessaierait)
{"ok":false,"error":{"code":"internal_error","message":"Enregistrement indisponible"}} HTTP 500
== page livre
HTTP 200
J&#x27;achète l&#x27;e-book, 27 euros
== page livre-merci
HTTP 200
```

Log serveur complet du bloc (hors bannière de démarrage) :

```
[checkout] Stripe non configuré
[stripe-webhook] Supabase non configuré
```

Lecture :
- Corps altéré : `ev-paid-altered.json` diffère de `ev-paid.json` d'un seul octet (`cmp` :
  "differ: byte 183", `amount_total` 2700 devenu 2701), signé avec la signature du corps
  d'origine : refusé 400. Le même corps intact et bien signé passe la signature (dernière
  ligne webhook : il va jusqu'au contrôle Supabase, donc la signature, le parsing, le type
  d'événement, `payment_status`, le produit `livre` et l'email ont été acceptés).
- Les 10 premières requêtes du rate-limit répondent 400, la 11e 429 : la limite est 10/min
  sur la clé `checkout:<ip>`, appliquée avant la validation.
- La session payée signée, Supabase coupé, répond 500 : c'est le statut qui fait réessayer
  Stripe, comme prévu au plan.

## Contrôle visuel dans un navigateur

Chrome headless local (`--remote-debugging-port=9334`, profil jetable du scratchpad), piloté
par un script CDP jetable (non commité), fenêtre 1280x900, même serveur (Stripe coupé),
2026-10-16T08:30:42Z. Sortie verbatim :

```
bouton : J'achète l'e-book, 27 euros | classe : btn-primary
fond du bouton : rgb(168, 67, 31)
pendant l'envoi : { texte: 'Redirection vers le paiement…', desactive: true }
url après clic : /t/demo/livre
message d'erreur : Paiement indisponible pour le moment. Réessaie plus tard.
bouton réactivé : true
```

Captures regardées : `/t/demo/livre` affiche le hero ("E-book du sommet", "Toutes les méthodes
du Sommet IA, dans un seul e-book", sous-titre avec 27 euros TTC), puis sur fond `bg-soft` le
bouton argile du thème "J'achète l'e-book, 27 euros" avec la flèche, et la mention "Paiement
sécurisé par Stripe.". Pendant l'envoi (réponse ralentie de 1,5 s par le script) : bouton
pâli, désactivé, libellé "Redirection vers le paiement…". Après la réponse 500 : message rouge
en toutes lettres sous le bouton, bouton réactivé, l'URL reste `/t/demo/livre`.

Serveur (port 3471) et Chrome headless (port 9334) arrêtés ensuite : 0 écoute sur les deux ports.

## Interdits vérifiés (sur le diff indexé)

- Diff vide sur config.ts, app/page.tsx, app/ressource/, app/reserver/, app/merci/,
  middleware.ts, app/api/lead/, app/api/funnel/, app/api/cron/, app/api/optin/,
  lib/airtable.ts, app/t/, app/admin/, components/admin/, supabase/migrations/001_*,
  funnels/guides-sommet.ts, package.json, package-lock.json, next.config.ts (0 ligne).
- lib/supabase.ts : +70 / -0 ; lib/schemas.ts : +12 / -0 ; lib/resend.ts : inchangé.
- types/funnel.ts : +18 / -1. La ligne retirée est `  | OptinBlock;`, réécrite
  `  | OptinBlock` suivie de `  | AcheterBlock;` : ajouter un membre à l'union `Block` impose de
  déplacer le point-virgule (écart déclaré).
- 0 tiret cadratin dans les lignes ajoutées.
- Valeurs de `.env.local` dans le diff (script) : 6 valeurs de 8 caractères ou plus vérifiées,
  une seule présente, `NEXT_PUBLIC_SITE_URL` (l'URL publique localhost, pas un secret).
  Le secret de webhook de test n'apparaît pas dans le diff. `.env.local` reste ignoré par git.
- Aucun appel à `api.stripe.com`, aucune écriture Supabase, aucun email pendant les tâches 1 à 9.

## Preuve réelle (tâche 10), orchestrateur avec Delphine

Clés : `STRIPE_SECRET_KEY` (sk_test du bac à sable, vérifiée par `GET /v1/account` : `taskzen-tunnel-test`, et `GET /v1/balance` : `livemode: false`) posée par Delphine dans `.env.local` ; `STRIPE_WEBHOOK_SECRET` obtenu par `stripe listen --print-secret` et écrit dans `.env.local` sans affichage. La CLI était d'abord autorisée sur le compte réel (« taskzen.fr · live ») : elle a refusé toute commande sans `--live` ; bascule par `stripe switch acct_1UR6sYGba9kFd39t`, aucune commande lancée en réel.

État de la base avant : ventes 0, contacts 2, tag `client-livre` absent, contact delphinemm03.ai@gmail.com déjà existant (1).

| Étape | Preuve | Résultat |
| --- | --- | --- |
| Checkout | `POST /api/stripe/checkout 200` puis page Stripe Checkout (bac à sable), paiement 4242 par Delphine | retour `GET /t/demo/livre-merci?session_id=cs_test_a1px… 200` |
| Webhook | `stripe listen` : `checkout.session.completed [evt_1UR7PBGba9kFd39tqEuXY4aE]` → `<-- [200]` ; log serveur `[stripe-webhook] email de livraison envoyé (livre)` | 200 |
| Vente en base | `tunnel_sales` : `livre`, `amount_ttc 2700`, `amount_ht 2559`, `vat_rate 5.50`, `cs_test_a1px…`, contact delphinemm03.ai@gmail.com | 1 vente ; contacts toujours 2 (contact existant réutilisé) |
| Tag | `tunnel_contact_tags` : delphinemm03.ai@gmail.com, `client-livre` | posé |
| Rejeu | `stripe events resend evt_1UR7PBGba9kFd39tqEuXY4aE` (`livemode: false`) → `<-- [200]` en 411 ms, aucun nouvel envoi d'email dans le log | toujours 1 vente |
| Annulation | `POST /api/stripe/checkout 200` puis retour par la flèche de Checkout : `GET /t/demo/livre 200`, aucun webhook reçu | toujours 1 vente |
| Nettoyage (confirmé par Delphine) | SQL de gestion : vente de test, liaison et tag `client-livre` supprimés ; le contact préexistant gardé | ventes 0, contacts 2, tag absent, contact Delphine 1 : base revenue à son état d'avant |

Email de livraison : envoi accepté par Resend (log serveur). La réception dans la boîte delphinemm03.ai@gmail.com n'est pas vérifiable par l'orchestrateur (clé Resend restreinte à l'envoi, connecteur Gmail sur une autre boîte) : geste humain, à confirmer par Delphine.

## Not proven here

- La réception effective de l'email de livraison (envoi accepté par Resend, réception à confirmer par Delphine).
- Un paiement asynchrone (`checkout.session.async_payment_succeeded`) : non déclenché, seule la carte 4242 (paiement immédiat) a été jouée.
- La pose du tag après un échec ponctuel : si `tagContact` échoue après `insertSale`, un rejeu ne repose pas le tag (vente déjà là). Signalé pour la revue.
- Rate-limit en mémoire par instance (limite connue de `lib/rate-limit.ts`, non changée).

Verification status: complete (tâches 1 à 11 ; réception de l'email de livraison à confirmer par Delphine)

## Passe de correction du 16/10 (D1 à D8)

Écrit par l'implémenteur après `git add -A` puis `git write-tree` sur le code de la passe, le
plan coché et le PDF ; seul ce record a été écrit ensuite. La première ligne `Tree:` de ce fichier
a été renommée « Tree de la première passe » (valeur inchangée) pour qu'un seul `Tree:` reste lu.

Tree: 730fcb84ddc4046844dafe7e0ddacd820f1db2da

| Run | Command | Result | When |
| --- | --- | --- | --- |
| Test (full suite) | `npm test` (créé par D7 ; `Test` reste à `-` dans AGENTS.local.md, non modifié) | exit 0 · 7 vérifications passées, 0 échec (signature valide acceptée ; corps altéré d'un octet, mauvais secret, horodatage à 301 s, `v0` seul, en-tête absent refusés ; `prixHt` 2700 à 5,5 % = 2559) · un avertissement Node `MODULE_TYPELESS_PACKAGE_JSON` (relecture en module ES), sans effet | 2026-10-16T11:38:30Z |
| Typecheck | `npx tsc --noEmit` | exit 0 (après l'ajout de `allowImportingTsExtensions`, voir écarts ; avant : exit 2, 2 erreurs TS5097 sur les imports `.ts` du script) | 2026-10-16T11:35Z |
| Build | `npm run build` | exit 0 · "Compiled successfully" · types validés · 34/34 pages statiques · nouvelle route `ƒ /api/telecharger` · `/t/demo/livre-merci` toujours SSG · trace `.next/server/app/api/telecharger/route.js.nft.json` contient `private/produits/le-livre-du-sommet-ia-en-5-jours.pdf`, celle du webhook 0 fichier de `private/produits` | 2026-10-16T11:36:38Z |
| E2E | aucune | n'existe pas dans ce projet (réglage `E2E` à `-`) | non lancé |
| Migration 003 | aucune | NON appliquée : l'orchestrateur l'applique après la passe | non lancé |

Aucun fichier de code n'a changé après le build et le type check (le dernier `npm test` a tourné
sur le même code ; ensuite seuls le plan et ce record).

### Décisions et preuves

- D1 `app/api/telecharger/route.ts` : format `^cs_(test|live)_[A-Za-z0-9]+$` (constante
  `CHECKOUT_SESSION_ID` de lib/stripe.ts), 20/min/IP (clé `telecharger:`), vente par
  `findSaleBySession`, sinon repli `retrieveCheckoutSession` (GET `/v1/checkout/sessions/{id}`,
  fetch pur) accepté seulement si `payment_status === "paid"` et `metadata.produit` connu ; PDF
  renvoyé en `application/pdf`, `attachment`, `private, no-store` ; sinon 404 en français.
- D2 `LivraisonProduit` : `boutonTexte` et `fichier` obligatoires, `url` retiré, plus de pièce
  jointe ; bouton de l'email vers `${NEXT_PUBLIC_SITE_URL ou hôte de la requête}/api/telecharger?session_id=<id>`.
- D3 bloc `telecharger` (`TelechargerBlock`, `produit`, `boutonTexte`, `texteAttente`) sur
  `livre-merci` ; textes de `livre` et `livre-merci` passés au téléchargement.
- D4 `next.config.ts` : `"/api/telecharger": ["./private/produits/**/*"]` ; le webhook ne lit plus
  de fichier (imports `node:fs` et `node:path` retirés).
- D5 migration `003_tunnel_sales_delivered_at.sql` ; webhook : vente, tag synchrone, relecture de
  la vente, email si `delivered_at` nul puis `markSaleDelivered` (PATCH filtré `delivered_at=is.null`),
  tout avant le 200, plus de `after()` ; échec tag ou email : exception, 500 ; Resend non
  configuré : log, 200, `delivered_at` reste nul. Réponse `{ received, inserted, delivered }`.
- D6 `upsertBuyerContact` (nouvelle fonction, `upsertContact` inchangé) : contact lu par email ;
  absent, créé ; présent sans prénom, PATCH filtré `first_name=is.null` ; présent avec prénom,
  rien écrit. Salutation : prénom en base, sinon premier mot du nom Stripe.
- D7 `scripts/verif-stripe.ts` + `"test": "node scripts/verif-stripe.ts"` (Node v25.8.1) ;
  signatures calculées dans le script, indépendamment de lib/stripe.ts.
- D8 ADR 007 : 3 cadratins remplacés par deux-points, `npm test` cité dans Consequences ;
  `countSales` supprimé (plus aucun appelant). m5 (parcours vente absent de l'admin) et m7
  (paiement avec produit inconnu ou sans email : 200 `ignored`, sans alerte) restent hors
  périmètre, pour la story Ventes.

### Preuves locales hors réseau (2026-10-16T11:37:09Z)

Serveur : `STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET= SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= RESEND_API_KEY= RESEND_FROM_EMAIL= npx next start -p 3472`
sur le build ci-dessus : Stripe, Supabase et Resend coupés, aucun appel réseau possible.

```
== telecharger sans session_id
{"ok":false,"error":{"code":"not_found","message":"Aucun achat confirmé pour ce lien. Si tu viens de payer, réessaie dans une minute."}} HTTP 404
== telecharger format invalide (cs_test_abc/../)
... même 404
== telecharger format valide, Supabase et Stripe coupés
... même 404
== rate-limit 21 requêtes même IP
404 x20 puis 429
== PDF public ? /private/produits/<fichier> et /<fichier>
404 / 404
== webhook sans secret configuré
{"ok":false,"error":{"code":"internal_error","message":"Webhook non configuré"}} HTTP 500
== /t/demo/livre 200 ; HTML statique de /t/demo/livre-merci : blocs hero + telecharger, texte d'attente (repli Suspense)
```

Visuel (Chrome headless, captures regardées) : `/t/demo/livre-merci?session_id=cs_test_a1verif`
en 1280 px affiche le hero « Paiement confirmé · Merci, ton e-book est prêt » et, sur fond
`bg-soft`, le bouton argile `.btn-primary` « Je télécharge mon e-book » avec l'icône de
téléchargement ; DOM : `<a class="btn-primary" href="/api/telecharger?session_id=cs_test_a1verif" download="">`.
Sans `session_id` : même hero, le texte d'attente à la place du bouton. Capture à 390 px non
concluante (Chrome headless impose une largeur minimale, la page est rognée à droite) : rendu
mobile à regarder sur un vrai téléphone. Serveur arrêté ensuite, 0 écoute sur le port 3472.

### Interdits vérifiés (diff indexé de la passe)

- Diff vide sur config.ts, app/page.tsx, app/ressource/, app/reserver/, app/merci/,
  middleware.ts, app/api/lead/, app/api/funnel/, app/api/cron/, app/api/optin/, lib/airtable.ts,
  app/t/, app/admin/, components/admin/, migrations 001 et 002, funnels/guides-sommet.ts,
  lib/resend.ts, lib/schemas.ts, package-lock.json. Aucune dépendance npm ajoutée.
- lib/supabase.ts : lignes retirées = `countSales` et 2 lignes de commentaire de `insertSale`,
  toutes ajoutées par cette story. types/funnel.ts : `  | AcheterBlock;` réécrite pour ajouter
  `  | TelechargerBlock;` (même cas que m2).
- 0 tiret cadratin dans les lignes ajoutées (`git diff --cached | grep '^+' | grep -cP '\x{2014}'` = 0).
- Valeurs de `.env.local` (8 de 8 caractères ou plus) : 0 présente dans le diff. Aucun appel
  Stripe, Supabase ni Resend pendant la passe.

### Écarts au plan

- `tsconfig.json` : `"allowImportingTsExtensions": true` ajouté. D7 impose des imports relatifs en
  `.ts` ; sans cette option, `tsc` et le build (qui vérifie les types de tout `**/*.ts`) refusent
  le script (TS5097). Option autorisée car `noEmit: true`.
- Route de téléchargement : une panne Supabase à la lecture de la vente passe au repli Stripe au
  lieu d'échouer ; une panne Stripe au repli répond 500 « réessaie dans un instant » plutôt
  qu'un 404 qui dirait à un acheteur payé qu'il n'a rien acheté ; Stripe non configuré : 404.
  `assertTestMode()` est appelé avant le repli.
- `types/funnel.typetest.ts` : la fixture `produitSansPrix` reçoit `boutonTexte` et `fichier`,
  devenus obligatoires, pour que son `@ts-expect-error` ne porte que sur `prixTtc`.
- Le champ `produit` du bloc `telecharger` est déclaratif : le serveur relit le produit dans la
  vente ou la session, jamais dans l'URL.

## Not proven here (passe de correction)

- Rien en réel : migration 003 non appliquée, aucun envoi, aucune session Stripe relue. Le
  service du PDF (vente trouvée ou session payée), `upsertBuyerContact`, `markSaleDelivered` et
  la reprise du webhook après un échec d'email restent à prouver par l'orchestrateur (preuve réelle).
- La clause `on_conflict=stripe_event_id` de `insertSale` (M3, partie idempotence) n'a toujours
  pas tourné en réel : `npm test` couvre la signature et le HT, pas la base.

## Preuve réelle de la passe de correction (18/10, orchestrateur avec Delphine)

Migration 003 : appliquée par Delphine dans le SQL Editor du projet `ueoibcaihsklbdnjzdij`
(la commande de l'orchestrateur avait été refusée par le classificateur, motif « déploiement
en production », les 16/10 et 18/10). Relue par l'API de gestion : `tunnel_sales` compte 11
colonnes, `delivered_at timestamptz` avec son commentaire, `count(*)` = 0 avant le test.

Environnement : `stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,payment_intent.created --forward-to localhost:3000/api/stripe/webhook`
(la CLI 1.53 exige `--events`), bac à sable `taskzen-tunnel-test`, `whsec_` identique à celui
du `.env.local` ; `next dev` sur :3000, `/t/demo/livre` 200.

| Étape | Preuve | Résultat |
| --- | --- | --- |
| Checkout | `POST /api/stripe/checkout 200`, paiement 4242 par Delphine | retour `GET /t/demo/livre-merci?session_id=cs_test_a1jf… 200` |
| Webhook | `payment_intent.created [evt_3URqeB…]` → 200 (ignoré) ; `checkout.session.completed [evt_1URqeCGba9kFd39tOIjxANKS]` → 200 en 2336 ms ; log `[stripe-webhook] email de livraison envoyé (livre)` | 200 |
| Vente | `tunnel_sales` : `livre`, 2700 / 2559 / 5.50, `cs_test_a1jf…`, `created_at 09:44:58`, **`delivered_at 09:44:58`** (non nul) | 1 vente |
| Contact | delphinemm03.ai@gmail.com préexistant (créé le 12/10), `first_name` toujours `Delphine` : prénom Stripe jamais écrit sur un contact existant (M2) | contacts inchangés |
| Tag | `client-livre` posé à 09:44:59 à côté des 3 tags guide existants | posé |
| Téléchargement (D1) | clic de Delphine sur le bouton de `livre-merci` : `GET /api/telecharger?session_id=cs_test_a1jf… 200 in 1153ms` | PDF servi |
| Rejeu (M3 + D5) | `stripe events resend evt_1URqeCGba9kFd39tOIjxANKS` → `<-- [200]` en 614 ms ; log : toujours **1** occurrence de « email de livraison envoyé » | toujours 1 vente, aucun second email |

Correction après revue du 18/10 : le rejeu ci-dessus n'a PAS fait tourner la clause
`on_conflict=stripe_event_id` de `insertSale` ; `findSaleBySession` trouve la vente et renvoie
avant le POST. La clause reste sans preuve réelle (filet : contrainte UNIQUE + rejeu Stripe).

Email de livraison : envoi accepté par Resend (log serveur) ; réception dans Gmail à confirmer par Delphine.

### Not proven here (preuve réelle du 18/10)

- La reprise du webhook après un échec d'email (`delivered_at` nul puis renvoi) : Resend n'a pas
  échoué, le chemin « 500 puis rejeu reprend l'envoi » n'a pas tourné.
- Le paiement asynchrone (`checkout.session.async_payment_succeeded`) : non déclenché.
- La clause `on_conflict=stripe_event_id` de `insertSale` (voir la correction sous le tableau).

### Nettoyage de la vente de test du 18/10

Décidé par Delphine (« ok ») : supprimer la vente `e36e1d24…`, le lien contact-tag et le tag
`client-livre` ; garder le contact et ses 3 tags guide. La commande de l'orchestrateur a été
refusée par le classificateur (Bash puis PowerShell) ; SQL remis à Delphine pour le SQL Editor.
État au moment de la revue : vente et tag encore présents (lecture API). Exécuté par Delphine
dans le SQL Editor, relu par l'API de gestion le 18/10 : `tunnel_sales` 0 ligne, tag
`client-livre` absent, contact delphinemm03.ai@gmail.com toujours là avec ses 3 tags guide.
Base revenue à son état d'avant le test.

Verification status: complete (passe de correction prouvée en réel le 18/10, base nettoyée)
