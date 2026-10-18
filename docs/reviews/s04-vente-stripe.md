# Revue : story s04-vente-stripe

> Revue en contexte neuf (agent reviewer), 18/10/2026. Diff relu : `git diff main...feature/s04-vente-stripe` (27 fichiers, +1593/-2, 13 commits de 2b07812 à e505046). Worktree propre en fin de revue (`git diff --exit-code` = 0).
> Ce rapport remplace la revue du 16/10 (commit 99fd347), qui ne portait que sur la première passe et est périmée.

Review status: complete

**En bref.** Aucun critique. Les trois majeurs du 16/10 : M1 (tag et email tentés une fois) résolu, M2 (prénom Stripe écrasant un contact connu) résolu, M3 résolu à moitié : la signature a maintenant un filet rejouable qui mord, l'anti-doublon n'en a toujours pas et le record affirme à tort l'avoir exercé en réel. Deux majeurs restent, tous deux sur le record et l'état de la base, pas sur une ligne de code qui casserait un paiement.

## Conformité au plan
- [x] Tâches 1 à 11 présentes, décisions D1 à D8 de la passe de correction présentes : route `GET /api/telecharger` (D1), `LivraisonProduit` avec `fichier` obligatoire et sans pièce jointe (D2), bloc `telecharger` (D3), `outputFileTracingIncludes` pour `/api/telecharger` (D4), migration 003 + `markSaleDelivered` + tag synchrone + email gardé par `delivered_at`, plus de `after()` dans le webhook (D5), `upsertBuyerContact` sans écrasement de prénom (D6), `scripts/verif-stripe.ts` lancé par `npm test` (D7), ADR 007 sans cadratin et `countSales` supprimé (D8).
- [x] Interdits vérifiés sur le diff : aucun fichier de `config.ts`, `app/page.tsx`, `app/ressource/`, `app/reserver/`, `app/merci/`, `middleware.ts`, `app/api/lead/`, `app/api/funnel/`, `app/api/cron/`, `app/api/optin/`, `lib/airtable.ts`, `app/t/`, `app/admin/`, `components/admin/`, `supabase/migrations/001_*`, `funnels/guides-sommet.ts`, `lib/resend.ts`, `package-lock.json` n'apparaît dans les 27 fichiers du diff. `lib/schemas.ts` : +12/-0. `lib/supabase.ts` : seules lignes retirées = `countSales` et deux lignes de commentaire, toutes ajoutées par la story. Aucune dépendance npm (`package.json` : seul le script `test` ajouté). `.env.local` absent du diff ; seul `.env.example` y figure, avec des clés commentées et vides.
- [x] Écarts déclarés au record et confirmés : `tsconfig.json` (`allowImportingTsExtensions`, m2), fixture `produitSansPrix` complétée, `types/funnel.ts` une ligne réécrite pour étendre l'union.
- [x] Cadratins : `git diff main...HEAD | grep -cP '\x{2014}'` = 2. Décomposition : 1 ligne de contexte préexistante sur main dans `.env.example` (ligne non ajoutée), 1 ligne ajoutée dans l'ancien `docs/reviews/s04-vente-stripe.md` (citation du réglage), remplacé par ce rapport. Lignes ajoutées hors `docs/reviews` : 0. Code : 0. ADR 007 : 0.

