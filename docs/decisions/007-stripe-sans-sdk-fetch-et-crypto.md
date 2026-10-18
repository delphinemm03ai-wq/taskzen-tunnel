# ADR 007 : Stripe sans SDK : fetch pur et node:crypto

- Status: accepted
- Date: 2026-10-16
- Scope: story s04-vente-stripe

## Context
La story s04 a besoin de deux appels Stripe seulement : créer une session Checkout et vérifier la signature d'un webhook. Le dépôt n'a aucune dépendance serveur superflue (lib/supabase.ts parle à PostgREST en fetch pur, ADR 002/006) et le build Vercel reste léger. Le SDK `stripe` pèse plusieurs Mo, tire ses propres types et masque ce que fait la signature.

## Decision
Pas de paquet `stripe`. `lib/stripe.ts` appelle `https://api.stripe.com/v1/checkout/sessions` en POST form-encodé avec la clé secrète, et vérifie l'en-tête `Stripe-Signature` à la main : HMAC-SHA256 de `${t}.${corps brut}` avec `STRIPE_WEBHOOK_SECRET`, comparaison en temps constant (`timingSafeEqual`), tolérance de 5 minutes sur `t`. Le corps est lu avec `req.text()` avant tout parsing. La TVA est calculée en config (prix TTC, taux), pas par Stripe Tax.

## Considered options
- SDK `stripe` (`stripe.webhooks.constructEvent`) : rejeté : dépendance lourde pour deux appels, et la logique de signature reste la même ; à reconsidérer si s06 (affiliation, remboursements, Customer Portal) multiplie les appels.
- Stripe Tax pour la TVA : rejeté pour cette story : Delphine affiche un prix TTC unique, TVA incluse, avec un taux fixé par produit en config (5,5 % pour l'e-book, 20 % pour un service), comme sur Systeme.io ; un taux par pays viendra avec une story dédiée si un acheteur hors France l'exige.

## Consequences
- Plus facile : zéro dépendance, code lisible, même style que lib/supabase.ts.
- Plus dur : la vérification de signature est à nous ; elle est prouvée au record par un webhook rejoué (CLI) et par un corps altéré refusé en 400, et rejouée à chaque `npm test` (`scripts/verif-stripe.ts`, sans réseau : signature valide acceptée ; corps altéré, mauvais secret, horodatage à 301 s, `v0` seul et en-tête absent refusés ; HT de l'e-book).
- À surveiller : la version d'API Stripe est fixée par le compte (pas d'en-tête `Stripe-Version` envoyé) ; si Stripe change le format de `checkout.session.completed`, c'est le typage minimal de lib/stripe.ts qui le dira.
