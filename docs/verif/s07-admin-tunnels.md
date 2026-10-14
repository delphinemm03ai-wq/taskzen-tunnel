# Verification : story s07-admin-tunnels

> Écrit par l'implémenteur après la dernière tâche locale, commité avec elle. Les commandes
> sont celles d'AGENTS.local.md et du plan `docs/plans/s07-admin-tunnels.md`.

Tree: 461b619262db58711dadece45e5027caaed3937e (au moment de la rédaction, avant le commit de ce record)
Exécution : mode natif (superpowers:executing-plans), journal `.superpowers/sdd/s07-admin-tunnels/progress.md` (non versionné).

| Run | Command | Result | When |
| --- | --- | --- | --- |
| Test (full suite) | aucune | n'existe pas dans ce projet (réglage `Test` à `-`) | non lancé |
| Typecheck | `npx tsc --noEmit` | exit 0 après chaque tâche (1 à 7) | 2026-10-13T12:09:37Z |
| Build | `npm run build` | exit 0 · "Compiled successfully" · `/t/[funnel]/[step]` toujours SSG · nouvelles routes `ƒ /api/admin/funnels`, `ƒ /api/admin/tags` · `○ /admin` | 2026-10-13T12:09:37Z |
| E2E | aucune | n'existe pas dans ce projet | non lancé |

## Critères de la story et preuves

| Critère | Preuve | État |
| --- | --- | --- |
| Trois onglets, secret jamais dans l'adresse | Chrome sur serveur local (secret de test) : onglets Tunnels / Contacts / Ventes, URL reste `/admin` ; `grep -rn "secret=" app components` vide | prouvé |
| Onglet Tunnels : une carte par tunnel + carte historique, pages dans l'ordre, lien, vues, passage, inscrits, conversion, période 7/30/90 | `/api/admin/funnels?periode=30` : 3 tunnels (demo 2 étapes, guides-sommet 12, methode-ia 4), tags sur `decouverte` et les 11 `inscription-*`, `remerciement` sur `diagnostic` et `merci` ; Chrome : 3 cartes, liens `target=_blank` vers la bonne page, aucun NaN ni Infinity | prouvé |
| Un seul événement `funnel_step_view` {tunnel, etape} par page du moteur ; pages historiques inchangées | Chrome : un `POST /e/` 200 par chargement ; HogQL : `funnel_step_view` reçu avec `guides-sommet` / `inscription-quiz-reponse-ia` / `localhost:3077` ; `app/page.tsx`, `/ressource`, `/reserver`, `/merci` non modifiés (diff vide) | prouvé |
| Clic sur inscrits → Contacts filtré ; filtre tag, recherche, pagination, export conservés | Chrome : clic sur « 1 » → onglet Contacts, menu Tag sur `guide-monetisation-youtube`, 1 ligne ; curl `?tag=guide-chaine-postes-ia` json et csv filtrés, colonne tags complète | prouvé |
| Onglet Ventes : encart Stripe s04 | Chrome : texte « Les ventes et le chiffre d'affaires apparaîtront ici avec le paiement Stripe (story s04). » | prouvé |
| Toutes les routes admin exigent `x-admin-secret`, 401 sinon | curl : `/api/admin/contacts` sans en-tête 401, avec `?secret=` 401 ; `/api/admin/tags` faux secret 401 ; `/api/admin/funnels` sans en-tête 401 ; `/api/funnel/stats?secret=` 401, en-tête 200 ; corps 401 = `{"ok":false,"error":{...}}` | prouvé |
| Dégradation propre PostHog / Supabase | Serveurs temporaires : clé PostHog fausse → 200, `sources.posthog: indisponible`, vues `null`, inscrits présents ; URL Supabase fausse → 200, `sources.supabase: indisponible`, inscrits `null`, vues présentes (après passage à une seule requête Supabase, voir journal) ; `periode=12` → 400 message français | prouvé |
| Parcours test réel sur `pages.taskzen.fr` (3 vues, 1 inscrit, 33 %) | nécessite push + déploiement par Delphine et DNS propagé | À prouver en prod (tâche 9) |

## Décisions prises en cours de route (journal)