## Anti-hallucination
- [x] Chaque import et appel du diff ouvert et vérifié : `errors.notFound`, `errors.tooManyRequests`, `errors.internal`, `errors.badRequest`, `success` (`lib/api-response.ts:13-28`) ; `checkRateLimit`, `getClientIp` (`lib/rate-limit.ts:14,34`) ; `sendFunnelConfirmationEmail` accepte `to, firstName, subject, title, text, buttonLabel, buttonUrl, attachment?` (`lib/resend.ts:211-219`), `isResendConfigured` (`:14`) ; `getFunnel` (`funnels/index.ts:11`) ; `Contact.first_name: string | null` (`types/contacts.ts:10`) ; `upsertContact`, `ensureTags`, `tagContact` inchangés. Paramètres Stripe : `price_data[tax_behavior]`, `customer_creation=if_required`, `metadata[...]`, `{CHECKOUT_SESSION_ID}` dans `success_url` : tous documentés, et le retour `?session_id=cs_test_...` a été observé en réel (record, 16/10 et 18/10). Syntaxe PostgREST : `on_conflict=` + `Prefer: resolution=ignore-duplicates,return=representation`, `PATCH` filtré `delivered_at=is.null` et `first_name=is.null` : conformes.
- [x] Valeurs : HT 2700 à 5,5 % = 2559 (vérifié par `npm test` et en base le 18/10) ; tolérance 300 s ; regex `^cs_(test|live)_[A-Za-z0-9]+$` ; `getProduit` protégé par `Object.hasOwn`.
- [ ] Le record dit vrai partout : non. « `on_conflict=stripe_event_id` tourné en réel » (record, tableau du 18/10, ligne Rejeu) est faux par lecture de `lib/supabase.ts:270-271` : `insertSale` lit d'abord `findSaleBySession`, trouve la vente de la même session et renvoie `{ inserted: false }` avant tout POST. Sur un rejeu du même événement, la clause `on_conflict` n'est jamais atteinte (M1 ci-dessous). Et « Nettoyage de la vente de test : voir ci-dessous » ne renvoie à rien (M2).

