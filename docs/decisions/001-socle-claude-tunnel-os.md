# ADR 001 — Garder le socle claude-tunnel-os existant

- Status: accepted
- Date: 2026-10-10
- Scope: framing

## Context
Le tunnel maison remplace Systeme.io (PRD). Il faut un socle : repartir de zéro, générer un nouveau projet, ou étendre le dépôt taskzen-tunnel (template claude-tunnel-os de Pierre Evrard) en prod sur Vercel depuis le 12/07/2026, avec Resend, PostHog, Cal.com et un cron déjà branchés.

## Decision
Étendre taskzen-tunnel. Le moteur multi-tunnels vit à côté des routes existantes (`app/t/`), qui ne bougent pas.

## Considered options
- Repartir de zéro (create-next-app) — rejeté : on perd un socle éprouvé en prod et toutes les intégrations déjà testées ; la décision du 13/09 dit explicitement de partir des briques existantes.
- Construire dans Lovable — rejeté : dépendance à un éditeur externe et à ses crédits, alors que l'angle du produit est le contrôle total par fichiers versionnés.

## Consequences
- Plus facile : intégrations prêtes, déploiement connu, thème existant.
- Plus dur : cohabitation ancien tunnel / nouveau moteur jusqu'à la migration des 4 pages historiques ; remote `origin` (template public) à ne jamais pousser, seul `delphine` reçoit les pushes.
- À surveiller : ne rien casser en prod à chaque merge sur main (déploiement Vercel automatique).
