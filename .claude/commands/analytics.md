---
description: Affiche les performances du funnel depuis PostHog. Taux de conversion par étape et recommandations.
---
# Analytics — Performances du funnel

Lire les stats de conversion du tunnel.

## Prérequis
PostHog configuré (`NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`).
Si non configuré → proposer `/onboarding`.

## Workflow

1. Récupérer les comptages des events du funnel (via `lib/posthog-query.ts` / l'endpoint `/api/funnel/stats`, ou directement le MCP PostHog) :
   `landing_view → lead_signup → resource_view → booking_click → booking_completed`.
2. Calculer les taux de conversion entre chaque étape.
3. Afficher un tableau clair :
   ```
   Étape              | Volume | Conv. vs précédente
   Vue landing        | ...    | —
   Email capturé      | ...    | ...%
   Ressource vue      | ...    | ...%
   Clic réserver      | ...    | ...%
   Appel réservé      | ...    | ...%
   ```
4. Identifier l'étape la plus faible (le goulot).
5. Recommander 1-2 actions concrètes. Proposer `/optimize` pour la corriger.
6. Logger le snapshot dans `memory/synthesis/conversion-log.md`.

## Règles
- Le dashboard visuel est aussi dispo sur `/admin` (protégé par ADMIN_SECRET).
- Exclure le trafic localhost/preview (déjà fait dans la requête HogQL).
- Pas de PostHog → pas de données : le dire clairement, ne pas inventer de chiffres.
