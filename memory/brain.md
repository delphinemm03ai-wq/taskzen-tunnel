# Claude Tunnel OS — Index Mémoire

> Ce fichier est lu à CHAQUE début de session. Il donne le contexte rapide.

## État du setup

- [x] Onboarding Phase 1 (business + offre + ressource + stratégie)
- [x] Business configuré (business.md, offer.md)
- [x] Direction artistique définie (brand.md, /design)
- [x] Copywriting des 4 pages (copy.md, /copy)
- [x] Airtable connecté (CRM leads)
- [x] PostHog connecté (analytics)
- [x] Resend connecté (envoi ressource)
- [x] Cal.com configuré (réservation)
- [x] Déployé sur Vercel (production, 12/07/2026)

## Fichiers mémoire

| Fichier | Statut |
|---------|--------|
| identity/business.md | Configuré |
| identity/offer.md | Configuré |
| identity/brand.md | Configuré (argile brûlée/mousse, direction "chaleureux coach") |
| funnel/strategy.md | Configuré |
| funnel/copy.md | Configuré (4 pages appliquées dans config.ts) |
| funnel/config.md | Configuré (Airtable, PostHog, Cal.com) |
| knowledge/frameworks.md | Référence (pré-rempli) |
| knowledge/lessons.md | Vide |

## Contexte rapide

> Rempli par /onboarding.

- **Business** : Delphine Moura Miranda — Taskzen (automatisation support client pour coachs sportifs indépendants)
- **Cible** : coach sportif indépendant débordé par les messages répétitifs (9-11h/semaine perdues)
- **Offre** : La Méthode IA — récupérer 10h/semaine sans embaucher
- **Ressource** : vidéo courte (5 min), "La Méthode IA : comment récupérer 10h par semaine sans embaucher"
- **Appel** : diagnostic gratuit 30 min en visio

## Derniers apprentissages

> Accumulés au fil des sessions via /memory-save.

- L'offre s'appelle "La Méthode IA", pas "La Méthode Taskzen" (décision de nommage à ne pas perdre).
- Le remote git du repo pointe vers `PierreEvrard/claude-tunnel-os` (dépôt public du template, pas un repo perso) : ne jamais y pousser les infos business/tarifs de Delphine. Le repo perso est le remote `delphine` (github.com/delphinemm03ai-wq/taskzen-tunnel).
- Le déploiement du 11/07 a échoué : Vercel bloque Next.js 15.1.3 (CVE-2025-66478). Corrigé le 12/07 en passant à Next 15.1.12. Si un futur deploy échoue avec "Vulnerable version of Next.js detected", mettre à jour Next.

## Déploiement

- **URL production** : https://taskzen-tunnel-delphinemm03ai-wqs-projects.vercel.app
- Projet Vercel : `taskzen-tunnel` (compte delphinemm03ai-wq), 11 variables d'env configurées en Production le 12/07/2026.
- Déploiement via `vercel deploy --prod --yes` depuis le worktree.

## Prochaines actions suggérées

1. Brancher un domaine propre (ex. taskzen.fr ou un sous-domaine) sur le projet Vercel
2. Créer la ressource gratuite (vidéo 5 min "La Méthode IA") et la brancher sur /ressource
3. `/analytics` — suivre les conversions maintenant que le tunnel est en ligne
