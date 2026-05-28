---
description: Affiche l'état complet du projet : configuration, tunnel, outils connectés, et prochaines actions.
---
# Brain Status — État du projet

Donner une vue d'ensemble rapide.

## Workflow

1. Lire `memory/brain.md` + les fichiers d'identité/funnel.
2. Vérifier l'état des clés `.env` (présence, pas les valeurs) : Airtable, PostHog, Resend, Cal.com, ADMIN_SECRET.
3. Afficher :
   ```
   === Claude Tunnel OS ===

   BUSINESS : [prénom] - [entreprise] (ou "non configuré")
   RESSOURCE : [type] - [titre]

   SETUP :
   - Onboarding : [ok / à faire]
   - Copywriting : [ok / défaut]
   - Design : [personnalisé / défaut]

   OUTILS :
   - Airtable  : [connecté / manquant]
   - PostHog   : [connecté / manquant]
   - Resend    : [connecté / manquant]
   - Cal.com   : [configuré / manquant]

   DÉPLOIEMENT : [en ligne (URL) / local seulement]

   PROCHAINES ACTIONS :
   1. ...
   2. ...
   ```
4. Suggérer la prochaine étape la plus logique du playbook.

## Règles
- Si rien n'est configuré → recommander `/onboarding`.
- Ne jamais afficher les valeurs des clés.
