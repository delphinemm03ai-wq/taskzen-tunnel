# User Stories : SaaS MCP « builder de tunnels de vente » (phase 2)

> Une story = une tranche livrable de bout en bout, écrite pour être exécutée par un agent.
> Id : `s<numéro>-<slug>`, repris dans chaque fichier du pipeline et dans le nom de branche.
> PRD : `docs/prd-saas-mcp.md`. Numérotation à la suite de `docs/stories.md` (s01 à s09, phase 1).
> Préalable fixé par le PRD : s04, s05, s06 et s09 de la phase 1 sont livrées avant la première story ci-dessous (s08 n'est pas requise).

## Story s10-comptes-isolation : Un client a son compte et ne voit que ses données
**As a** client **I want** me connecter à mon espace et n'y voir que mes tunnels, mes contacts et mes stats **so that** mes données sont à moi et à personne d'autre.

### Complexity
4

### Acceptance criteria
- [ ] Un visiteur crée un compte avec son email (lien magique Supabase Auth, pas de mot de passe) et arrive sur son tableau de bord vide.
- [ ] Une table `tunnel_accounts` existe ; chaque table `tunnel_*` existante porte une colonne `account_id` non nulle ; toutes les lignes existantes sont rattachées au compte de Delphine, créé par la migration avec le rôle `admin`.
- [ ] Les règles RLS sont actives sur toutes les tables `tunnel_*` : avec la clé `anon` et le jeton d'un compte A, une lecture ou une écriture sur une ligne du compte B renvoie zéro ligne ou une erreur (test joué pour chaque table, consigné dans `docs/verif/`).
- [ ] L'écran `/admin` de s07 affiche, pour un compte connecté, uniquement ses tunnels, ses contacts et ses stats ; pour Delphine (rôle `admin`), tout.
- [ ] Le secret `ADMIN_SECRET` et l'en-tête `x-admin-secret` disparaissent : les routes admin exigent une session Supabase valide ; sans session, 401 et aucune donnée. `/api/funnel/stats` suit la même règle.
- [ ] Les routes publiques (`/t/...`, `/api/optin`) restent accessibles sans compte et écrivent les contacts dans le compte propriétaire du tunnel.
- [ ] `npm run build` passe ; les pages de prod actuelles sont inchangées.

### Dependencies
s04, s05, s06, s09 livrées (phase 1 terminée pour Delphine).

### Agentic notes
- Référence cible : connexion et espace client Systeme.io (dashboard) ; forme : Konect (compte, clé API).
- Supabase Auth du projet « tunnel-maison » ; cookies de session côté serveur (`@supabase/ssr`), jamais la clé service_role dans le navigateur. Les lectures admin passent par le client authentifié de l'utilisateur, pas par service_role, sinon la RLS ne prouve rien.
- Risque (4) : une RLS oubliée sur une table = fuite entre clients. Lister les tables à partir de `supabase/migrations/`, écrire un test d'isolation par table avant le code (RED), le faire passer (GREEN).
- Piège : les routes serveur qui utilisent service_role (opt-in, webhooks) doivent fixer `account_id` elles-mêmes à partir du tunnel, jamais à partir d'une valeur envoyée par le client.
- Lancer les agents `secu-controle-acces` et `secu-authentification` en revue de cette story.

## Story s11-tunnels-en-base : Un tunnel vit en base de données et se rend sans rebuild
**As a** client **I want** que mon tunnel soit enregistré dans ma base et visible dès l'enregistrement **so that** une modification est en ligne sans déploiement.

### Complexity
4

### Acceptance criteria
- [ ] Tables `tunnel_funnels` (slug unique par compte, nom, statut brouillon ou publié) et `tunnel_steps` (slug, ordre, config JSON des blocs) ; la config est validée à l'enregistrement par le même schéma zod que `FunnelConfig` ; une config invalide est refusée avec le message d'erreur du schéma.
- [ ] `/t/<slug>/<etape>` lit la base (rendu dynamique avec cache, invalidé à chaque enregistrement) ; un tunnel en brouillon n'est pas servi (404).
- [ ] Les tunnels existants (`demo`, `guides-sommet`, et ceux créés en s09) sont importés par un script idempotent dans le compte de Delphine ; leurs pages rendent à l'identique (comparaison du HTML avant et après, hors identifiants).
- [ ] Le dossier `funnels/` et le registre `allFunnels` disparaissent ; `docs/decisions/` reçoit un ADR qui amende l'ADR 003 : config typée et validée, zéro LLM au rendu, mais stockée en base et non plus dans git.
- [ ] L'événement PostHog `funnel_step_view` porte en plus `account_id` ; l'admin de s07 compte les vues par compte.
- [ ] `npm run build` passe sans tunnel dans le dépôt.

### Dependencies
s10.

### Agentic notes
- Référence cible : la liste des tunnels et des pages de Systeme.io (dashboard/funnels).
- Garder les composants `components/funnel/*` intacts : seule la source de la config change. Le type `FunnelConfig` reste la vérité ; le schéma zod existant (`lib/schemas.ts`) la valide à l'écriture.
- Rendu : `revalidateTag` ou `revalidatePath` à l'enregistrement ; pas de `force-dynamic` sans cache, les pages doivent rester rapides.
- Risque (4) : la régression de rendu. Capturer le HTML des pages existantes avant la migration, comparer après.
- Les liens d'opt-in (`etapeSuivante`) et de CTA restent relatifs au tunnel ; `lib/admin-funnels.ts` (passage, opt-ins) lit désormais la base.

## Story s12-mcp-serveur : Un client pilote ses tunnels depuis Claude
**As a** client **I want** dire à Claude « crée ma page de vente et publie-la » **so that** mon tunnel est en ligne sans ouvrir d'éditeur.

### Complexity
4

### Acceptance criteria
- [ ] Dans son tableau de bord, un client génère une clé API (affichée une seule fois, stockée hachée, révocable) ; une clé révoquée est refusée.
- [ ] Un serveur MCP (transport HTTP streamable, route `/api/mcp`) authentifie chaque appel par la clé et agit uniquement dans le compte de la clé.
- [ ] Outils disponibles : `lister_tunnels`, `creer_tunnel`, `enregistrer_etape` (config complète d'une page, validée par le schéma), `publier_tunnel`, `depublier_tunnel`, `lister_tags`, `creer_tag`, `lire_stats` (vues, inscrits, conversion par page sur 7, 30 ou 90 jours). Chaque outil a une description qui dit quand l'utiliser, ce qu'il attend et ce qu'il renvoie.
- [ ] Depuis Claude Code configuré avec la clé de Delphine, 10 demandes réelles (consignées dans `docs/verif/`) produisent le bon appel d'outil ; les descriptions sont réécrites jusqu'à 10 sur 10.
- [ ] Un appel avec une config invalide renvoie l'erreur du schéma sans rien enregistrer ; deux appels identiques `creer_tunnel` ne créent qu'un tunnel.
- [ ] Rate-limit par clé (réutiliser `lib/rate-limit.ts`) ; 429 au-delà.

### Dependencies
s10, s11.

### Agentic notes
- Référence de forme : Konect (Pierre Evrard) ; skill locale `build-mcp-server` et skill `anthropic-skills:mcp-builder` pour la structure du serveur.
- L'outil de configuration des produits et paiements arrive avec s13 (il a besoin de Stripe Connect).
- Risque (4) : la qualité des descriptions d'outils décide de tout. Méthode du board : écrire, tester sur 10 demandes, noter les ratés, réécrire. Moins d'outils mais fiables.
- Sécurité : la clé API n'est jamais loguée ; comparaison en temps constant ; lancer `secu-api-webhooks` et `secu-ia-llm` en revue.
- Ne pas exposer d'outil de lecture des contacts en version 1 (données personnelles) : les contacts se lisent dans le tableau de bord.

## Story s13-stripe-connect : Un client encaisse sur son propre Stripe
**As a** client **I want** brancher mon compte Stripe et vendre dans mon tunnel **so that** l'argent arrive directement chez moi.

### Complexity
4

### Acceptance criteria
- [ ] Depuis son tableau de bord, un client lance l'onboarding Stripe Connect et revient avec un compte connecté enregistré sur son `account_id` ; l'état (en attente, actif) est visible.
- [ ] La page de commande de s04 encaisse sur le compte connecté du propriétaire du tunnel (paiement direct, frais Stripe à sa charge) ; la vente est enregistrée avec `account_id` et visible dans l'onglet Ventes de son tableau de bord.
- [ ] Le webhook Stripe distingue les événements de la plateforme et ceux des comptes connectés ; un événement rejoué ne crée pas de doublon (`stripe_event_id` unique).
- [ ] L'outil MCP `configurer_produit` (nom, prix, devise EUR, page de livraison) est ajouté ; un tunnel sans Stripe connecté refuse la publication d'une étape de vente avec un message clair.
- [ ] Vente test de bout en bout en mode test, sur un compte connecté de test, email de livraison reçu.

### Dependencies
s04, s10, s11, s12.

### Agentic notes
- Référence cible : « Paramètres du tunnel, modes de paiement » de Systeme.io ; board : « Stripe Connect, tes clients branchent leur propre Stripe ».
- Choisir le type de compte Connect (Standard conseillé : Stripe gère l'onboarding et le support, aucun frais mensuel par compte pour la plateforme) et le consigner dans un ADR.
- Risque (4) : argent. Mode test obligatoire, clés Connect jamais côté client, idempotence sur `stripe_event_id` déjà en place depuis s04.
- Lancer `secu-logique-metier` en revue (contournement de paiement).

## Story s14-sous-domaines : Un tunnel gratuit vit sur son sous-domaine, un tunnel payant sur son domaine
**As a** client **I want** une adresse à moi pour mon tunnel **so that** je peux la partager.

### Complexity
3

### Acceptance criteria
- [ ] À la création du compte, un sous-domaine `<client>.pages.taskzen.fr` est réservé (slug unique, validé) ; `https://<client>.pages.taskzen.fr/<tunnel>/<etape>` sert les pages du compte, et `pages.taskzen.fr/t/...` continue de servir celles de Delphine.
- [ ] Les tunnels d'un compte gratuit affichent en pied de page « Propulsé par Taskzen » avec un lien ; ceux d'un compte payant ne l'affichent pas.
- [ ] Un compte payant ajoute un domaine perso depuis son tableau de bord : le domaine est créé sur le projet Vercel par l'API, les enregistrements DNS à poser sont affichés, l'état (en attente, vérifié) est relu ; une fois vérifié, le domaine sert les tunnels du compte.
- [ ] Un domaine déjà pris par un autre compte est refusé.
- [ ] Vérifié en réel avec le domaine joker `*.pages.taskzen.fr` et un domaine de test de Delphine.

### Dependencies
s10, s11.

### Agentic notes
- Référence cible : « Domaines personnalisés » de Systeme.io ; board : « domaine du client branché par API, SSL inclus ».
- Résolution par l'hôte dans le middleware Next.js : hôte vers `account_id` (table `tunnel_domains`), mis en cache.
- Côté Vercel : le domaine joker demande que `pages.taskzen.fr` soit géré par le DNS d'origine avec un enregistrement `*`; le jeton API Vercel vit côté serveur uniquement.
- La condition « payant » dépend de s15 ; en attendant, un drapeau `plan` sur le compte, posé à la main, suffit pour tester.

## Story s15-abonnement : Un client passe à 29 € par mois et débloque domaine perso et tunnels illimités
**As a** client **I want** m'abonner en un clic **so that** j'ai mon domaine et autant de tunnels que je veux.

### Complexity
4

### Acceptance criteria
- [ ] Un compte gratuit est limité à 1 tunnel publié et aucun domaine perso ; la limite est appliquée dans le tableau de bord et dans les outils MCP (message clair, pas d'erreur technique).
- [ ] Le bouton « Passer à 29 €/mois » ouvre un Checkout Stripe Billing sur le Stripe de Delphine ; au retour, le webhook met le compte en `pro` ; les limites tombent.
- [ ] Un échec de paiement ou une résiliation repasse le compte en `gratuit` à la fin de la période : les tunnels au-delà du premier passent en brouillon (rien n'est supprimé), le domaine perso cesse de servir, le client est prévenu par email.
- [ ] Le portail client Stripe est accessible depuis le tableau de bord (changer de carte, résilier).
- [ ] Le tableau d'admin de Delphine montre le plan et l'état d'abonnement de chaque compte.
- [ ] Parcours complet joué en mode test (abonnement, résiliation, retour au gratuit).

### Dependencies
s04, s10, s13, s14.

### Agentic notes
- Référence cible : la page de tarifs de Systeme.io ; board : « Gratuit, 1 tunnel sur sous-domaine » et « 29 €/mois, domaine perso, tunnels illimités ».
- Un seul produit Stripe « Taskzen Tunnels Pro », prix mensuel ; `stripe_customer_id` et `stripe_subscription_id` sur `tunnel_accounts`.
- Risque (4) : états d'abonnement. Table de transitions écrite avant le code (gratuit, pro, impayé, résilié) et test par transition.
- Les A/B tests restent au cimetière : ne pas les mentionner dans l'offre tant que la version 2 n'existe pas.

## Story s16-retouches-par-bloc : Un client corrige un texte ou un prix sans Claude
**As a** client **I want** modifier un titre, un texte, une image, un bouton ou un prix depuis mon tableau de bord **so that** je corrige une faute en une minute.

### Complexity
2

### Acceptance criteria
- [ ] Dans le tableau de bord, chaque page d'un tunnel liste ses blocs dans l'ordre ; cliquer un bloc ouvre un formulaire généré depuis le schéma du bloc (champs texte, image par adresse, bouton, prix).
- [ ] Enregistrer valide par le schéma, écrit en base et invalide le cache : la page publique montre la modification en moins d'une minute.
- [ ] Impossible d'ajouter, supprimer ou déplacer un bloc depuis ce formulaire (ces actions passent par Claude).
- [ ] Un champ invalide (texte vide obligatoire, prix négatif) affiche l'erreur sous le champ et n'enregistre rien.

### Dependencies
s11.

### Agentic notes
- Référence cible : l'éditeur de Systeme.io, réduit à la seule édition des champs ; le PRD exclut tout glisser-déposer.
- Générer les formulaires depuis les schémas zod des blocs pour ne pas dupliquer la définition des champs.
- Réutiliser le style de `components/admin/` (thème du tunnel, pas de librairie UI).

## Story s17-admin-comptes : Delphine voit et gère tous les comptes
**As a** Delphine **I want** la liste des comptes, leurs tunnels et leurs abonnements, et pouvoir suspendre un compte **so that** je pilote le service.

### Complexity
2

### Acceptance criteria
- [ ] Un onglet « Comptes » (rôle `admin` seulement) liste les comptes : email, date, plan, nombre de tunnels publiés, sous-domaine, domaine perso, état Stripe Connect.
- [ ] Suspendre un compte met ses tunnels hors ligne (404) et bloque ses clés API ; réactiver rétablit tout ; l'action est journalisée.
- [ ] Les totaux (comptes, comptes pro, revenu mensuel récurrent) s'affichent en tête.
- [ ] Un compte non admin qui appelle ces routes reçoit 403 et aucune donnée.

### Dependencies
s10, s15.

### Agentic notes
- Étendre `components/admin/AdminShell.tsx` avec un quatrième onglet visible pour le rôle `admin`.
- Revenu mensuel récurrent = nombre de comptes `pro` × 29 €, pas de calcul Stripe en version 1.

## Story s18-onboarding : Un nouveau client a un tunnel en ligne et Claude branché en moins de 15 minutes
**As a** nouveau client **I want** être guidé de la création du compte à ma première action dans Claude **so that** je vois le résultat avant de payer.

### Complexity
3

### Acceptance criteria
- [ ] Après la création du compte : question « Pour quoi faire ? » (vendre une offre, capter des emails, prendre des rendez-vous) ; la réponse choisit un tunnel modèle.
- [ ] Le tunnel modèle est créé dans le compte et publié sur le sous-domaine, pré-rempli avec le prénom et l'activité du client ; il s'ouvre en un clic.
- [ ] L'écran final montre la clé API et un prompt prêt à coller dans Claude ou ChatGPT (avec l'adresse du serveur MCP et la clé) ; un bouton copie le tout.
- [ ] Un email de bienvenue (Resend) reprend le lien du tunnel et le prompt.
- [ ] Parcours chronométré en réel par un coach testeur : compte, tunnel en ligne, première action réussie depuis Claude, en moins de 15 minutes et sans aide ; écarts consignés.

### Dependencies
s12, s14, s16.

### Agentic notes
- Référence de forme : l'onboarding de Konect (question « pour quoi faire ? », prompt tout fait avec la clé API, paiement après l'effet waouh).
- Trois tunnels modèles écrits en config (vente, capture, rendez-vous) à partir des pages réelles de Delphine ; ce sont des données, pas du code.
- Le prompt à coller est un texte statique avec deux variables (adresse, clé) ; le tester dans Claude Desktop et ChatGPT.
- C'est la story qui prouve le critère 2 du PRD ; la jouer avec un vrai coach, pas seulement en interne.

## Ordre d'exécution
Phase 1 d'abord : s04, s05, s06, s09 (s08 facultative). Puis s10, s11, s12, s16 (parallèle à s12), s13, s14, s15, s17, s18. Le nom définitif et le domaine dédié se tranchent avant s18 (PRD, contrainte « Marque »).
