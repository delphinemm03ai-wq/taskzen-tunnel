---
description: Met le tunnel en ligne. Pousse le code sur GitHub et déploie sur Vercel via les MCP. Guidé et confirmé.
---
# Deploy — Mise en ligne

Déployer le tunnel sur Vercel, avec GitHub comme source.

## Prérequis
- Le tunnel compile (`npm run build` passe).
- MCP `vercel` et `github` disponibles. Sinon, guider l'utilisateur pour les activer.

## Workflow (confirmer AVANT chaque action externe)

1. **Vérifier le build** : lancer `npm run build`. S'il échoue, corriger avant de déployer.
2. **GitHub** :
   - Si pas encore de repo distant : proposer de créer un repo (MCP github) et y pousser le code. **Confirmer avant.**
   - Sinon : pousser les derniers commits.
3. **Vercel** :
   - Déployer via `mcp__vercel__deploy_to_vercel` (ou connecter le repo GitHub à Vercel). **Confirmer avant.**
4. **Variables d'environnement** : RAPPELER d'ajouter sur Vercel toutes les clés du `.env` (Airtable, Resend, PostHog, ADMIN_SECRET, NEXT_PUBLIC_SITE_URL avec l'URL de prod). Le `.env` local n'est PAS déployé.
5. **Retourner l'URL live** et proposer de tester le parcours complet en prod.
6. Mettre à jour `memory/funnel/config.md` (repo + URL prod) et `memory/brain.md` (déployé : oui).

## Règles
- **Confirmer chaque action irréversible** (création repo, push, déploiement).
- Ne jamais commiter `.env` (il est dans `.gitignore`).
- Après déploiement, mettre `NEXT_PUBLIC_SITE_URL` à l'URL de prod (pour les liens email Resend).
- Rappeler à l'utilisateur de marquer le repo comme "Template" sur GitHub s'il veut le partager.
