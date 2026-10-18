# Research : Story s04-vente-stripe

Workspace : `C:/Users/Delphine/dev/taskzen-tunnel/.worktrees/s04-vente-stripe`, branche
`feature/s04-vente-stripe` (depuis `main` 381130e), `.env.local` copié, `npm ci` fait.
`docs/reviews/stories.md` : `Stories ready: yes`.

## The five structuring facts
1. **Aucune clé Stripe nulle part en local** : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` absentes de `.env.local` et de `.env.example` (1-47). Aucune dépendance `stripe` (`package.json:11-19`), pas de Stripe CLI sur la machine. L'exécution est bloquée tant que Delphine n'a pas mis les clés **test** ; recherche, design et plan ne le sont pas.
2. **Migration obligatoire** : seule `supabase/migrations/001_tunnel_contacts.sql` existe. Il faut une `002` pour les ventes. Nom : `tunnel_sales`, pas `sales` comme l'écrit `docs/architecture.md:38` (contredit l'ADR 006, préfixe `tunnel_`). Application par l'API de gestion Supabase, comme s02 (`docs/verif/s02-contacts-supabase.md:75`).
3. **Pas de runner de tests** : réglages `Test` et `Typecheck` vides, `Build: npm run build` (`AGENTS.local.md:58-61`). Le filet de s03 = build (type check + `types/funnel.typetest.ts`) + curls contre `next start` + une preuve réelle (`docs/plans/s03-optin.md:39-40`). La signature webhook et l'idempotence se prouveront par curl signés localement.
4. **Le motif à copier existe** : `app/api/optin/route.ts:26-121` (rate-limit, zod, la config fait foi et jamais le client, écriture Supabase puis email dans `after()`). Le bouton « acheter » doit envoyer `funnel`+`step` et la route relit produit et prix dans la config. Le prix ne vient jamais du navigateur.
5. **Le test de bout en bout exige une URL que Stripe peut appeler** : sans Stripe CLI, il faut un déploiement (preview Vercel, peut-être protégé : 401 pour Stripe) ou la prod `pages.taskzen.fr` en clés test. À trancher au plan (voir Open questions).

## Target story
Acheteur : payer un produit depuis la page de vente et recevoir son accès tout de suite. Score 4.
- [ ] Produit en config (nom, prix TTC, taux de TVA, email de livraison) ; un bloc « acheter » l'affiche sur une page du tunnel.
- [ ] Le bouton crée une session Stripe Checkout et redirige vers le paiement.
- [ ] Webhook signé : vente enregistrée (contact créé/retrouvé par email, tag `client-<produit>`, TTC et HT stockés), email de livraison envoyé.
- [ ] Événement rejoué = une seule vente (idempotence par id d'événement).
- [ ] Paiement annulé ou échoué : rien d'enregistré, retour à la page de vente.
- [ ] Parcours vérifié en mode test Stripe (carte 4242).

## Current state of the code
- `types/funnel.ts:122-133` : union `Block` fermée (10 types), commentaire « un nouveau bloc s'ajoute ici ET dans BlockRenderer ». Aucun type produit.
- `components/funnel/blocks/BlockRenderer.tsx:17-43` : `switch` exhaustif, `default` en `never` : un bloc oublié casse le build.
- `app/t/[funnel]/[step]/page.tsx:11-15` : pages SSG (`dynamicParams = false`, `generateStaticParams`). Une page de vente et une page merci sont de simples étapes de tunnel.
- `funnels/index.ts:9-11` : `allFunnels`, `getFunnel(slug)`. Funnels : `demo`, `guides-sommet`.
- `lib/supabase.ts` : fetch PostgREST pur, zéro dépendance (`1-10`). Exports : `upsertContact` (62), `ensureTags` (90), `tagContact` (110), `listContacts`, `countContacts`, `countContactsPerTag`, `listTagNames`. Rien pour les ventes.
- `lib/resend.ts` : `sendEmail` privé (37-72, pièce jointe base64 possible), `sendFunnelConfirmationEmail` (211-227 : objet, titre, texte, bouton, pièce jointe). Expéditeur unique `RESEND_FROM_EMAIL`.
- `components/admin/AdminShell.tsx:9,14,158` : onglet « Ventes » qui rend `SalesPlaceholder` (« apparaîtront ici avec le paiement Stripe (story s04) »). Aucun critère de s04 ne demande cette vue.
- `middleware.ts:32-34` : matcher `/ressource`, `/merci` seulement ; `/t/...` non concerné.
- `docs/decisions/004-stripe-checkout-webhook.md` : Checkout hébergé, webhook signé seule source de vérité, idempotence `stripe_event_id` unique, mode test jusqu'à validation.

## Anchor points
- Nouveau type de bloc (ex. `buy`) : `types/funnel.ts` (union) + `BlockRenderer.tsx` + cas `@ts-expect-error` dans `types/funnel.typetest.ts`.
- Config produit : nouveau fichier typé `satisfies` (même idée que `funnels/`), lu côté serveur seulement.
- Route de création de session : nouvelle `app/api/stripe/checkout` (ou nom au plan), calquée sur `app/api/optin/route.ts`.
- Webhook : `app/api/stripe/webhook` (nom fixé par l'ADR 004 et `docs/architecture.md:18,48`).
- Lib : `lib/stripe.ts` prévu par `docs/architecture.md:21` ; écritures ventes dans `lib/supabase.ts` (même `call`/`headers`).
- Migration : `supabase/migrations/002_tunnel_sales.sql`.
- Livraison : réutiliser `sendFunnelConfirmationEmail` ou un gabarit voisin dans `lib/resend.ts`.

## Verified APIs / functions
- `upsertContact({ email, firstName? }): Promise<Contact>` (`lib/supabase.ts:62`) : normalise l'email, ne remplace pas un prénom connu.
- `ensureTags(names: string[]): Promise<Tag[]>` (`:90`), `tagContact(contactId, tagIds)` (`:110`, doublons ignorés).
- `call()` (`lib/supabase.ts:35-49`) **lève une exception sur toute réponse non 2xx**, y compris le 409 d'une contrainte unique.
- `sendFunnelConfirmationEmail(input)` → `{ ok, reason? }` (`lib/resend.ts:211`), ne lève jamais.
- `checkRateLimit(key, {limit, windowSeconds})`, `getClientIp(headers)` (`lib/rate-limit.ts:14,34`).
- `success()`, `errors.*` (`lib/api-response.ts:13-28`).
- `after` de `next/server` déjà utilisé (`app/api/optin/route.ts:1,87`).

## Traps & constraints
- **Corps brut du webhook** : la signature Stripe porte sur le texte exact. Lire `await req.text()` AVANT tout `JSON.parse` ; ne jamais `req.json()`.
- **Signature sans SDK possible** : en-tête `Stripe-Signature` (`t=…,v1=…`), HMAC-SHA256 de `${t}.${body}` avec `whsec_…`, comparaison en temps constant et tolérance d'horodatage. Le choix SDK `stripe` contre fetch + `node:crypto` reste au plan (la lib maison est sans dépendance, `lib/supabase.ts:4`).
- **Idempotence et 409** : comme `call()` lève sur 409, l'insertion d'un événement rejoué doit passer par `on_conflict` + `resolution=ignore-duplicates` (réponse vide = déjà traité), ou par une capture explicite. Sinon un rejeu renverrait 500 et Stripe réessaierait sans fin.
- **Un paiement = parfois plusieurs événements** : `checkout.session.completed` peut arriver avec `payment_status: "unpaid"` (moyens de paiement asynchrones), puis `checkout.session.async_payment_succeeded`. N'enregistrer que si payé, et prévoir l'unicité aussi sur `stripe_session_id` (deux événements, une seule vente).
- **Ordre des écritures** : la vente doit être écrite avant l'email (comme `optin`, `after()`). Si Supabase échoue, répondre 5xx pour que Stripe réessaie ; si seul l'email échoue, ne pas annuler la vente (journaliser).
- **Prix et produit côté serveur uniquement** : la route relit tunnel, étape, bloc et produit dans la config (`app/api/optin/route.ts:48-59`).
- **Garde test/prod** : refuser une clé `sk_live_` tant que Delphine n'a pas validé (ADR 004). Les clés prod iront dans Vercel, jamais en local.
- **Clé publique Stripe inutile** avec Checkout hébergé (redirection vers l'URL de session) : `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` n'est pas requise (corrige ce qui a été demandé à Delphine le 14/10).
- **Pages SSG** : le bouton est un composant client (comme `OptinBlock.tsx`) ; aucun appel Stripe au rendu.
- **Emails réels** : uniquement vers delphinemm03.ai@gmail.com, une fois (règle de s03, `docs/plans/s03-optin.md:26`). Paiements uniquement en mode test.
- **Supabase** : le projet tunnel-maison est actif (n8n y écrit depuis le 14/10) ; toute écriture de test est nettoyée ensuite, comme s02/s03.
- `.worktrees/` n'est pas dans `.gitignore` : il apparaît en `??` dans le dépôt de base (non bloquant, à signaler).

## Open questions
1. **TVA** : Delphine est en EI. Franchise en base (taux 0 et mention « TVA non applicable, art. 293 B du CGI ») ou TVA collectée ? Le piège cité par la story (TVA suisse 8,1 % sur une vente CH) parle d'un taux **selon le pays de l'acheteur**, pas selon le produit : un taux unique en config ne le couvre pas. À trancher avec Delphine avant le plan.
2. **URL de test pour le webhook** : installer la Stripe CLI (`stripe listen`, connexion de Delphine), ou déployer (preview Vercel, protection à vérifier) ? La prod en clés test est possible mais touche `pages.taskzen.fr`.
3. **Contenu livré** : lien vers une page, PDF joint depuis `private/` (comme `OptinBlock.guide`), ou accès à un espace ? Le premier produit visé (e-book 27 €, Pass VIP 97 €) décide de la forme.
4. **Compte Stripe** : le « compte actif des encaissements du sommet » n'a pas été vérifié ici (le Pass VIP passait par Systeme.io). Delphine doit confirmer l'accès au mode test.
5. **Onglet Ventes de l'admin** : hors critères. On garde le placeholder (texte à ajuster) ou une liste minimale ? Sinon, à rattacher à une autre story.
6. SDK `stripe` ou fetch pur (voir Traps) : décision de plan.

## Real complexity
**4, confirmé.** Le motif optin couvre la moitié du travail (route, config qui fait foi, contact, tag, email). Le risque est concentré dans le webhook : corps brut, signature, idempotence face au 409 de `call()`, double événement par session, et une preuve de bout en bout qui demande une URL publique ou la Stripe CLI. Environ 9 à 10 tâches : à la limite haute d'un cycle.

## Split proposal
Optionnel, si le plan dépasse dix tâches :
- **s04a-encaissement** : config produit, bloc acheter, route Checkout, migration `tunnel_sales`, webhook signé et idempotent qui écrit la vente et pose le tag. Clos sur : vente test 4242 enregistrée une seule fois, annulation sans trace.
- **s04b-livraison** : email de livraison (gabarit, PDF ou lien), affichage des ventes dans l'onglet admin. Clos sur : email reçu, vente visible.

## Décisions de Delphine (16/10/2026, « ok, fais tous ces 4 points »)
1. **TVA** : prix affiché TTC (27 €), TVA incluse, HT et TVA calculés et stockés côté serveur, taux **par produit** : 5,5 % pour l'e-book (taux réduit des livres numériques, corrigé par Delphine le 16/10 : « 20 % ne va pas car c'est un e-book »), 20 % pour le Pass VIP ou une formation. Pas de taux par pays pour cette story.
2. **Test du webhook** : Stripe CLI en local (`stripe listen --forward-to localhost:3000/api/stripe/webhook`). CLI absente de la machine au 16/10 : à installer (winget disponible), connexion `stripe login` par Delphine.
3. **Premier produit** : e-book du sommet, 27 € TTC, livraison par email (lien vers https://sommet.taskzen.fr/livre ou PDF joint, à fixer au plan). Pass VIP plus tard.
4. **Compte Stripe** : accès au mode test à confirmer par Delphine ; clés `sk_test_` et `whsec_` à mettre par elle dans `.env.local`, jamais dans le chat. Aucune clé présente au 16/10.
