---
description: Optimise l'étape du funnel qui convertit le moins, sur la base des données PostHog.
---
# Optimize — Optimisation de la conversion

Améliorer le maillon faible du tunnel.

## Prérequis
Lire `memory/knowledge/frameworks.md` (règles CRO) et `memory/synthesis/conversion-log.md`.
Idéalement, des données PostHog (sinon, optimiser sur la base des best practices).

## Workflow

1. Lancer `/analytics` (ou réutiliser les chiffres récents) pour trouver l'étape la plus faible.
2. Diagnostiquer la cause probable selon l'étape :
   - **Landing→Lead faible** : hook peu clair, trop de friction, promesse faible, pas de preuve.
   - **Lead→Ressource faible** : email ressource non reçu (Resend ?), ou pas de redirection.
   - **Ressource→Clic faible** : ressource qui ne crée pas le désir, CTA peu visible/peu motivant.
   - **Clic→RDV faible** : calendrier compliqué, manque de réassurance, créneaux indisponibles.
3. Proposer une variante concrète (nouveau headline, nouveau CTA, ajout de preuve, simplification).
4. Appliquer dans `config.ts` (+ `memory/funnel/copy.md`) après validation.
5. Logger le changement et l'hypothèse dans `memory/synthesis/conversion-log.md`.
6. Inviter à laisser tourner puis re-mesurer avec `/analytics`.

## Règles
- Une hypothèse à la fois (pour savoir ce qui marche).
- S'appuyer sur les frameworks CRO, pas sur l'intuition seule.
- Documenter chaque test (date, changement, résultat attendu).