1. `track()` initialise posthog-js avant `capture` : l'effet de PageView (enfant) s'exécutait avant celui du PostHogProvider (parent) et posthog-js jetait l'événement. Ce défaut existait déjà pour les pages historiques en local.
2. Comptage des inscrits en une seule requête Supabase (`countContactsPerTag`) au lieu d'une par tag : onze connexions en échec simultané faisaient aussi échouer les appels PostHog suivants en simulation de panne.
3. `FunnelDashboard.tsx` supprimé, remplacé par `AdminShell` + `FunnelsPanel` ; la carte historique vient de la route comme les autres.
4. Largeur téléphone non vérifiée dans Chrome (fenêtre maximisée) : protection par construction (tableau `minWidth 560` dans un conteneur `overflowX: auto`). À regarder sur un vrai téléphone en prod.

## Passe de corrections après revue finale (relecteur indépendant, Opus)

Quatre points importants corrigés, chacun observé en échec puis en succès :

| Point | Avant (observé) | Après (observé) |
| --- | --- | --- |
| Plafond 1000 lignes et `id=in.(...)` dans l'adresse | `countContactsPerTag` lisait tout d'un coup ; le filtre tag passait une liste d'UUID dans l'URL | lecture paginée par 1000 avec `created_at=gte.<période>` ; filtre par jointure interne aliasée `filtre:tunnel_contact_tags!inner(...)` : `listContacts({tag})` renvoie le contact avec tous ses tags, `countContacts(undefined, tag)` = 1, tag inconnu = 0 |
| Colonne Passage sur pages parallèles | `vues / vues de la ligne précédente` | champ `vuesAmont` calculé depuis la config : `decouverte` → `diagnostic`, 11 inscriptions → `merci`, pages d'inscription sans amont (tiret) ; vérifié sur `/api/admin/funnels?periode=30` |
| Conversion total / période | inscrits en total, vues sur la période | inscrits sur la période (`countContactsPerTag(since)` : 2 sur 30 jours, 0 avec une date future) ; libellé « Inscrits (période) » ; note sous le tableau mise à jour |
| Faux secret | `submitted` passait à `true` sans vérification | `verifySecret()` appelle `/api/admin/tags` ; Chrome : secret faux → formulaire conservé, message « Secret invalide. Vérifie la valeur et réessaie. », aucun onglet |

`npx tsc --noEmit` exit 0, `npm run build` exit 0 après les corrections. Mineurs reportés (voir le message de fin de story) : accord « au tag » dans les libellés de Contacts, statut PostHog de la carte historique, délai maximal sur les fetch, réponses dans le désordre lors de clics rapides, liens construits depuis l'hôte de la requête, `days` non borné sur `/api/funnel/stats`, mentions de `FunnelDashboard` dans `docs/architecture.md`.

## Parcours test réel en production (14/10/2026)

Déploiement : push de `main` par Delphine le 13/10 (d528b19), Vercel READY, alias `pages.taskzen.fr` (DNS propagé, HTTPS 200). Redéploiement du 14/10 pour un nouveau `ADMIN_SECRET` : un premier essai a échoué au build sur `next/font` (téléchargement Google Fonts, `Cannot read properties of null (reading '1')`), relancé sans changement de code : READY.

| Étape | Observé |
| --- | --- |
| Base avant le test (PostHog, 7 jours) | `guides-sommet/inscription-quiz-reponse-ia` : 0 vue |
| 3 ouvertures dans Chrome (16h34, 16h34, 16h35, Paris) | 3 événements `funnel_step_view` {tunnel, etape}, hôte `pages.taskzen.fr` |
| 4e ouverture (16h40, même navigateur, hors protocole) | comptée aussi : 4 vues au total |
| Opt-in réel (16h41) par `POST /api/optin` avec l'adresse de test de Delphine | `{"ok":true,"data":{"redirectTo":"/t/guides-sommet/merci"}}`, tag `guide-quiz-reponse-ia` posé (Supabase) |
| Tableau de bord `/admin` (lu par Delphine) | ligne « Ta réponse IA est-elle fiable ? » : 4 vues, 1 inscrit, 25 % |
| Protection | `/api/admin/tags` sans en-tête : 401 avant et après redéploiement |

Écart avec le critère : 4 vues et 25 % au lieu de 3 et 33 %, à cause d'une ouverture supplémentaire hors protocole ; le comptage reste exact (une vue par ouverture, un inscrit par opt-in).

## Gestes humains restants

- Garder ou supprimer le contact de test (adresse de Delphine, tags de plusieurs guides), avec son accord.
