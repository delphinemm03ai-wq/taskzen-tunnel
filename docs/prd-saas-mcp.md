# PRD : SaaS MCP « builder de tunnels de vente » (phase 2 du tunnel maison)

Cadré le 13/10/2026 avec Delphine, question par question. Ce PRD complète `docs/prd.md` (phase 1 : remplacer Systeme.io pour Delphine seule) et prend volontairement l'inverse sur trois points que la phase 1 excluait : comptes clients, tunnels stockés en base, abonnement. Tout le reste de la phase 1 (moteur de pages, contacts, opt-in, stats, puis Stripe, séquences, affiliation) est le socle réutilisé.

Référence de forme : la méthode « SaaS MCP » de Pierre Evrard (idée 1 du board « 7 idées de SaaS MCP », copie dans `Documents\Sans-titre-2026-07-13-2143.excalidraw.png`, fiche wiki `saas-mcp-5-etapes-pierre-evrard`). Le client pilote le service depuis Claude ou ChatGPT ; le serveur fait ce que l'IA ne sait pas faire seule.

## Target SaaS
Systeme.io (systeme.io) et ses équivalents (ClickFunnels, Kodefast) : plateformes de tunnels de vente avec éditeur visuel, emails, contacts, paiements.

## Kill mode
Produit à vendre (competing product), bâti sur le tunnel maison de la phase 1. Le client ne passe plus par un éditeur : il demande à Claude, le serveur crée, publie, encaisse et mesure. Conséquences : comptes clients isolés, tunnels en base de données, sous-domaines, Stripe Connect, abonnement, serveur MCP avec clés API.

## Why kill it
- L'éditeur visuel est la friction : lent, bloquant (incidents Systeme.io de septembre 2026), impossible à piloter par une IA.
- Un coach ou un consultant n'a besoin que d'un tunnel simple (capture, vente, merci) et paie un abonnement complet pour ça.
- Ce qu'on n'utilise pas : webinaires, communauté, marketplace, blog, équipes.
- Argument du board : « un tunnel complet en 30 minutes au lieu d'une journée ».

## Problem
Des indépendants (coachs, consultants, infopreneurs) veulent vendre une offre en ligne sans apprendre un éditeur de tunnels ni payer un intégrateur. Ils utilisent déjà Claude ou ChatGPT au quotidien. Rien aujourd'hui ne leur permet de dire à leur IA « crée ma page de vente et publie-la » et d'obtenir un tunnel en ligne, avec paiement, sur leur domaine. Pourquoi maintenant : le tunnel maison existe et tourne en prod (s01 à s03, s07 déployée le 13/10/2026), le protocole MCP est supporté par Claude et ChatGPT, et Delphine est sa propre première utilisatrice.

## Target users
Ordre décidé le 13/10/2026 : **1 puis 2**, 3 plus tard.
1. **Delphine, utilisatrice zéro** : pilote son propre tunnel maison depuis Claude. Aucune validation externe nécessaire ; le résultat sert de démonstration.
2. **Coachs sportifs et consultants** : une offre, un tunnel. Audience existante (sommet, LinkedIn, Instagram, guides).
3. **Infopreneurs** (plus tard) : tunnels plus gros, approche du board « je t'ai refait ton tunnel, il est en ligne ici ».

Utilisateurs finaux des pages : les visiteurs et acheteurs des clients.

## Perimeter — the 20% that matters

### Replicated (core loop)
Les six actions du board, moins les A/B tests (version 2).

| Feature | Complexity (1-5) | Why this score |
|---|---|---|
| Comptes clients et isolation : Supabase Auth, chaque ligne porte son compte, règles RLS, un client ne voit jamais les données d'un autre | 4 | Rôles, sécurité, tests d'isolation obligatoires |
| Tunnels en base de données : la config typée (même schéma zod qu'au build aujourd'hui) est validée à l'enregistrement et rendue dynamiquement avec cache ; les tunnels existants sont importés ; les blocs, le thème et le code restent dans git | 4 | Migration du moteur `/t/[funnel]/[step]` de statique à dynamique, amendement de l'ADR 003 |
| Serveur MCP « Taskzen Tunnels » : clé API par compte générée dans le tableau de bord ; outils : créer ou modifier une page, publier, configurer produit et paiement, tags et segments, lire les stats | 4 | API authentifiée, descriptions d'outils testées sur des demandes réelles, idempotence |
| Sous-domaines `<client>.pages.taskzen.fr` (gratuit) et domaine perso branché par l'API Vercel (payant) | 3 | DNS, SSL, vérification de domaine |
| Stripe Connect : le client branche son propre Stripe et encaisse dans son tunnel ; Delphine encaisse l'abonnement sur le sien | 4 | Onboarding Connect, webhooks, idempotence |
| Abonnement à 29 €/mois (Stripe Billing) : passage gratuit vers payant, débloque domaine perso et tunnels illimités, retour au gratuit si résiliation | 4 | États d'abonnement, webhooks, droits |
| Tableau de bord client : l'écran `/admin` de s07 filtré par compte (tunnels, pages, vues, inscrits, conversion, ventes, contacts, export) | 2 | Réutilisation de s07 avec filtre par compte |
| Formulaire par bloc : chaque bloc d'une page s'ouvre en formulaire (titre, texte, image, bouton, prix), sans déplacer ni ajouter de blocs | 2 | Formulaires sur le schéma existant |
| Tableau d'admin Delphine : tous les comptes, leurs tunnels, leurs abonnements, suspension d'un compte | 2 | Liste et actions simples |
| Onboarding : compte, « pour quoi faire ? », premier tunnel en ligne sur sous-domaine, prompt tout fait avec la clé API à coller dans Claude, en moins de 15 minutes | 3 | Enchaînement d'écrans, génération du prompt, premier tunnel modèle |
| Mention « propulsé par » sur les tunnels gratuits | 1 | Bloc conditionnel |

