# Design : tableau de bord des tunnels dans /admin (story s07-admin-tunnels)

Date : 13/10/2026. Validé en conversation avec Delphine section par section (écrans, données et protection, preuves), puis sur une maquette cliquable à données fictives.

## 1. Intention

Delphine veut voir ce qui se passe dans son tunnel maison sans ouvrir PostHog ni Supabase : quelles pages existent, où elles mènent, combien de personnes les voient, combien s'inscrivent, et plus tard combien achètent. Le tout dans la page `/admin` existante, pas dans une application à part.

Hors périmètre : ventes et chiffre d'affaires (arrivent avec s04, onglet Ventes réservé), édition des tunnels depuis l'admin (les pages restent définies par config, ADR 003), comptes utilisateurs (le secret unique reste le mécanisme d'accès).

## 2. Écrans

`/admin` garde la saisie du secret. Une fois le secret saisi, un bandeau à trois onglets.

### Onglet Tunnels (par défaut)
- Sélecteur de période 7 / 30 / 90 jours, commun à toutes les cartes (porte sur les vues ; les inscrits sont un total).
- Une carte par tunnel de la config (`allFunnels` dans `funnels/index.ts`, aujourd'hui `demo` et `guides-sommet`), plus une carte « Tunnel Méthode IA (pages historiques) » qui reprend les 4 pages de juillet et leurs événements actuels.
- En tête de carte : nom du tunnel, inscrits total, vues sur la période, conversion globale (somme des inscrits des pages opt-in / somme des vues de ces mêmes pages ; si le tunnel n'a pas d'opt-in, pas de conversion).
- Tableau des pages dans l'ordre de la config. Colonnes : Page (titre, badge « opt-in » ou « remerciement » si pertinent, adresse publique cliquable qui ouvre un nouvel onglet), Vues, Passage (vues de cette page / vues de la page précédente, tiret pour la première), Inscrits (uniquement pour une page qui porte un bloc `optin` : comptage par tag, cliquable), Conv. (inscrits / vues de la page).
- Note sous le tableau qui définit Passage et Conv.

### Onglet Contacts
Le `ContactsPanel` actuel (recherche par e-mail, 25 par page, export CSV) plus un filtre « Tag » : menu déroulant des tags existants (lecture de `tunnel_tags`). Le clic sur un nombre d'inscrits dans Tunnels ouvre cet onglet avec le tag présélectionné.

### Onglet Ventes
Un seul encart : « Les ventes et le chiffre d'affaires apparaîtront ici avec le paiement Stripe (story s04). »

### Style
Thème du tunnel (`docs/design-system.md`) : utilitaire, chiffres en `--font-mono`, cartes `.surface-card`, pas de mode sombre, pas de librairie UI. Pas de tiret cadratin.

## 3. Données

### Structure des tunnels
Lue côté serveur depuis la config dans la nouvelle route `GET /api/admin/funnels?periode=30`. Pour chaque tunnel : slug, nom, et pour chaque étape : slug, titre, URL publique (`https://<hôte de la requête>/t/<tunnel>/<etape>`), tag d'opt-in s'il existe (premier bloc `optin` de l'étape), indicateur « remerciement » si l'étape est la cible `etapeSuivante` d'un opt-in. La carte historique est décrite en dur dans la route avec les 4 chemins et les événements de `lib/events.ts`.

### Inscrits
Comptage Supabase par tag : une requête `count` sur `tunnel_contact_tags` jointe à `tunnel_tags` par nom, pour chaque tag d'opt-in. Fonction `countContactsByTag(tag)` ajoutée à `lib/supabase.ts`, sur le modèle de `countContacts` (en-tête `Prefer: count=exact`, lecture du `Content-Range`). Total par tunnel = somme des tags du tunnel (un contact inscrit sur deux guides compte deux fois, assumé : on compte des inscriptions).

### Vues
- Côté pages : `components/funnel/PageView.tsx` envoie un seul événement `funnel_step_view` avec `{ tunnel, etape }`. La route `app/t/[funnel]/[step]/page.tsx` le monte avec ces deux valeurs. Les 4 pages historiques gardent leurs événements nommés (`FUNNEL_STEPS`).
- Côté lecture : une seule requête HogQL dans `lib/posthog-query.ts`, `countStepViews(periodeJours)` : `select properties.tunnel, properties.etape, count() from events where event = 'funnel_step_view' and timestamp > now() - interval N day and <PROD_HOST_FILTER> group by 1, 2`. Le résultat est recoupé avec la config : une étape sans ligne vaut 0, une ligne sans étape connue est ignorée.
- Les vues historiques continuent de passer par `countEvent` sur les 4 événements existants.

### Réponse de `/api/admin/funnels`
```json
{
  "periode": 30,
  "sources": { "posthog": "ok | indisponible", "supabase": "ok | indisponible" },
  "tunnels": [
    {
      "slug": "guides-sommet", "nom": "Guides du sommet IA en 5 Jours", "historique": false,
      "inscrits": 23, "vues": 188,
      "etapes": [
        { "slug": "inscription-x", "titre": "...", "url": "https://pages.taskzen.fr/t/guides-sommet/inscription-x",
          "tag": "guide-x", "remerciement": false, "vues": 61, "inscrits": 9 }
      ]
    }
  ]
}
```
Les taux (passage, conversion) se calculent côté client à partir de ces nombres. Un nombre vaut `null` quand sa source est indisponible.

### Contacts filtrés par tag
`GET /api/admin/contacts` gagne un paramètre `tag` (zod, optionnel, même alphabet que les noms de tags), répercuté sur `listContacts` et `countContacts` (filtre PostgREST via `tunnel_contact_tags`). L'export CSV respecte le filtre. Nouvelle route `GET /api/admin/tags` qui liste les noms de tags pour le menu déroulant.

## 4. Protection

- Toutes les routes admin lisent le secret dans l'en-tête `x-admin-secret` uniquement : `/api/admin/funnels`, `/api/admin/contacts`, `/api/admin/tags`, et `/api/funnel/stats` qui abandonne le `?secret=`. Comparaison en temps constant comme aujourd'hui.
- `/admin` ne lit plus `?secret=` dans l'adresse et ne l'y écrit jamais. Le secret vit dans l'état React (`AdminSecretContext`), le temps de l'onglet.
- Réponses 401 sans corps de données. Les clés service_role Supabase et personnelle PostHog restent côté serveur.

## 5. Erreurs et pannes

| Situation | Affichage |
|---|---|
| Variables PostHog absentes ou requête en échec | Vues et taux en tiret, message sous la carte : « Vues indisponibles : PostHog n'a pas répondu. » Pages et inscrits affichés. |
| Supabase injoignable (projet en pause, clé fausse) | Inscrits et conversion en tiret, message : « Inscrits indisponibles : Supabase n'a pas répondu (projet en pause ?). » |
| Secret absent ou faux | Écran de saisie du secret, message d'erreur inline, aucune donnée. |
| Tunnel sans opt-in | Colonne Inscrits vide, pas de conversion globale. |

Aucune source en panne ne bloque toute la page : la route répond 200 avec `sources` renseigné et des `null` là où la donnée manque.

## 6. Preuves (critères de la story)

Le dépôt n'a pas de tests automatisés (cadrage AGENTS.local.md). La preuve est consignée dans `docs/verif/s07-admin-tunnels.md`.

1. `npm run build` passe. Une étape opt-in sans `tag` reste une erreur de type (déjà le cas).
2. En local, l'onglet Tunnels liste exactement les tunnels de la config avec le bon nombre de pages (demo : 2, guides-sommet : 12) ; chaque lien ouvre la bonne page.
3. Inscrits : un contact de test (adresse réelle simple de Delphine, jamais d'alias `+`) inscrit sur une page guide fait passer le compteur de 0 à 1 ; le lien ouvre Contacts filtré sur ce tag avec cette seule ligne. Contact supprimé ensuite, avec l'accord de Delphine.
4. Vues : en local, l'événement `funnel_step_view` arrive dans PostHog avec les bonnes propriétés (le filtre d'hôte l'exclut des comptages). En prod sur `pages.taskzen.fr`, 3 ouvertures d'une page d'inscription donnent 3 vues et, avec le contact du point 3, 33 % de conversion.
5. Protection : `curl` sans en-tête et avec un faux secret sur chaque route donne 401 et aucune donnée ; aucune adresse de l'admin ne contient le secret.
6. Pannes : variables PostHog retirées en local, puis URL Supabase fausse : la page affiche ce que la table de la section 5 prévoit.
7. Les pages publiques `/t/...` et les 4 pages historiques sont inchangées (même rendu, un seul événement envoyé par page).

## 7. Ce qui dépend de Delphine

- `git push` sur le remote `delphine` et déploiement Vercel.
- Propagation DNS de `pages.taskzen.fr` et passage de ses liens publics sur ce domaine : sans cela PostHog ne compte aucune vue (`*.vercel.app` filtré).

## 8. Fichiers touchés (prévision pour le plan)

- Nouveaux : `app/api/admin/funnels/route.ts`, `app/api/admin/tags/route.ts`, `components/admin/AdminTabs.tsx`, `components/admin/FunnelsPanel.tsx`, `components/admin/SalesPlaceholder.tsx`, `docs/verif/s07-admin-tunnels.md`.
- Modifiés : `app/admin/page.tsx`, `components/admin/FunnelDashboard.tsx` (devient une carte), `components/admin/ContactsPanel.tsx` (filtre tag), `app/api/admin/contacts/route.ts`, `app/api/funnel/stats/route.ts`, `lib/supabase.ts`, `lib/posthog-query.ts`, `lib/events.ts`, `components/funnel/PageView.tsx`, `app/t/[funnel]/[step]/page.tsx`.
