---
description: Lance le serveur de développement pour voir le tunnel en local, avec nettoyage du cache Next.js.
---
# Preview — Serveur local

Voir le tunnel dans le navigateur en local.

## Workflow

1. Si besoin, nettoyer le cache : supprimer `.next`.
2. Vérifier que les dépendances sont installées (`node_modules` présent, sinon `npm install`).
3. Lancer `npm run dev` (port 3000 par défaut).
4. Donner les URLs à tester :
   - Landing : http://localhost:3000
   - Ressource : http://localhost:3000/ressource (nécessite d'avoir soumis l'opt-in)
   - Réserver : http://localhost:3000/reserver
   - Merci : http://localhost:3000/merci
   - Admin : http://localhost:3000/admin
5. Inviter l'utilisateur à parcourir le funnel et signaler ce qu'il veut ajuster (`/copy`, `/design`).

## Note
Les pages `/ressource` et `/merci` sont protégées par cookie (gating funnel). Pour les voir, passer par le parcours normal (opt-in → ressource → réserver → merci).
