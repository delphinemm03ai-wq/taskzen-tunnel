# User Stories — Tunnel maison Taskzen

> One story = one shippable slice, written to be executed by an agent.
> Id format: `s<number>-<short-slug>` — reused in every pipeline file and in the branch name.

## Story s01-moteur-pages — Une page de tunnel rendue depuis un fichier de config
**As a** Delphine **I want** définir une page de tunnel dans un fichier de configuration (suite de blocs typés) **so that** toute page se construit et se modifie sans LLM, en secondes.

### Complexity
3

### Acceptance criteria
- [ ] Un tunnel défini dans `funnels/<slug>.ts` (métadonnées + étapes ordonnées + blocs par étape) s'affiche sur `/t/<slug>/<etape>` sans erreur.
- [ ] Les blocs hero, texte riche, image, vidéo embed, liste à puces, FAQ, témoignage, compte à rebours et CTA bouton se rendent chacun depuis leur config, stylés par le thème du site.
- [ ] Une modification du fichier de config change la page après build, sans aucune intervention d'un LLM dans le rendu.
- [ ] Les 4 pages existantes du tunnel en prod (landing, ressource, réserver, merci) restent inchangées et fonctionnelles.
- [ ] `npm run build` passe.

### Dependencies
Aucune.

### Agentic notes
- Référence cible : l'éditeur de pages Systeme.io (blocs Headline, Text, Button, Image, Faq, Testimonial) ; notre équivalent est un type TS `FunnelConfig` + une bibliothèque de composants React.
- Étendre le motif existant : `config.ts` (source unique) et `components/funnel/*`. Créer `types/funnel.ts`, `funnels/` et un rendu générique `app/t/[funnel]/[step]/page.tsx` (génération statique).
- Piège : ne pas casser les routes actuelles (`app/page.tsx`, `/ressource`, `/reserver`, `/merci`) qui sont en prod. Le nouveau moteur vit à côté, la migration des 4 pages viendra plus tard.
- Thème : réutiliser les variables CSS de `globals.css` (argile, mousse, papier).

## Story s02-contacts-supabase — Contacts et tags dans Supabase, importables
**As a** Delphine **I want** mes contacts et leurs tags dans ma base Supabase, avec import CSV depuis Systeme.io **so that** mes données vivent chez moi.

### Complexity
3

### Acceptance criteria
- [ ] Tables `contacts`, `tags`, `contact_tags` créées dans Supabase (migration SQL versionnée dans le repo).
- [ ] Un contact se crée avec email unique : réinsérer le même email met à jour la fiche au lieu de dupliquer.
- [ ] Un script d'import lit un export CSV Systeme.io (email, prénom, tags) et crée contacts et tags ; relancer l'import ne crée aucun doublon.
- [ ] Un export CSV des contacts avec leurs tags est possible.
- [ ] La page `/admin` liste les contacts (email, prénom, tags, date) avec recherche par email, protégée par le mécanisme existant : secret saisi dans la page et vérifié côté serveur (comme `/api/funnel/stats`). Sans secret valide, aucune donnée ne sort.

### Dependencies
Aucune (parallèle à s01).

### Agentic notes
- Référence cible : Contacts et Tags de Systeme.io (dashboard/contacts).
- Projet Supabase existant (espace formation Delphine IA) : créer un schéma dédié `tunnel` plutôt qu'un nouveau projet. Clés dans `.env` et Vercel ; la clé service_role ne doit jamais atteindre le client.
- L'admin existe (`app/admin/page.tsx`) : l'étendre.
- Airtable reste en place pour le tunnel actuel jusqu'à s09 ; ne pas le débrancher ici.

## Story s03-optin — Un opt-in crée un contact tagué et déclenche l'email de confirmation
**As a** visiteur **I want** laisser mon email sur une page de capture **so that** je reçois la ressource promise.

### Complexity
3

