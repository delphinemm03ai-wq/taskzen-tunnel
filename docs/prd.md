# PRD — Tunnel maison Taskzen

## Target SaaS
Systeme.io (systeme.io) : plateforme tout-en-un de tunnels de vente, emails, contacts, paiements et affiliation.

## Kill mode
Remplacement interne. Un seul utilisateur : Delphine. On arrête de payer, les données vivent chez elle, l'outil colle à sa façon de travailler (configuration éditée par Claude, versionnée dans git). Pas de comptes multiples, pas de facturation d'utilisateurs, pas de support produit. Le vendre un jour en service "fait pour toi" reste possible mais n'est pas le cahier des charges.

## Why kill it
- Delphine n'a pas la main sur ses propres pages : éditeur visuel bloqué du 8 au 12/09/2026 (code injecté invisible, support obligatoire), API qui refuse HTML et CSS libres (balise style supprimée et affichée en texte brut en prod), bloc périmé injecté depuis un endroit que l'interface ne montre pas (13/09).
- Lenteur et friction : chaque retouche passe par un éditeur lourd, ou par des allers-retours d'agent IA qui consomment du temps et des jetons.
- Abonnement mensuel payé pour un outil dont elle n'utilise qu'une fraction.
- Ce qu'on n'utilise pas : webinaires, communauté, marketplace, blog, tests A/B, équipe multi-utilisateurs.

## Problem
Delphine (Taskzen, EI, solo) vend des produits numériques (Pass VIP du sommet, e-book, offres Taskzen) via des tunnels : capture, vente, paiement, emails, affiliation. Systeme.io le fait mais lui retire le contrôle, casse ses designs et la ralentit. Maintenant que le sommet est terminé (09/10), c'est la fenêtre pour migrer, décidée le 13/09/2026.

## Target users
- Delphine, seule utilisatrice et administratrice. À l'aise pour dire quoi changer en langage naturel, pas pour coder.
- Claude (l'AIOS) est l'opérateur : il édite la configuration, lance les builds, lit les stats. Les visiteurs et acheteurs sont les utilisateurs finaux des pages.

## Perimeter — the 20% that matters

### Replicated (core loop)
| Feature | Complexity (1-5) | Why this score |
|---|---|---|
| Moteur de pages par configuration : gabarits de sections (hero, texte, vidéo, FAQ, témoignages, compte à rebours, CTA), une page = un fichier de config, rendu statique Next.js. Zéro LLM au rendu. | 3 | Bibliothèque de blocs et thème, mais rendu déterministe sans états complexes |
| Tunnels multi-étapes : plusieurs tunnels en parallèle, étapes ordonnées, URLs propres sur domaine perso | 2 | Structure + routage, persistance simple |
| Formulaire opt-in : contact créé, tag posé, email de confirmation envoyé, anti-spam | 3 | Validation, déduplication, déclenchement d'email |
| Contacts + tags : liste, recherche, fiche, import/export CSV (migration depuis Systeme.io) | 2 | CRUD + import |
| Emails : transactionnels et séquences programmées (J+0, J+2...), déclenchés par tag ou formulaire, via Resend | 4 | Planification différée, états d'envoi, désinscription |
| Automatisations simples : règle "événement → action" (formulaire soumis → tag ; tag posé → séquence) | 3 | Logique métier, plusieurs états |
| Paiement Stripe : page de commande, checkout, webhook de confirmation, enregistrement de la vente, email de livraison | 4 | Intégration paiement, webhooks, idempotence |
| Affiliation : liens trackés (?aff=), attribution par cookie, commission 30 % calculée sur le HT, tableau des commissions dues | 4 | Attribution, fenêtre de cookie, calculs |
| Stats : vues et conversions par étape, ventes, via PostHog déjà branché | 2 | Requêtes sur l'existant |

### Explicitly NOT replicated (graveyard)
- Espace membre / cours / leçons (replays VIP) : reporté en v2, reste sur Systeme.io pendant la transition.
- Éditeur visuel à la souris : remplacé par gabarits + configuration éditée par Claude.
- Webinaires et webinaires evergreen.
- Communauté intégrée.
- Tests A/B.
- Blog intégré.
- Marketplace (templates, place de marché d'affiliation publique).
- Multi-utilisateurs, rôles, équipes, sous-comptes.
- API publique.
- Upsells en un clic, bumps de commande complexes (un produit avec option simple suffit en v1).
- Multi-devises et dunning avancé (relance d'impayés).

### The angle (done differently / better)
- Pages 100 % déterministes : gabarits + configuration, aucun LLM dans le chemin de rendu. Construire ou modifier une page coûte zéro jeton et prend des secondes.
- Tout versionné dans git : historique, retour arrière, aucun code fantôme possible. L'inverse exact du blocage Systeme.io.
- Les données chez Delphine : contacts, tags et ventes dans son projet Supabase.
- Opérable en langage naturel : Delphine dit quoi changer, Claude édite la config et déploie. Pas d'éditeur qui bloque.
- Vitesse : pages statiques servies par Vercel sur son domaine.
- Coût de fonctionnement quasi nul : Vercel + Supabase + Resend (niveaux gratuits) contre un abonnement Systeme.io mensuel.

## Constraints
- Techniques : repartir du repo taskzen-tunnel (Next.js, en prod sur Vercel depuis le 12/07, remote GitHub "delphine", jamais pousser sur "origin"). Resend opérationnel (domaine taskzen.fr vérifié). Stripe : compte actif (encaissements du Pass VIP). PostHog branché. Cal.com branché. Base : Supabase (projet existant), Airtable actuel à migrer.
- Données : export CSV des contacts Systeme.io à importer ; les tunnels du sommet restent sur Systeme.io jusqu'à la bascule.
- Temps : bêta utilisable fin novembre 2026 (plan du 02/10), premier tunnel réel migré avant résiliation.
- Qualité : pas de suite de tests existante ; budget 25 tests par story, build npm run build comme garde-fou.

## Success criteria
Parité sur le périmètre :
1. Créer un tunnel complet (capture → merci → vente → paiement → livraison) sans toucher Systeme.io.
2. Chaque opt-in crée un contact tagué et déclenche l'email de confirmation.
3. Une séquence d'emails part toute seule après un tag, avec désinscription fonctionnelle.
4. Une vente Stripe est enregistrée, l'email de livraison part, la vente apparaît dans les stats.
5. Une vente via lien affilié est attribuée et la commission de 30 % sur le HT apparaît dans le tableau des commissions.
6. Vues et conversions par étape lisibles sans ouvrir PostHog.

L'angle, mesurable :
7. Reconstruire la page d'inscription du sommet à partir d'un fichier de config : build sans LLM, zéro jeton au rendu.
8. Une modification de texte demandée à Claude est en prod en moins de 5 minutes.
9. Critère final : l'abonnement Systeme.io est résiliable (tout l'usage courant couvert, espace membre excepté).
