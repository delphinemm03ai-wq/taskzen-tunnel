---
validated: yes
---
# Plan : Story s04-vente-stripe

Branch: `feature/s04-vente-stripe`
Research: `docs/research/s04-vente-stripe.md` : à lire d'abord (décisions de Delphine du 16/10 à la fin), ce plan ne le répète pas.
ADR : 004 (Checkout + webhook signé), 007 (fetch pur, pas de SDK, TVA en config).

## Target story
Un produit défini en config (e-book du sommet, 27 € TTC, TVA 5,5 % incluse : taux réduit des livres, y compris numériques) s'affiche dans un bloc « acheter » d'une page du tunnel ; le bouton crée une session Stripe Checkout côté serveur et redirige ; le webhook signé enregistre la vente (contact créé ou retrouvé, tag `client-<produit>`, TTC et HT), puis envoie l'email de livraison ; un événement rejoué ne crée pas de seconde vente ; une annulation ne laisse aucune trace ; le tout prouvé en mode test (carte 4242) avec la Stripe CLI.

## Decisions (ne pas re-décider)
| Sujet | Décision |
| --- | --- |
| TVA | Prix TTC en config (`prixTtc` en centimes), taux **par produit** : `tauxTva: 5.5` pour l'e-book (livre numérique, art. 278-0 bis A du CGI), 20 pour un service ou une formation. HT = round(TTC / (1 + taux/100)) côté serveur, stocké avec le TTC et le taux. Stripe reçoit `unit_amount` = TTC, pas de Stripe Tax. |
| Produit | `funnels/produits.ts` : `{ livre: { nom, prixTtc: 2700, tauxTva: 5.5, tag: "client-livre", livraison: {...} } } satisfies Record<string, Produit>`. Un seul produit dans cette story. |
| Livraison | Email via `sendFunnelConfirmationEmail` existant : objet, titre, texte, bouton vers `livraison.url` (https://sommet.taskzen.fr/livre tant que l'e-book n'est pas hébergé ici) et PDF joint optionnel depuis `private/produits/<fichier>` (même mécanisme que les guides). |
| Bloc | `type: "acheter"` : `{ produit, boutonTexte, etapeSucces, etapeAnnulation }` (slugs d'étapes du même tunnel). Le navigateur envoie seulement `funnel` + `step` ; prix et produit sont relus dans la config. |
| Stripe | fetch pur + node:crypto (ADR 007). Clés `STRIPE_SECRET_KEY` (refus de `sk_live_` tant que `STRIPE_ALLOW_LIVE !== "oui"`) et `STRIPE_WEBHOOK_SECRET`, mises par Delphine dans `.env.local`. |
| Webhook | `app/api/stripe/webhook/route.ts`. Corps lu en `req.text()`. Événements traités : `checkout.session.completed` avec `payment_status === "paid"`, et `checkout.session.async_payment_succeeded`. Tout autre événement : 200 sans écriture. Échec Supabase : 500 (Stripe réessaie). Échec email : vente conservée, erreur loggée. |
| Idempotence | Migration 002 : `tunnel_sales` avec `stripe_event_id UNIQUE` et `stripe_session_id UNIQUE`. `insertSale` : GET par session d'abord (déjà vendue = 200 sans rien), puis POST `on_conflict=stripe_event_id&resolution=ignore-duplicates` avec `Prefer: return=representation` (tableau vide = rejeu). |
| Test | Stripe CLI locale : `stripe listen --forward-to localhost:3000/api/stripe/webhook` (fournit le `whsec_` de dev), paiement réel 4242 dans Checkout, rejeu par `stripe events resend <evt_id>`. |
| Admin | Onglet « Ventes » : placeholder inchangé (hors critères, story ultérieure). |

## Tasks (ordered)
1. [x] `types/funnel.ts` : interface `AcheterBlock` (`type: "acheter"`, `produit: string`, `boutonTexte: string`, `etapeSucces: string`, `etapeAnnulation: string`) ajoutée à l'union `Block`. `types/produits.ts` : `Produit` (`nom`, `prixTtc`, `tauxTva`, `tag`, `livraison: { objet, titre, texte, boutonTexte?, url?, fichier? }`). `types/funnel.typetest.ts` : +2 cas `@ts-expect-error` (acheter sans produit ; produit sans prixTtc).
2. [x] `funnels/produits.ts` : registre `produits` + `getProduit(slug)`. Produit `livre` (27 € TTC, TVA 5,5, tag `client-livre`, livraison avec bouton vers https://sommet.taskzen.fr/livre, textes français tutoiement). `funnels/demo.ts` : nouvelle étape `livre` (hero + bloc acheter) et étapes `livre-merci` et retour sur `livre` en annulation ; `.env.example` : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_ALLOW_LIVE` commentés.
3. [x] `supabase/migrations/002_tunnel_sales.sql` : `tunnel_sales` (id uuid, contact_id → tunnel_contacts, product_slug text, amount_ttc int, amount_ht int, vat_rate numeric, stripe_event_id text unique, stripe_session_id text unique, affiliate_code text null, created_at), RLS activée sans policy, index contact_id et created_at desc. Appliquée par l'API de gestion (méthode s02), catalogue relu. **Appliquée le 16/10 par l'orchestrateur (jeton dans son environnement), catalogue relu : voir record.**
4. [x] `lib/stripe.ts` : `isStripeConfigured()`, `assertTestMode()` (refuse `sk_live_` sans `STRIPE_ALLOW_LIVE=oui`), `createCheckoutSession({ nom, prixTtc, successUrl, cancelUrl, metadata })` (POST form-encodé, `mode=payment`, `line_items[0][price_data][currency]=eur`, `unit_amount`, `tax_behavior=inclusive`, `customer_creation=if_required`, `metadata[funnel|step|produit]`), `verifyStripeSignature(rawBody, header, secret, nowSeconds?)` → boolean (HMAC, timingSafeEqual, tolérance 300 s), `parseCheckoutEvent(rawBody)` → type minimal `{ id, type, data.object: { id, payment_status, customer_details?.email, customer_details?.name, metadata, amount_total } }`. Aucun `console.log` de clé.
5. [x] `lib/supabase.ts` (ajouts seulement) : `findSaleBySession(sessionId)`, `insertSale({ contactId, productSlug, amountTtc, amountHt, vatRate, stripeEventId, stripeSessionId })` → `{ inserted: boolean }` (voir Decisions), `countSales()`. Type `Sale` dans `types/contacts.ts` ou `types/produits.ts`.
6. [x] `app/api/stripe/checkout/route.ts` : rate-limit 10/min par IP (clé `checkout:`), zod `{ funnel, step }`, résolution tunnel/étape/bloc `acheter`/produit dans la config (400 sinon), `assertTestMode()`, session créée avec `success_url=<site>/t/<funnel>/<etapeSucces>?session_id={CHECKOUT_SESSION_ID}` et `cancel_url=<site>/t/<funnel>/<etapeAnnulation>`, réponse `success({ url })`.
7. [x] `app/api/stripe/webhook/route.ts` : `req.text()`, en-tête absent ou signature fausse → 400 sans lecture du corps JSON ; événement non traité → 200 `{ ignored: true }` ; sinon produit relu depuis `metadata.produit` (inconnu → 200 loggé, pas de 500 pour ne pas faire boucler Stripe), montants recalculés depuis la config (jamais depuis `amount_total`, qui sert seulement à un contrôle loggé), `upsertContact` (email + prénom de `customer_details`), `insertSale`, puis si `inserted` : `ensureTags`/`tagContact` et email de livraison dans `after()`. Réponse 200 `{ received: true, inserted }`.
8. [x] `components/funnel/blocks/AcheterBlock.tsx` ("use client") : bouton du thème (classes de CtaButton), états idle/chargement/erreur, POST `/api/stripe/checkout` avec `{ funnel, step }` lus dans `useParams`, `window.location.assign(url)` au succès, erreur en toutes lettres. `BlockRenderer.tsx` : `case "acheter"`.
9. [x] Vérifications hors ligne : `npm run build` vert (typetest inclus, routes `/api/stripe/checkout` et `/api/stripe/webhook` listées) ; `next start` + curls : checkout 400 tunnel inconnu, 429 à la 11e requête ; webhook 400 sans en-tête, 400 signature fausse (corps altéré d'un octet, signature calculée par un script du scratchpad avec un secret de test), 200 `ignored` sur un événement `payment_intent.created` signé.
10. [x] Preuve réelle en mode test (UNE fois, clés fournies par Delphine, CLI connectée par elle) : `stripe listen` → `whsec_` dans `.env.local` → `next dev` → achat de l'e-book avec 4242 et l'adresse delphinemm03.ai@gmail.com → webhook reçu, `countSales()` = 1, contact tagué `client-livre`, email de livraison parti (id Resend) ; `stripe events resend <evt_id>` → 200 `inserted: false`, toujours 1 vente ; annulation depuis Checkout → retour sur l'étape `livre`, 0 vente supplémentaire. Puis NETTOYER la vente, le contact et le tag de test (API de gestion), base revenue à son état d'avant. **Faite le 16/10 dans le bac à sable taskzen-tunnel-test, base nettoyée : voir record.**
11. [x] `docs/verif/s04-vente-stripe.md` (record complet, secrets masqués), plan coché.

## Run interdicts
- Diff vide sur : `config.ts`, `app/page.tsx`, `app/ressource/`, `app/reserver/`, `app/merci/`, `middleware.ts`, `app/api/lead/`, `app/api/funnel/`, `app/api/cron/`, `app/api/optin/`, `lib/airtable.ts`, `app/t/`, `app/admin/`, `components/admin/` (le placeholder Ventes reste tel quel), `supabase/migrations/001_*`, `funnels/guides-sommet.ts`.
- `lib/supabase.ts`, `lib/resend.ts`, `lib/schemas.ts`, `types/funnel.ts` : AJOUTS seulement, aucune ligne existante modifiée.
- Aucune dépendance npm (ADR 007). Aucun push. Pas de cadratin. Textes français, tutoiement.
- Clés : jamais affichées, jamais commitées, jamais demandées à Delphine dans le chat ; `.env.local` est rempli par elle. `sk_live_` refusée par le code.
- Paiements et emails réels : mode test uniquement, un seul achat 4242, un seul destinataire delphinemm03.ai@gmail.com, à la tâche 10.
- Aucun appel à `api.stripe.com` avant la tâche 10 (les tâches 4 à 9 se prouvent sans réseau Stripe).

## The point everything turns on
Le webhook est la seule source de vérité, et il doit être à la fois infalsifiable et rejouable sans double vente. Trois endroits où ça peut se tromper :
1. **La signature portée sur un corps re-sérialisé** : si la route fait `req.json()` puis `JSON.stringify`, la signature ne correspond plus. Comparer à `req.text()` lu une seule fois, en premier.
2. **Le 409 de `call()`** : un rejeu ne doit pas répondre 500 (Stripe réessaierait à l'infini). Comparer la réponse de `insertSale` sur un `stripe events resend` : 200 `inserted: false`, et `countSales()` inchangé.
3. **Les montants pris dans l'événement** : `amount_total` vient de Stripe mais le prix fait foi dans la config ; un produit modifié entre l'achat et le webhook est le seul cas de divergence, à logger, jamais à bloquer.

## Files touched
- Nouveaux : `types/produits.ts`, `funnels/produits.ts`, `lib/stripe.ts`, `app/api/stripe/checkout/route.ts`, `app/api/stripe/webhook/route.ts`, `components/funnel/blocks/AcheterBlock.tsx`, `supabase/migrations/002_tunnel_sales.sql`, `docs/decisions/007-stripe-sans-sdk-fetch-et-crypto.md`, `docs/verif/s04-vente-stripe.md`.
- Modifiés (ajouts seulement) : `types/funnel.ts`, `types/funnel.typetest.ts`, `types/contacts.ts`, `lib/supabase.ts`, `lib/schemas.ts`, `components/funnel/blocks/BlockRenderer.tsx`, `funnels/demo.ts`, `.env.example`.

## Test strategy
Pas de runner (Test: absent). Filet dans l'ordre de valeur :
- **Typage** : build + 2 cas typetest (config invalide = build cassé, ADR 003) ; le `default: never` de BlockRenderer impose la branche `acheter`.
- **Invariant central (signature + idempotence)** : prouvé par des curls déterministes contre `next start` avec un secret de test et une signature calculée par un script du scratchpad (tâche 9), puis par un vrai rejeu CLI (tâche 10). C'est la seule chose qui vaut une preuve à deux niveaux : le script prouve le refus, la CLI prouve l'acceptation et le rejeu sur un vrai format d'événement.
- **Preuve réelle unique** (tâche 10) : ce que rien de local ne voit : Stripe accepte la session, l'événement arrive signé, la vente existe, l'email part.
- Budget : 0 test runtime commité sur 25, comme s03 ; le filet est le build et le record.
- Visuel : l'étape `livre` du tunnel demo rendue une fois dans le navigateur (bouton du thème, état de chargement), capture dans le record.

## Definition of Done
- 6 critères de la story prouvés (record), dont le rejeu et l'annulation ; build vert ; diff vide sur les interdits ; migration 002 appliquée et relue ; base nettoyée après la preuve ; aucune clé dans git ni dans le record ; mode test seulement (Delphine valide le passage en prod plus tard, hors story) ; commits conventionnels, aucun push.

## Passe de correction du 16/10 (après revue, validée par Delphine : « vas-y »)

Source : `docs/reviews/s04-vente-stripe.md` (M1, M2, M3, m1, m6) et la décision de livraison de Delphine.
Le PDF final est déjà copié dans `private/produits/le-livre-du-sommet-ia-en-5-jours.pdf` (1,3 Mo, non suivi par git pour l'instant : à ajouter dans le commit).

| # | Décision | Pourquoi |
|---|---|---|
| D1 | Le livre se télécharge, il n'est plus joint ni pointé vers la page de vente. Nouvelle route `GET /api/telecharger?session_id=cs_...` : format du `session_id` validé (`^cs_(test|live)_[A-Za-z0-9]+$`), cadence limitée (`lib/rate-limit.ts`, 20/min/IP), vente cherchée par `findSaleBySession`. Trouvée : le PDF de `private/produits/<livraison.fichier>` est renvoyé (`Content-Type: application/pdf`, `Content-Disposition: attachment`, `Cache-Control: private, no-store`). Pas trouvée : repli sur Stripe `GET /v1/checkout/sessions/{id}` (fetch pur, ADR 007), accepté seulement si `payment_status === "paid"` ET `metadata.produit` désigne un produit connu. Sinon 404 avec un message en français. | La page de remerciement s'affiche souvent AVANT l'arrivée du webhook : sans repli, le bouton échouerait juste après un vrai paiement. Le PDF n'est jamais public. |
| D2 | `LivraisonProduit` : `url` et `boutonTexte` remplacés par `fichier` obligatoire + `boutonTexte`. Plus de pièce jointe. Le bouton de l'email pointe vers `${NEXT_PUBLIC_SITE_URL}/api/telecharger?session_id=<id>` (repli sur l'hôte de la requête, comme la route de checkout). | Email léger, lien qui ne périme pas (la route revérifie à chaque clic), une nouvelle version du PDF profite à tous. |
| D3 | Nouveau bloc `telecharger` (`produit`, `boutonTexte`, `texteAttente`) sur l'étape `livre-merci` : lit `session_id` dans l'URL et affiche un bouton vers la route D1. Sans `session_id`, il affiche `texteAttente`. Composant dans `components/funnel/blocks/`, styles existants (`.btn-primary`). Textes de `livre` et `livre-merci` mis à jour : « à télécharger juste après ton paiement », plus « arrive par email ». | L'acheteur a son livre à l'écran même si l'email échoue (réduit l'impact de M1). |
| D4 | `next.config.ts` : `outputFileTracingIncludes` ajoute `"/api/telecharger": ["./private/produits/**/*"]`. Le webhook ne lit plus de fichier. | Sans ça, Vercel n'embarque pas le PDF. |
| D5 (M1) | Migration `003_tunnel_sales_delivered_at.sql` : `alter table ... add column delivered_at timestamptz`. Le webhook, à CHAQUE événement payé (rejeu compris) : 1) vente (insertSale, inchangé) ; 2) tag posé de façon synchrone (`ensureTags` + `tagContact`, déjà idempotents) ; 3) si la vente de la session a `delivered_at` nul : email envoyé, puis `delivered_at = now()` (nouvelle fonction `markSaleDelivered(sessionId)`). Tout cela avant le 200, plus de `after()`. Un échec du tag ou de l'email répond 500 : Stripe réessaie, et le rejeu reprend là où ça s'est arrêté. Resend non configuré : log, 200, `delivered_at` reste nul. | Un acheteur ne peut plus rester sans tag ni sans email. Le pire cas devient un email en double (email parti, mise à jour échouée), jamais un email manquant. |
| D6 (M2) | Le prénom Stripe n'est jamais écrit sur un contact existant. `upsertContact` reçoit une option `keepExistingFirstName` (ou une fonction dédiée) : lecture du contact par email d'abord, prénom écrit seulement s'il était vide. La salutation de l'email utilise le prénom du contact en base, sinon le premier mot du nom Stripe. | « Julie » ne devient plus « MARTIN ». |
| D7 (M3) | `scripts/verif-stripe.ts`, sans réseau ni dépendance, lancé par `npm test` (`"test": "node scripts/verif-stripe.ts"`, Node 25 lit le TypeScript nativement ; imports relatifs avec extension `.ts`). Il prouve : signature valide acceptée ; corps altéré, mauvais secret, horodatage à 301 s, `v0` seul, en-tête absent refusés ; `prixHt` 2700 à 5,5 % = 2559. Sortie non nulle au premier échec. Le reviewer doit pouvoir le faire passer au rouge en neutralisant la comparaison. | Une régression de la garde de signature ne part plus au vert. |
| D8 | Mineurs : m1, retirer les 3 tirets cadratins de `docs/decisions/007-...md` (remplacer par deux-points ou virgule) ; m6, supprimer `countSales` s'il reste inutilisé ; ADR 007 « Consequences » : mentionner `npm test`. m5 et m7 restent hors périmètre (story Ventes), notés au record. | |

Interdits de la passe : aucune nouvelle dépendance npm ; aucune clé ni secret dans le diff ; `.env.local` jamais commité ; Stripe en mode test uniquement ; pas de `git push`.
Vérifications attendues au record : `npm test` (exit 0), `npx tsc --noEmit` (exit 0), `npm run build` (exit 0, une route est ajoutée), aucun U+2014 dans le diff (`git diff main...HEAD | grep -cP '\x{2014}'` = 0).
La migration 003 est appliquée sur Supabase par l'orchestrateur après la passe, pas par l'implémenteur.

- [x] D1 à D8 implémentés le 16/10 (passe de correction), écarts déclarés au record ; migration 003 à appliquer par l'orchestrateur, puis preuve réelle.
