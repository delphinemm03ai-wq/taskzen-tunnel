---
description: Setup tout-en-un de Claude Tunnel OS. Interview business, connexion des outils (clés guidées une par une), création de la base Airtable, et première génération du tunnel.
---
# Onboarding — Setup complet

LE point d'entrée. Une seule commande qui amène de "projet cloné" à "tunnel personnalisé prêt".
Objectif : le plus simple possible pour l'utilisateur. Claude fait tout, l'utilisateur répond et fournit ses clés.

## Avant de commencer

Lire `memory/brain.md`. Si un setup partiel existe, reprendre là où ça s'est arrêté (ne pas refaire ce qui est fait).

Annoncer en une phrase ce qui va se passer :
```
On va configurer ton tunnel en 4 temps : (1) ton business, (2) tes outils, (3) ta base de leads, (4) ta première génération. C'est parti !
```

---

## Phase 1 : Interview business (le plus important)

Afficher UN SEUL prompt ouvert (pas un questionnaire) :

```
Parle-moi de ton business en quelques phrases :
1. Ton prénom + le nom de ton entreprise
2. Ce que tu vends ou proposes (en simple)
3. À qui tu vends (quel type de client, quel problème ils ont)
4. La ressource que tu veux offrir (vidéo/VSL, PDF, quiz...) et ce qu'elle apporte
5. L'appel que tu proposes ensuite (découverte, audit...) et ce que le prospect en retire

Réponds comme tu veux, je structure tout.
```

### Après la réponse
1. Extraire les infos. S'il manque une info CRITIQUE (pas d'offre, pas de cible, pas de type de ressource), poser UNE question ciblée. Pas un formulaire.
2. Afficher un résumé et demander validation (oui / à corriger).
3. Sur validation, écrire **au fil de l'eau** :
   - `memory/identity/business.md` : identité + ce qu'il vend + client idéal.
   - `memory/identity/offer.md` : offre, promesse, ressource, appel, preuves, objections.
   - `memory/funnel/strategy.md` : promesse du tunnel, type de ressource, angle, mécanisme vers l'appel.

---

## Phase 2 : Connexion des outils (clés guidées UNE PAR UNE)

**Règle clé** : Claude demande chaque clé une à une, avec le lien direct, et **écrit lui-même dans `.env`** (copier `.env.example` vers `.env` si absent). L'utilisateur ne touche jamais au fichier. Les optionnelles peuvent être sautées ("plus tard").

Annoncer :
```
Maintenant tes outils. Je te guide pour chaque clé, tu me la colles, je la range au bon endroit.
Tu peux dire "plus tard" pour n'importe quel outil optionnel.
```

### Ordre et instructions

**1. Airtable (recommandé — stocke tes leads)**
```
Crée un token ici : https://airtable.com/create/tokens
- Nom : "Tunnel OS"
- Scopes : data.records:read, data.records:write, schema.bases:read, schema.bases:write
- Colle-le ici (commence par "pat...").
```
→ Écrire `AIRTABLE_API_KEY` dans `.env`.

**2. PostHog (recommandé — analytics du funnel)**
```
1. Crée un compte sur https://posthog.com (région EU conseillée)
2. Project settings -> Project API Key (commence par "phc_") -> colle-la
3. (pour le dashboard admin) Personal API key : https://app.posthog.com/settings/user-api-keys
4. Project ID : dans l'URL du projet ou Settings
```
→ Écrire `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`.

**3. Resend (recommandé — envoie la ressource par email)**
```
1. Crée une clé sur https://resend.com/api-keys (commence par "re_")
2. Vérifie un domaine d'envoi (ou utilise onboarding@resend.dev pour tester)
```
→ Écrire `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

**4. Cal.com (recommandé — réservation d'appel)**
```
1. Crée un compte sur https://cal.com
2. Crée un type d'événement (ex: "appel-decouverte")
3. Donne-moi ton username et le slug de l'événement.
```
→ Écrire `config.ts > booking.calUsername` + `calEventSlug` (PAS dans .env, c'est public).
→ Mettre aussi dans `memory/funnel/config.md`.

**5. Admin secret**
```
Je génère un mot de passe pour protéger ton dashboard /admin.
```
→ Générer une valeur aléatoire, écrire `ADMIN_SECRET`.

**6. Vercel + GitHub (pour /deploy, plus tard)**
```
Pour le déploiement, on utilisera les MCP Vercel et GitHub quand tu lanceras /deploy. Rien à faire maintenant.
```

Après chaque clé : confirmer brièvement ("Airtable : OK ✓"). À la fin, récap des outils connectés vs "plus tard".

---

## Phase 3 : Création de la base Airtable (via MCP)

Si Airtable est configuré ET le MCP `mcp__airtable__*` est disponible :

1. Lister les bases : `mcp__airtable__list_bases()`.
2. Chercher une base nommée "Tunnel OS". Si absente, demander à l'utilisateur de créer une base vierge "Tunnel OS" sur https://airtable.com puis réessayer.
3. Créer la table `Leads` via `mcp__airtable__create_table` puis ajouter les champs via `create_field` :
   - `Email` (singleLineText, primary)
   - `Prenom` (singleLineText)
   - `Statut` (singleSelect : optin, resource_viewed, booking, client, perdu)
   - `Source` (singleSelect : Tunnel, Google Ads, Meta Ads, Autre)
   - `UTM Source`, `UTM Medium`, `UTM Campaign` (singleLineText)
   - `Created At` (date, format iso)
   - `Notes` (multilineText)
4. Écrire `AIRTABLE_BASE_ID` (+ `AIRTABLE_TABLE_ID=Leads`) dans `.env`.
5. Écrire Base ID + Table ID dans `memory/funnel/config.md`.
6. Confirmer : "CRM créé : table Leads prête."

Si le MCP Airtable n'est pas dispo : expliquer comment l'activer (ajouter le serveur airtable au client Claude) ou créer la table manuellement, et continuer.

---

## Phase 4 : Première génération du tunnel

1. Proposer de lancer `/design` (créer une identité visuelle unique pour SON business — différente du thème par défaut).
2. Puis `/copy` (rédiger les 4 pages à partir de l'interview).
3. `/funnel` applique tout dans `config.ts`.
4. `/preview` pour voir le résultat en local.

Si l'utilisateur veut aller vite, faire design + copy + funnel d'affilée, puis preview.

---

## Phase 5 : Récap + suite

Mettre à jour `memory/brain.md` :
- Cocher les éléments configurés.
- Remplir le "Contexte rapide" (prénom, entreprise, cible, type de ressource).

Afficher :
```
Claude Tunnel OS est prêt !

BUSINESS : [Prénom] - [Entreprise]
RESSOURCE : [type] - [titre]
OUTILS : Airtable [ok], PostHog [ok/plus tard], Resend [ok/plus tard], Cal.com [ok/plus tard]
TUNNEL : 4 pages générées

Prochaines étapes :
1. /preview - voir ton tunnel
2. /deploy - le mettre en ligne sur Vercel
3. /analytics - suivre tes conversions (une fois en ligne)
```

---

## Règles

1. **Interview AVANT les clés** : le contexte business d'abord.
2. **Clés une par une, Claude écrit dans .env** : jamais demander à l'utilisateur d'éditer un fichier.
3. **Optionnel = sautable** : "plus tard" toujours accepté, le mode démo gère l'absence.
4. **Sauvegarder au fil de l'eau** : écrire en mémoire après chaque phase.
5. **Si setup partiel** : reprendre via brain.md.
6. **Français, tutoiement.**
7. **Ne jamais afficher une clé en clair** après l'avoir reçue (juste "OK ✓").
