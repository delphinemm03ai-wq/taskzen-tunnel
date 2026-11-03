# Hypothèses du lot 1

Chaque point est un choix le plus simple possible, faute de précision dans le cahier des charges. À corriger sur un mot de Delphine.

## Base de code
1. (Mis à jour) La branche est rebasée sur le main du dépôt (AGENTS.md, AGENTS.local.md, Supabase, moteur de pages sous `/t/`). Les routes de production existantes ne sont pas touchées. Le serveur d'outils a son propre rendu sous `/p/<tunnel>/<étape>`, distinct du moteur `/t/` à config TypeScript : les deux coexistent, leur fusion n'est pas décidée.
2. Stockage : interface `Store` (`lib/store/store.ts`) avec deux implémentations. Mémoire (tests et développement). Supabase (`lib/store/supabase-store.ts`), en fetch REST pur comme `lib/supabase.ts`, sans SDK. Le choix se fait dans `lib/store/index.ts` : Supabase si `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont définies, sauf si `TUNNEL_STORE=memory` ; sinon mémoire (avertissement en production). Tant que la migration 004 n'est pas lancée, ne définis pas ces variables côté serveur du serveur d'outils, ou les appels échoueront.
3. Envoi d'email : une interface `Mailer`. Sans service connecté, l'envoi répond `email_not_configured`. Aucun faux envoi. Les tests utilisent un double.

## Format de page
4. Le format est un JSON versionné (`format: 1`) : titre, adresse (slug), réglages de partage, liste de blocs. Les 15 éléments du F03 existent. Le bloc de code libre (F04) n'est pas fait.
5. Chaque bloc a un identifiant stable. S'il est omis à la création, le serveur en génère un.
6. Aucun HTML en entrée : tout texte est échappé au rendu. Les liens acceptés sont https, un chemin interne, une ancre ou mailto. Les couleurs sont au format #rrggbb.
7. Réglages d'élément (F03) : alignement, couleur, espacement (aucun, s, m, l, xl).
8. Minuteur : date fixe uniquement (la date limite par visiteur du F06 n'est pas faite). Pop-up : ouverture par bouton, fermeture par croix, Échap ou clic extérieur (dialog natif). Le « ne pas rouvrir pendant 24 h » n'est pas fait.
9. Formulaire d'inscription : envoie vers la route existante `/api/lead` du projet (email, prénom). L'étiquette du formulaire est stockée dans la page mais pas encore appliquée aux contacts.
10. Bouton de paiement : un vrai bouton qui appelle la route Stripe existante (`POST /api/stripe/checkout` avec `{ funnel, step }`) puis redirige vers l'adresse Stripe. Cette route relit le produit et le prix dans la config TypeScript (`funnels/`), pas dans la page : un tunnel créé par l'IA ne peut donc pas encore encaisser (la route répond « Produit inconnu » tant que le tunnel et l'étape n'existent pas dans `funnels/`). Le `price_cents` d'une page n'est qu'affiché. Brancher des produits dynamiques demande de modifier la route Stripe (lot 2, à décider). La coquille `/api/checkout` (501) est supprimée.
11. Polices Fraunces et Inter chargées depuis Google Fonts, comme dans les maquettes.

## Serveur d'outils (MCP)
12. Protocole : JSON-RPC 2.0 sur HTTP POST (`/api/mcp`), méthodes initialize, ping, tools/list, tools/call. Pas de flux (SSE).
13. Clés : variable d'environnement `TUNNEL_MCP_KEYS` au format `id:secret:rw` séparées par des virgules (`ro` pour lecture seule). Plusieurs clés révocables avec expiration (F34) : non fait.
14. Limite de 60 appels par minute et par clé (valeur proposée), en mémoire par instance.
15. Journal des appels : outil, clé, taille de la demande et de la réponse en octets, succès. Table `tunnel_mcp_calls`. Une panne du journal n'interrompt pas l'outil (erreur loguée).
16. Liens entre étapes d'un tunnel : `@next` (étape suivante) et `@step:slug`, résolus par `create_funnel`. Ailleurs ils sont refusés.
17. Création de tunnel : tout ou rien. Tout est validé avant la première écriture. Un tunnel peut embarquer sa séquence d'emails (`email_sequence`).
18. Séquence d'emails : `delay_hours` est le délai après l'email précédent (le premier : après le déclencheur). Sortie de séquence sur achat ou désinscription enregistrée. Le moteur d'envoi réel de la séquence n'est pas fait (lot 2) : programmer = enregistrer.
19. Actions sensibles : suppression de page (`confirm: true`), publication d'un changement de prix déjà en ligne (`confirm: true`), envoi réel à une liste (`confirm: {test_reviewed, recipients_consent}`, les deux cases obligatoires, choix 2 du fichier de lancement). Refus = réponse normale (pas une erreur) avec `refused`, `action`, `reason`, `how_to_confirm`.
20. Modification : opérations `set_title`, `set_share`, `set_props`, `add_block`, `remove_block`, `move_block`. Contrôle de version optionnel (`expected_version`). `get_page` renvoie la page entière (c'est une lecture voulue ; X4 vise la création et la modification).
21. Publication : l'adresse publique est `/p/<tunnel>/<étape>`. Les visiteurs voient la copie publiée, pas le brouillon.

## Éditeur visuel (X7)
22. L'éditeur visuel (F02) n'est pas dans le lot 1. X7 est prouvé au niveau du format et des opérations : l'interface web `/api/pages/[id]` (GET, PATCH) utilise les mêmes opérations et le même schéma que l'outil MCP. L'ouverture à la souris dans un vrai éditeur reste à prouver avec l'interface.

## Seuils (X2 à X5)
23. Aucun seuil chiffré n'est imposé. Les tailles sont mesurées et affichées par les tests (voir le rapport).

## Stockage Supabase (migration 004)
24. Migration `supabase/migrations/004_tunnel_pages_mcp.sql` : tables `tunnel_pages`, `tunnel_funnels`, `tunnel_email_sequences`, `tunnel_mcp_calls`, RLS activée, aucune policy (service_role seul). Identifiants en texte préfixé (`pg_`, `fn_`, `seq_`), générés par le serveur. Non appliquée : à lancer par Delphine.
25. Conflit de version : `UPDATE ... WHERE id = X AND version = N` (verrou optimiste). Zéro ligne modifiée = conflit, remonté en `version_conflict`. La création échoue si l'identifiant existe (409).
26. Tunnel tout ou rien : un seul appel `rpc/tunnel_create_funnel`, fonction SQL qui écrit tunnel, pages et séquence dans une transaction. Adresse déjà prise = conflit `slug_taken`, rien n'est écrit. La fonction n'est exécutable que par service_role.
27. Contacts : tables existantes (migration 001). Consentement = contact non désinscrit (`unsubscribed_at` nul), faute de colonne de consentement. À remplacer quand F23 (import avec accord) existera.
28. Les séquences sont stockées mais jamais exécutées (pas de moteur d'envoi au lot 1).