Scale: 1 trivial CRUD · 2 form + persistence + list · 3 business logic / several states · 4 integrations, payments, roles · 5 real-time, migrations, external systems.

### Explicitly NOT replicated (graveyard)
- Tests A/B et variantes (version 2, quand les clients ont du trafic).
- Éditeur par blocs complet (glisser-déposer, ajout et réordonnancement) : jamais, sauf demande répétée de clients.
- Espace membre, cours, leçons.
- Webinaires, communauté, blog, marketplace de templates.
- Équipes, rôles multiples et sous-comptes dans un compte client.
- API publique autre que le MCP.
- Multi-devises, upsells en un clic, relances d'impayés automatiques.
- Application mobile.
- Migration automatique depuis Systeme.io (import CSV des contacts seulement).

### The angle (done differently / better)
- Le client pilote tout depuis Claude ou ChatGPT : pas d'éditeur à apprendre. Zéro LLM dans le rendu des pages (ADR 003 conservé sur ce point) : la page est de la configuration validée, servie vite.
- Tunnel complet en ligne en moins de 30 minutes, retouches de texte en moins d'une minute.
- Le client encaisse sur son propre Stripe, ses contacts lui appartiennent (export et suppression).
- Prix : gratuit pour 1 tunnel sur sous-domaine, 29 €/mois pour domaine perso et tunnels illimités, contre un abonnement tout-en-un chez la cible.
- Delphine est l'utilisatrice zéro : le produit est démontré sur son propre business avant d'être vendu.

## Constraints
- Même dépôt, même stack : Next.js sur Vercel, Supabase (projet « tunnel-maison »), Resend, PostHog, Stripe. Les pages de prod actuelles (`/`, `/ressource`, `/reserver`, `/merci`) et les tunnels existants ne cassent jamais.
- Ordre des chantiers : d'abord finir le tunnel maison pour Delphine (s04 Stripe, s05 séquences, s06 affiliation, s08 automatisations, s09 bascule), puis les stories SaaS de ce PRD.
- Sécurité : Stripe en mode test jusqu'à validation de Delphine ; clé service_role, clés Stripe et clé personnelle PostHog jamais côté client ; tests d'isolation RLS avant toute ouverture à un client.
- RGPD : les contacts d'un client lui appartiennent ; export et suppression possibles ; sous-traitants listés (Vercel, Supabase, Resend, PostHog, Stripe).
- Budget : socle à zéro jusqu'au premier client payant, puis Supabase Pro et Vercel Pro (environ 45 $ par mois, tarifs tiers de mi-2026 à confirmer).
- Marque : sous-marque Taskzen en version 1, tunnels gratuits sur `<client>.pages.taskzen.fr`. Le nom définitif et un éventuel domaine dédié sont rouverts juste avant l'ouverture aux coachs (changer ensuite casse les adresses des tunnels gratuits).
- Délai : bêta pour Delphine fin novembre 2026, premiers coachs en bêta gratuite en décembre 2026, premier abonnement à 29 € visé en janvier 2027.
- Qualité : pas de suite de tests existante ; budget 25 tests par story, `npm run build` comme garde-fou, preuves consignées dans `docs/verif/`.

## Success criteria
1. Depuis Claude, Delphine crée un tunnel complet (capture, merci, vente, paiement, livraison) sans ouvrir ni le code ni Systeme.io, en moins de 30 minutes.
2. Un coach crée son compte, obtient un tunnel en ligne sur son sous-domaine et encaisse une vente test sur son propre Stripe, en moins de 15 minutes, sans l'aide de Delphine.
3. Un client ne voit jamais les données d'un autre (preuve : tests RLS joués et consignés).
4. Le passage à 29 €/mois branche un domaine perso et débloque les tunnels illimités, abonnement géré par Stripe ; la résiliation ramène au gratuit sans perte de données.
5. Chaque client lit vues, inscrits, conversion et ventes de ses tunnels dans son tableau de bord ; Delphine voit tous les comptes et leurs abonnements.
6. Une retouche de texte ou de prix se fait dans le formulaire par bloc et est en ligne en moins d'une minute.
7. Critère final : 3 coachs utilisent leur tunnel en bêta, dont 1 qui paie.

## Décisions prises pendant le cadrage (13/10/2026)
- Premier client : Delphine (utilisatrice zéro), puis coachs et consultants, infopreneurs plus tard.
- Voie 2 : tunnels en base de données dès la version 1, Delphine comme compte numéro 1 ; un tableau de bord par client et un tableau d'admin.
- A/B tests en version 2.
- Retouches : formulaire par bloc (niveau 2), pas d'éditeur complet.
- Offre : gratuit 1 tunnel sur sous-domaine avec « propulsé par », 29 €/mois domaine perso et tunnels illimités ; Stripe Connect pour les clients.
- Nom : sous-marque Taskzen en version 1, question rouverte avant l'ouverture aux coachs.