## Conformité aux règles
- [x] AGENTS.local.md : commentaires et textes en français, tutoiement, `lib/` un fichier = un job, zod dans `lib/schemas.ts`, réponses via `lib/api-response.ts`, cadence via `lib/rate-limit.ts`, migrations versionnées, clés serveur seulement, commits conventionnels, Stripe en mode test (`assertTestMode` sur checkout et téléchargement).
- [x] ADR 004 (Checkout hébergé, webhook signé seule source de vérité, idempotence par `stripe_event_id`, mode test), ADR 006 (préfixe `tunnel_`), ADR 007 (fetch pur, node:crypto, TVA en config) respectés. ADR 003 : aucune logique LLM, config invalide cassée au build (2 nouveaux `@ts-expect-error`).
- [x] Design system : `.btn-primary`, `.error-in`, `var(--color-ink-soft)`, couleur d'erreur `#b91c1c` identique à `OptinBlock.tsx:115`, fond `bg-soft`. Aucun composant ni couleur hors système. Intention de l'écran (page de vente = hero + bouton + mention Stripe ; page merci = hero + bouton de téléchargement ou texte d'attente) respectée d'après les captures du record.

## Tests
- [x] Record vérifié : `git diff --quiet 730fcb84ddc4046844dafe7e0ddacd820f1db2da HEAD -- . ':(exclude)docs'` exit 0 ; `Verification status: complete` ; `npm run build` exit 0 (route `/api/telecharger` ajoutée, donc build légitime), `npx tsc --noEmit` exit 0, `npm test` exit 0. Pris comme preuve, pas relancés (build et typecheck). Réglages du projet (AGENTS.local.md) : Test laissé vide, valeur « tiret long » (non lancé comme commande de projet ; `npm test` est un ajout de la passe D7, lancé hors réglages), Typecheck laissé vide (non lancé ; le `npx tsc --noEmit` du record est hors réglages), E2E laissé vide (non lancé), Build `npm run build` (record), Build stage `ship-if-route`, Test budget 25.
- [x] `npm test` relancé ici une fois en base de référence pour les mutations : 7 ok, exit 0.
- [x] Filet : 7 vérifications sur 25 de budget, toutes appellent le vrai `verifyStripeSignature` et le vrai `prixHt` avec une signature calculée indépendamment dans le script. Aucune vérification décorative.
- [x] Mordant prouvé par neutralisation, trois mutations successives, chacune suivie de `npm test` puis `git checkout` :
  - A. `verifyStripeSignature` renvoie `true` d'emblée (`lib/stripe.ts:119`) : rouge, « corps altéré d'un octet refusé : obtenu true », exit 1.
  - B. Contrôle d'horodatage supprimé (`lib/stripe.ts:132`) : rouge, « horodatage à 301 s refusé : obtenu true », exit 1.
  - C. `prixHt` renvoie le TTC (`funnels/produits.ts:36`) : rouge, « prixHt 2700 à 5,5 % = 2559 : obtenu 2700 », exit 1.
  Le script s'arrête au premier échec : 1 rouge par mutation, par construction. Restauration prouvée : `git diff --exit-code` = 0, `git status --short` vide.
- [ ] Invariant sans filet rejouable : l'anti-doublon (`findSaleBySession` en tête d'`insertSale`, clause `on_conflict`). Aucun fichier de test ne le nomme, aucune mutation possible à compter : non testé (M1). Il tient par les contraintes UNIQUE de la migration 002 et par le rejeu Stripe.
- [x] Aucun test rendu redondant (le projet n'en avait pas).

## Régressions
- [x] `BlockRenderer` : `default: never` compile avec deux nouveaux cas ; les blocs existants ne sont pas touchés. `upsertContact` inchangé, nouveau producteur `upsertBuyerContact` isolé. `lib/rate-limit.ts` partagé : nouvelles clés `checkout:` et `telecharger:` sans collision avec `optin`. `next.config.ts` : clé `/api/optin` conservée. `lib/admin-funnels.ts` ignore les nouveaux types (m5, comportement inchangé pour l'existant).

## Constats

**Majeurs**
- **M1 · docs/verif/s04-vente-stripe.md (tableau du 18/10, ligne Rejeu) et lib/supabase.ts:270-297 · l'anti-doublon reste sans preuve rejouable et le record affirme le contraire.** Un `stripe events resend` du même événement est absorbé par `findSaleBySession` (ligne 270) : la ligne POST avec `on_conflict=stripe_event_id&resolution=ignore-duplicates` n'a tourné dans aucune des deux preuves réelles, contrairement à ce que le record écrit. Si cette clause était fausse (nom de colonne, Prefer), le symptôme serait un 409 transformé en 500 par `call()`, puis un rejeu Stripe absorbé par la lecture par session : auto-réparé, donc pas critique. Reste de l'ancien M3. Correctif : une vérification de `npm test` qui exerce `insertSale` contre un `fetch` factice (deux appels, le second renvoie `[]`), ou une preuve réelle avec un second événement forgé sur la même session, ou au minimum corriger la phrase du record.
- **M2 · docs/verif/s04-vente-stripe.md (fin) · nettoyage de la preuve du 18/10 absent du record, vente de test probablement en base de prod.** « Nettoyage de la vente de test : voir ci-dessous » ne renvoie à rien, et la ligne de statut dit « selon la décision de Delphine ». Au moment de cette revue, la table `tunnel_sales` du projet tunnel-maison (production) contient vraisemblablement une vente `cs_test_a1jf…` à 2700 centimes, `delivered_at` posé, et le tag `client-livre` est posé sur le contact de Delphine. Rien dans le code ne distingue une vente test d'une vente réelle : la future story Ventes la comptera comme du chiffre d'affaires. Geste humain : décider (garder ou supprimer), exécuter, et compléter le record avec l'état relu.

**Mineurs**
- **m1 · app/api/stripe/webhook/route.ts:87 · prénom d'un nouveau contact = premier mot du nom de carte.** Pour un contact inconnu, « MARTIN Julie » donne `first_name = MARTIN` et « Hello MARTIN ». L'ancien M2 est résolu pour les contacts existants (prouvé le 18/10 : `first_name` de Delphine inchangé), le résidu ne touche que les nouveaux acheteurs.
- **m2 · tsconfig.json · `allowImportingTsExtensions: true` pour tout le projet** afin que `scripts/verif-stripe.ts` importe `../lib/stripe.ts`. Sans effet avec `noEmit`, mais une option globale pour un script. Alternative : exclure `scripts/` du `tsc` du build, ou un import sans extension via loader.
- **m3 · package.json · `npm test` exige Node 23 ou plus** (lecture TypeScript native) et émet `MODULE_TYPELESS_PACKAGE_JSON`. Pas de champ `engines`. À dire dans AGENTS.local.md si `Test` passe un jour à `npm test`.
- **m4 · app/api/stripe/checkout/route.ts:42 · premier bloc `acheter` de l'étape seulement.** Deux produits sur une même étape vendraient toujours le premier, sans erreur de build. Limite à documenter ou à verrouiller par une vérification de config.
- **m5 · lib/admin-funnels.ts:34-67 (hors diff) · `acheter` et `telecharger` ignorés** : le parcours admin ne suit pas `etapeSucces`/`etapeAnnulation` et ne connaît pas le tag `client-livre`. Report du m5 du 16/10, pour la story Ventes.
- **m6 · types/funnel.ts:143-151 et TelechargerBlock.tsx · champ `produit` du bloc `telecharger` jamais lu.** Déclaratif par choix (record), mais un champ obligatoire sans effet trompe l'auteur de config.
- **m7 · record, lignes Rejeu des 16/10 et 18/10 · corps de réponse non montré** (`inserted: false` déduit du `<-- [200]`, pas observé). Report du m4 du 16/10.
- **m8 · lib/supabase.ts:270-297 · course entre deux événements d'une même session** (`completed` payé et `async_payment_succeeded` quasi simultanés) : les deux passent `findSaleBySession` à null, le second POST heurte UNIQUE `stripe_session_id` (hors `on_conflict`), `call()` lève, 500, Stripe rejoue, la relecture par session répond 200. Auto-réparé, à écrire dans le commentaire d'`insertSale` plutôt que de le découvrir en prod.
- **m9 · private/produits/le-livre-du-sommet-ia-en-5-jours.pdf · produit payant suivi par git** (1,3 Mo), même motif que `private/guides/` sur main et nécessaire au déploiement Vercel. AGENTS.local.md interdit le remote `origin` (template public) : un push par erreur sur `origin` publierait l'e-book. Rappel, pas un défaut du diff.

## Non vérifié
- Aucun appel réel ici à Stripe, Supabase ni Resend : preuve réelle du 18/10, migration 003 et état de la base pris dans le record, sauf ce que M1 et M2 contredisent par lecture.
- État réel de `tunnel_sales` et du tag `client-livre` après le 18/10 (M2) : à relire par l'API de gestion ou le SQL Editor avant la story Ventes.
- Réception de l'email de livraison dans Gmail et fonctionnement du bouton de l'email (lien `/api/telecharger?session_id=`) : à ouvrir par Delphine depuis sa boîte.
- Chemin « Resend échoue, 500, rejeu Stripe renvoie l'email » (D5) : jamais exécuté (Resend n'a pas échoué). Test possible : clé Resend volontairement fausse sur un achat test, puis `stripe events resend`.
- Paiement asynchrone (`checkout.session.async_payment_succeeded`) et course m8 : jamais déclenchés (achat test SEPA ou deux événements forgés).
- Rendu mobile de `/t/demo/livre` et `/t/demo/livre-merci` : capture 390 px non concluante au record ; à regarder sur un vrai téléphone, bouton de téléchargement compris.
- Téléchargement effectif du PDF depuis le déploiement Vercel (trace `outputFileTracingIncludes` vérifiée au build local, jamais en prod) : un achat test sur la preview après le ship.
- Rate-limit en mémoire par instance (limite connue de `lib/rate-limit.ts`).

## Verdict
Max severity: major
Ship allowed: yes
