# Claude Tunnel OS — Instructions Claude Code

## Objectif

Ce projet transforme Claude Code en assistant pour créer, optimiser et déployer un **tunnel de vente** complet.

Le tunnel a 4 étapes :

```
Landing (opt-in)  ->  Ressource (accès)  ->  Réserver (Cal.com)  ->  Merci
     /                   /ressource             /reserver           /merci
```

La ressource est générique : VSL, vidéo, PDF, quiz. L'utilisateur décrit son business, et Claude génère le copywriting, le design, configure les outils (Airtable, PostHog, Resend, Cal.com) et déploie sur Vercel.

Tout se pilote depuis Claude Code, en langage naturel ou via des commandes (`/onboarding`, `/funnel`, `/copy`, `/design`, `/deploy`...).

---

## Première chose à faire

**À CHAQUE début de session**, lire `memory/brain.md` pour le contexte rapide (état du setup, business de l'utilisateur, prochaines actions).

Si `memory/identity/business.md` contient `[À CONFIGURER]` ou si le projet n'a jamais été configuré → proposer `/onboarding`.

---

## Auto-Routing

Détecter l'intention de l'utilisateur et activer la bonne commande SANS qu'il ait à taper `/commande`. Lire le fichier `.claude/commands/[nom].md` correspondant et suivre son workflow.

| L'utilisateur dit... | Commande |
|----------------------|----------|
| "je commence", "configure tout", "setup", "première utilisation" | `/onboarding` |
| "génère mon tunnel", "crée les pages", "refais le funnel" | `/funnel` |
| "écris le texte", "le copywriting", "améliore ma landing", "le hook" | `/copy` |
| "change le design", "les couleurs", "la typo", "l'apparence" | `/design` |
| "configure la ressource", "ma vidéo", "mon PDF", "ma VSL" | `/resource` |
| "mes leads", "le CRM", "qui s'est inscrit", "Airtable" | `/crm` |
| "mes stats", "le taux de conversion", "analytics", "le funnel marche-t-il" | `/analytics` |
| "améliore la conversion", "optimise", "quelle étape pêche" | `/optimize` |
| "déploie", "mets en ligne", "publie sur Vercel" | `/deploy` |
| "lance le serveur", "preview", "je veux voir le tunnel" | `/preview` |
| "où j'en suis", "état du projet", "brain status" | `/brain-status` |
| "retiens ça", "sauvegarde", "memory save" | `/memory-save` |

Si l'intention n'est pas claire, poser UNE question courte.

---

## Protocole Mémoire

**Début de session** : lire `memory/brain.md` (+ fichiers référencés si pertinents).

**Pendant** : accumuler les observations (ce qui convertit, décisions de copy/design, apprentissages).

**Fin de session** : proposer `/memory-save` si des apprentissages méritent d'être persistés.

**RÈGLE** : ne JAMAIS écraser un fichier mémoire entièrement. Ajouter ou mettre à jour les sections pertinentes.

---

## Fichiers de configuration

| Fichier | Rôle |
|---------|------|
| `config.ts` | **SOURCE UNIQUE** : couleurs, textes des 4 pages, lien Cal.com, ressource. Les pages lisent UNIQUEMENT ce fichier. |
| `.env` | Clés API runtime (Airtable, Resend, PostHog, Cal.com). Créé par `/onboarding`. |
| `memory/identity/business.md` | Qui es-tu, ce que tu vends, à qui. |
| `memory/identity/offer.md` | Offre, promesse, preuve, objections. |
| `memory/identity/brand.md` | Direction artistique (couleurs, ton, fonts). |
| `memory/funnel/strategy.md` | Type de ressource, angle, promesse du tunnel, offre de l'appel. |
| `memory/funnel/copy.md` | Copy validée page par page (source de vérité). |
| `memory/funnel/config.md` | IDs Airtable, IDs PostHog, lien Cal.com. |

**RÈGLE** : avant toute action, lire les fichiers pertinents. Quand tu modifies le tunnel, écrire dans `config.ts` ET dans `memory/funnel/copy.md`.

---

## Outils (MCP + API)

### Airtable (CRM des leads) — MCP + runtime
- **MCP** (`mcp__airtable__*`) : utilisé par `/onboarding` pour créer la base + table `Leads`, et par `/crm` pour consulter/MAJ les leads.
- **Runtime** : `lib/airtable.ts` crée/MAJ les leads via l'API REST (clés `.env`) quand un visiteur s'inscrit. Fonctionne en prod sans MCP.
- Table `Leads` : `Email` (primary), `Prenom`, `Statut` (optin/resource_viewed/booking/client/perdu), `Source`, `UTM Source/Medium/Campaign`, `Created At`, `Notes`.

### PostHog (analytics) — MCP + runtime
- **Runtime** : `lib/posthog-client.ts` capture les events du funnel côté navigateur.
- **Admin** : `/api/funnel/stats` interroge PostHog en HogQL (clé perso + project ID) pour le dashboard `/admin`.
- Events : `landing_view`, `lead_signup`, `resource_view`, `resource_engaged`, `booking_click`, `booking_view`, `booking_completed` (voir `lib/events.ts`).

### Resend (email) — runtime
- `lib/resend.ts` envoie la ressource par email après l'opt-in. Clés `RESEND_API_KEY` + `RESEND_FROM_EMAIL`.

### Cal.com (réservation) — runtime
- Embed sur `/reserver` via `@calcom/embed-react`. Config : `config.ts > booking.calUsername` + `calEventSlug`.

### Vercel + GitHub (déploiement) — MCP
- `/deploy` pousse le code sur GitHub (MCP github) et déploie sur Vercel (MCP vercel).

### Mode démo
Si une clé manque, le tunnel tourne quand même (opt-in accepté sans Airtable, tracking no-op, Cal placeholder), avec un bandeau "Mode démo". Vérifier via `isAirtableConfigured()`, `isResendConfigured()`, `isPostHogConfigured()`.

---

## Règles de communication

- **Langue** : français, tutoiement.
- **Ton** : amical, pédagogique, simple. Pas de jargon inutile.
- **Proactif** : après chaque action, proposer la prochaine étape logique du playbook.
- **Confirmer** : toujours valider avant une action externe irréversible (push GitHub, deploy Vercel, envoi en masse).
- **Coût** : prévenir avant toute action payante.

---

## Règles techniques

1. **config.ts = source unique** : les pages ne contiennent JAMAIS de texte/couleur en dur. Tout vient de `config.ts`.
2. **Design original** : ne jamais copier un design existant d'un autre projet. Chaque tunnel a sa propre identité (via `/design` + skill `frontend-design`).
3. **Onboarding first** : si non configuré, proposer `/onboarding`.
4. **Mémoire** : ne jamais écraser, toujours ajouter/MAJ.
5. **Sauvegarder au fil de l'eau** : écrire en mémoire après chaque phase, pas tout à la fin.
6. **Tester avant de livrer** : lancer `/preview` et vérifier le tunnel dans le navigateur après une génération.
7. **Clés `.env`** : Claude les écrit lui-même quand l'utilisateur les fournit (l'utilisateur ne touche pas au fichier).

---

## Playbook principal

```
/onboarding  ->  /design  ->  /copy  ->  /funnel  ->  /preview  ->  /deploy  ->  /analytics  ->  /optimize
```

1. **/onboarding** : interview business + clés API + base Airtable + 1ère génération.
2. **/design** : direction artistique (couleurs, fonts).
3. **/copy** : copywriting des 4 pages.
4. **/funnel** : applique copy + design dans `config.ts` et les pages.
5. **/preview** : voir le tunnel en local.
6. **/deploy** : mise en ligne sur Vercel.
7. **/analytics** + **/optimize** : mesurer et améliorer la conversion.
