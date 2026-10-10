# ADR 004 — Paiement par Stripe Checkout et webhook signé

- Status: accepted
- Date: 2026-10-10
- Scope: framing

## Context
Le tunnel doit encaisser (Pass VIP, e-book, offres). Delphine a déjà un compte Stripe actif (encaissements du sommet). La vérité d'un paiement doit venir de Stripe, pas du navigateur de l'acheteur.

## Decision
Stripe Checkout (page hébergée par Stripe) créé côté serveur, code affilié en metadata, et un webhook signé (`api/stripe/webhook`) comme unique source d'enregistrement d'une vente. Idempotence par stripe_event_id unique en base. Mode test jusqu'à validation explicite de Delphine.

## Considered options
- Stripe Payment Links seuls — rejetés : pas de metadata d'affiliation dynamique fiable ni de contrôle du parcours retour.
- Formulaire de carte intégré (Stripe Elements) — rejeté : surface PCI et UX à notre charge pour zéro gain en v1.
- PayPal en plus — reporté : rien dans les ventes du sommet n'est passé par PayPal ; à ajouter si un acheteur le réclame.

## Consequences
- Plus facile : conformité et 3DS gérés par Stripe, parcours éprouvé.
- Plus dur : tunnel de test local des webhooks (stripe CLI ou endpoint de test) à outiller dans la story s04.
- À surveiller : séparation stricte clés test / prod ; TVA par produit (taux en config, HT calculé et stocké).