### Acceptance criteria
- [ ] Un bloc formulaire est disponible dans la config des pages (champs prénom optionnel + email, libellés configurables).
- [ ] Une soumission valide crée ou met à jour le contact dans Supabase, pose le tag défini par le tunnel, envoie l'email de confirmation Resend défini en config, puis redirige vers l'étape suivante.
- [ ] Une soumission invalide (email malformé, honeypot rempli) affiche une erreur et ne persiste rien.
- [ ] Les soumissions sont limitées en cadence (rate-limit existant) et l'envoi est idempotent : double clic = un seul contact, un seul email.
- [ ] Test avec une adresse réelle vérifié de bout en bout (contact visible dans l'admin, email reçu).

### Dependencies
s01 (bloc dans le moteur de pages), s02 (contacts).

### Agentic notes
- Référence cible : le formulaire d'opt-in Systeme.io et sa redirection "étape suivante du tunnel".
- Réutiliser `components/funnel/OptinForm.tsx`, `lib/rate-limit.ts`, `lib/resend.ts`, `lib/schemas.ts` ; nouvelle route API `app/api/optin` qui écrit dans Supabase (l'API `lead` actuelle écrit dans Airtable, la laisser intacte).
- Piège connu (skill systeme-io) : tester les formulaires avec une adresse réelle simple, jamais un alias avec `+`.

## Story s04-vente-stripe — Une page de vente encaisse par Stripe et livre le produit
**As a** acheteur **I want** payer un produit depuis la page de vente **so that** je reçois immédiatement mon accès.

### Complexity
4

### Acceptance criteria
- [ ] Un produit (nom, prix TTC, taux de TVA, email de livraison) se définit en config ; un bloc "acheter" l'affiche sur une page du tunnel.
- [ ] Le bouton crée une session Stripe Checkout et redirige vers le paiement.
- [ ] Le webhook Stripe (signature vérifiée) enregistre la vente dans Supabase (contact créé ou retrouvé par email, tag `client-<produit>` posé, montants TTC et HT stockés) et envoie l'email de livraison.
- [ ] Un événement webhook rejoué n'enregistre qu'une seule vente (idempotence par id d'événement).
- [ ] Un paiement annulé ou échoué n'enregistre rien et renvoie vers la page de vente.
- [ ] Parcours vérifié de bout en bout en mode test Stripe (carte 4242).

### Complexity risk (score 4)
Webhooks, idempotence et séparation des clés test et prod : tout le flux d'argent passe ici. Mode test obligatoire jusqu'à validation explicite de Delphine.

### Dependencies
s01, s02.

### Agentic notes
- Référence cible : le tunnel de paiement Pass VIP de Systeme.io (étape Paiement + offre + plan tarifaire).
- Compte Stripe actif (encaissements du sommet). Clés test en local, prod dans Vercel. Endpoint `app/api/stripe/webhook` avec vérification de signature ; stocker un `stripe_event_id` unique.
- HT = TTC / (1 + taux de TVA du produit). Le taux vit dans la config produit (piège vu au sommet : TVA suisse 8,1 % sur une vente CH).

## Story s05-sequences-emails — Une séquence d'emails part toute seule après un tag
**As a** Delphine **I want** définir une séquence (J+0, J+2, ...) déclenchée par un tag **so that** mes inscrits reçoivent mes emails sans Systeme.io.

### Complexity
4

### Acceptance criteria
- [ ] Une séquence se définit en config : tag déclencheur, liste d'emails (objet, corps, délai en heures).
- [ ] Quand le tag est posé sur un contact, les envois sont programmés dans une table `scheduled_emails` ; le cron les envoie à l'heure due via Resend.
- [ ] Chaque email contient un lien de désinscription ; un contact désinscrit ne reçoit plus rien (envois programmés annulés, futurs tags sans effet).
- [ ] Un envoi déjà fait n'est jamais renvoyé (idempotence) ; un échec Resend est marqué et visible.
- [ ] L'admin montre l'état des envois (programmé, envoyé, échoué, annulé) par contact.

### Complexity risk (score 4)
La planification différée sur Vercel (pas de serveur persistant) : tout repose sur le cron et une table d'état. Idempotence et fuseaux horaires à soigner.

### Dependencies
s02, s03.

### Agentic notes
- Référence cible : les Campagnes de Systeme.io (emails d'automatisation, pas les newsletters).
- `app/api/cron` et `vercel.json` existent déjà (cron Vercel) : ajouter une entrée. Resend : domaine taskzen.fr vérifié, expéditeur contact@taskzen.fr ; pour envoyer depuis contact@delphine-miranda.com, vérifier d'abord ce domaine dans Resend.
- Désinscription : token signé par contact, page `/desinscription`, champ `unsubscribed_at`.

## Story s06-affiliation — Un lien affilié attribue la vente et calcule la commission
**As a** affilié **I want** partager mon lien tracké **so that** mes ventes me rapportent 30 %.

### Complexity
4

### Acceptance criteria
- [ ] Un affilié (nom, email, code) se définit en config (fichier versionné, cohérent avec l'angle du PRD) ; son lien est `/t/<tunnel>?aff=<code>`. Les commissions et leur statut vivent en base, pas en config.
- [ ] La visite avec `?aff=` pose un cookie de 30 jours ; la vente Stripe qui suit est attribuée au dernier code présent.
- [ ] La commission vaut 30 % du HT de la vente et s'enregistre avec la vente.
- [ ] L'admin affiche le tableau des commissions : affilié, vente, date, montant, statut (à payer ou payée) modifiable.
- [ ] Une vente sans cookie est organique : aucune commission.

### Complexity risk (score 4)
L'attribution traverse trois contextes (cookie navigateur, session Checkout, webhook serveur) : passer le code affilié en metadata de la session Stripe, sinon le webhook ne peut pas attribuer.

### Dependencies
s04.

### Agentic notes
- Référence cible : l'affiliation Systeme.io (liens sa..., Factures affiliés, commission sur le HT : 18,59 € = 30 % de 61,98 € constaté le 10/10).
- Le paiement des commissions reste manuel (virement par Delphine) : le tableau remplace les Factures affiliés, pas Wise.

## Story s07-admin-tunnels : Le tableau de bord de l'admin montre chaque tunnel, ses pages, ses inscrits et ses vues
**As a** Delphine **I want** voir dans `/admin`, tunnel par tunnel, mes pages avec leur lien, leurs vues, leurs inscrits et leurs taux, et filtrer mes contacts par tag **so that** je pilote mes tunnels sans ouvrir PostHog ni Supabase.

> Avancée le 13/10/2026 à la demande de Delphine et découplée de Stripe : l'onglet Ventes est un encart d'attente jusqu'à s04. Design détaillé : `docs/specs/2026-10-13-admin-tunnels-design.md`.

### Complexity
3

### Acceptance criteria
- [x] `/admin` garde la saisie du secret et présente trois onglets : Tunnels (par défaut), Contacts, Ventes. Le secret n'est plus pré-rempli ni transmis par l'adresse (`?secret=` supprimé partout).
- [x] Onglet Tunnels : une carte par tunnel de la config (`funnels/index.ts`) plus une carte « Tunnel Méthode IA (pages historiques) ». Chaque carte liste ses pages dans l'ordre avec titre, adresse publique cliquable (nouvel onglet), vues sur la période, taux de passage depuis la page précédente, et pour une page opt-in le nombre d'inscrits (comptage Supabase par tag) et le taux de conversion inscrits / vues. Sélecteur 7 / 30 / 90 jours.
- [x] Chaque page du moteur envoie un seul événement PostHog `funnel_step_view` avec les propriétés `tunnel` et `etape` ; les 4 pages historiques gardent leurs événements actuels.
- [x] Un clic sur le nombre d'inscrits d'une page ouvre l'onglet Contacts filtré sur son tag. L'onglet Contacts garde recherche, pagination et export CSV et gagne un filtre par tag (liste des tags existants).
- [x] Onglet Ventes : encart « Les ventes et le chiffre d'affaires apparaîtront ici avec le paiement Stripe (story s04). »
- [x] Toutes les routes admin (`/api/admin/funnels` nouvelle, `/api/admin/contacts`, `/api/funnel/stats`) exigent le secret dans l'en-tête `x-admin-secret` ; sans secret ou avec un faux, 401 et aucune donnée.
- [x] Dégradation propre : PostHog absent ou en panne, les vues passent en tiret avec un message, pages et inscrits restent affichés ; Supabase injoignable, les inscrits passent en tiret avec un message ; aucune source ne bloque toute la page.
- [x] Parcours test réel sur le domaine de prod non filtré (`pages.taskzen.fr`) : 3 ouvertures d'une page d'inscription de `guides-sommet` et 1 opt-in avec une adresse réelle simple donnent 3 vues, 1 inscrit, 33 % de conversion et 1 contact dans Contacts filtré sur ce tag. Les pages publiques `/t/...` sont inchangées. `npm run build` passe.

### Dependencies
s03. Ne dépend plus de s04 : ventes et CA arrivent dans l'onglet Ventes avec s04.

### Agentic notes
- `lib/posthog-client.ts`, `lib/posthog-query.ts` (HogQL, `PROD_HOST_FILTER`) et `components/funnel/PageView.tsx` existent : les généraliser au moteur multi-tunnels. Le filtre d'hôte exclut `localhost` et `*.vercel.app` : en local on vérifie l'arrivée de l'événement dans PostHog, le chiffre se vérifie en prod sur `pages.taskzen.fr`.
- `components/admin/FunnelDashboard.tsx` et `ContactsPanel.tsx` (contexte `AdminSecretContext`) existent : l'admin devient un conteneur à onglets, les stats historiques deviennent une carte.
- Référence cible : l'onglet Statistiques d'un tunnel Systeme.io (vues, inscrits, taux) et sa liste de contacts filtrée par tag.
- La clé service_role Supabase et la clé personnelle PostHog restent côté serveur.

## Story s08-automatisations — Une règle "événement vers action" se déclare en config
**As a** Delphine **I want** déclarer des règles (formulaire soumis donne tag ; tag posé lance séquence ; achat pose tag) **so that** les enchaînements se font tout seuls et restent lisibles au même endroit.

### Complexity
3

### Acceptance criteria
- [ ] Les déclencheurs formulaire-soumis, tag-posé et achat-confirmé et les actions poser-tag, retirer-tag et inscrire-à-la-séquence se combinent librement dans un fichier de règles.
- [ ] Les enchaînements codés en dur dans s03, s04 et s05 passent par ce moteur de règles sans changement de comportement observable.
- [ ] Chaque exécution de règle est journalisée (contact, règle, date, résultat) et visible dans l'admin.
- [ ] Une règle en boucle (tag A pose tag B qui pose tag A) est coupée par une profondeur maximale.

### Dependencies
s03, s04, s05.

### Agentic notes
- Référence cible : les Règles d'automatisation Systeme.io (déclencheurs tag_added et form_subscribed ; actions add_tag, remove_tag, inscription à une campagne).
- C'est une refactorisation plus une extension : la valeur est la lisibilité et la combinaison libre, pas une capacité nouvelle visible. La garder petite.
- Première story à sacrifier si le délai de fin novembre serre (constat de la revue) : s09 ne dépend pas d'elle.

## Story s09-bascule — Le premier tunnel réel tourne chez nous
**As a** Delphine **I want** mes contacts réels importés et un vrai tunnel en ligne sur mon domaine **so that** je peux commencer à quitter Systeme.io.

### Complexity
3

### Acceptance criteria
- [ ] L'export CSV réel de Systeme.io est importé : le nombre de contacts et de tags correspond à l'export (écarts listés).
- [ ] La page d'inscription du sommet est reconstruite en config et rendue sans LLM (critère 7 du PRD), avec opt-in fonctionnel testé en réel.
- [ ] Le tunnel est servi sur un domaine de Delphine (sous-domaine dédié, les routes prod actuelles intactes).
- [ ] Une checklist de résiliation Systeme.io est produite : ce qui est couvert, ce qui reste (espace membre, tunnels encore actifs).

### Dependencies
s03, s04, s05, s06, s07 (fermes : la bascule réelle exige opt-in, vente, séquences, affiliation et admin des tunnels opérationnels). s08 n'est pas requise.

### Agentic notes
- L'export CSV se fait depuis dashboard/contacts de Systeme.io (par Delphine, ou Chrome piloté).
- Domaine : taskzen.fr est sur Lovable, delphine-miranda.com sur Hostinger, sommet.taskzen.fr pointe vers Systeme.io : le choix du sous-domaine se fait avec Delphine à ce moment-là.
- Ne rien résilier : la story produit la checklist, Delphine décide.

## Ordre d'exécution
s01 et s02 en parallèle, puis s03, puis s07 (avancée le 13/10/2026, ne dépend que de s03), puis s04, s05, s06, s08, s09. L'onglet Ventes de s07 se remplit avec s04.

Phase 2 (SaaS MCP) : voir `docs/stories-saas-mcp.md` (s10 à s18), après s04, s05, s06 et s09.
