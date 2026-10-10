# Stories Review — Tunnel maison Taskzen

Revue de docs/stories.md contre docs/prd.md par l'agent stories-reviewer (contexte frais, 10/10/2026), checklist templates/stories-review-checklist.md remplie.

## Perimeter coverage
| PRD feature (core loop) | Covered by | OK? |
|---|---|---|
| Moteur de pages par configuration (gabarits, rendu statique, zéro LLM) | s01-moteur-pages | OUI |
| Tunnels multi-étapes (parallèles, étapes ordonnées, URLs propres sur domaine perso) | s01 (structure, routes /t/<slug>/<etape>) + s09 (domaine perso) | OUI |
| Formulaire opt-in (contact, tag, email de confirmation, anti-spam) | s03-optin | OUI |
| Contacts + tags (liste, recherche, fiche, import/export CSV) | s02-contacts-supabase (+ s09 import réel) | OUI |
| Emails transactionnels et séquences programmées via Resend | s05-sequences-emails + s03/s04 (transactionnels) | OUI |
| Automatisations simples (événement vers action) | s08-automatisations | OUI |
| Paiement Stripe (checkout, webhook, vente, email de livraison) | s04-vente-stripe | OUI |
| Affiliation (lien tracké, cookie, 30 % du HT, tableau) | s06-affiliation | OUI |
| Stats (vues, conversions par étape, ventes, PostHog) | s07-stats | OUI |

- [x] Chaque feature de la table "Replicated (core loop)" est livrée par au moins une story. Les critères de succès du PRD sont traçables (le critère 7 est repris mot pour mot dans s09, le 9 par la checklist de résiliation).

## Scope
- [x] Aucune story ne réintroduit un élément du graveyard. s09 mentionne l'espace membre uniquement comme "reste à couvrir" dans la checklist de résiliation, conforme au PRD (reporté en v2). Pas d'upsell un clic, pas d'A/B, pas de multi-utilisateurs, pas d'API publique.
- [x] Aucune story ne déborde du périmètre. Les blocs "image" et "liste à puces" de s01 ajoutent un cheveu à la liste PRD mais restent dans l'esprit du moteur de blocs : pas un écart.

## Story quality
- [x] Chaque story est une tranche livrable de bout en bout. s02 pourrait ressembler à une couche technique (tables Supabase) mais livre une valeur réelle testable : import CSV, export, admin avec recherche. s08 est assumée comme refactorisation + extension et correspond à une feature explicite du PRD (automatisations), donc acceptable.
- [x] Les critères d'acceptation sont presque tous transformables en tests (deux faiblesses en Findings).
- [x] Agentic notes présentes et utiles partout : fichiers existants cités, pièges réels (routes prod à ne pas casser, clé service_role, alias +, TVA suisse, metadata Stripe pour l'attribution).
- [x] Complexité notée partout, aucun 5, les trois 4 (s04, s05, s06) énoncent chacun leur risque dans une section dédiée.

## The list as a whole
- [x] Ordre exécutable : s01 et s02 en parallèle, puis s03 (s01+s02), s04 (s01+s02), s05 (s02+s03), s06 (s04), s07 (s03+s04), s08 (s03+s04+s05), s09 en dernier. Aucun cycle, aucune référence avant.
- [x] Ids bien formés `s<number>-<slug>`, uniques, courts, stables (s01 à s09).
- [x] Pas de chevauchement réel. s02 construit le script d'import, s09 l'exécute sur l'export réel : complémentaires. s09 reconstruit la page du sommet avec le moteur de s01 : usage, pas redondance.

## Findings
- minor — s09 — dépendances ambiguës : "s03 et s05 au minimum ; idéalement s04, s06 et s07". Une story doit déclarer des dépendances fermes, sinon l'ordre n'est pas déterministe pour un agent. Trancher : soit s09 exige s04-s07, soit non.
- minor — s02 — "la page /admin protégée" : le mécanisme de protection n'est défini nulle part (aucune story ne porte l'authentification de l'admin). Préciser "protégée" (mot de passe, Vercel protection, Supabase Auth existant) pour rendre le critère testable.
- minor — s06 — "se définit dans l'admin ou en config" : un "ou" dans un critère d'acceptation laisse l'agent choisir le périmètre. Trancher avant /ks-plan.
- minor — s07 — critère "les chiffres correspondent aux données brutes (vérification documentée)" : testable mais mou ; préciser le parcours test attendu (N vues, 1 opt-in, 1 vente).
- minor — s08 — valeur utilisateur faible assumée ("refactorisation plus extension"). Conforme au PRD donc non bloquant, mais première story à sacrifier si le délai de fin novembre serre.

## Verdict
Découpage solide : périmètre couvert en totalité, graveyard étanche, les trois 4 portent leur risque, ordre exécutable. Restent des précisions de formulation, surtout les dépendances de s09 et la définition de "admin protégée".

Max severity: minor
Stories ready: yes
