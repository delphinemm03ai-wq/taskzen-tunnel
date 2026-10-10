# Verification : Story s01-moteur-pages

> Écrit par l'implémenteur comme dernière action avant le commit de la story. Les commandes
> sont celles de `AGENTS.local.md`, citées telles quelles ; une commande non définie dans ce fichier n'existe pas ici.

Tree: 7bdf4666e21d750fb838ef3ddf670ca4955d9e9b

| Run | Command | Result | When |
| --- | --- | --- | --- |
| Test (full suite) | (aucune) | n'existe pas (`Test` non défini) : aucun runner dans le projet, 0 test runtime (plan) | (aucune) |
| Typecheck | (aucune) | n'existe pas en commande autonome (`Typecheck` non défini) ; couvert par le build ci-dessous (« Linting and checking validity of types ») | (aucune) |
| E2E | (aucune) | n'existe pas (`E2E` non défini) | (aucune) |
| Build | `npm run build` | exit 0 · 13/13 pages générées · `● /t/[funnel]/[step]` (SSG) avec `/t/demo/decouverte` et `/t/demo/diagnostic` | 2026-10-10T16:28:35Z |

Le build a tourné après la dernière modification de code. Entre le build et ce record, seules
les cases du plan (`docs/plans/s01-moteur-pages.md`) ont changé, sous `docs/`.

## Vérifications du plan (tâches 8 et 9)

| Vérification | Commande | Résultat |
| --- | --- | --- |
| Lint (tâche 8) | `npm run lint` | exit 1 : `next lint` ouvre l'assistant interactif de configuration ESLint ; ESLint n'est ni installé ni configuré dans le projet. Le configurer ajouterait des dépendances (interdit en s01). Non exécuté de fait. |
| Diff vide, pages prod (tâche 8) | `git diff --stat main -- app/page.tsx app/ressource app/reserver app/merci config.ts middleware.ts` | exit 0, sortie vide |
| Diff vide, autres interdits | `git diff --stat main -- app/api lib package.json package-lock.json next.config.ts` puis `git status --porcelain` sur les mêmes chemins | exit 0, sorties vides (aucun fichier suivi modifié, aucun fichier non suivi ajouté) |
| Pas de tiret cadratin dans le code de la story | `grep -rnP "\x{2014}" app/t funnels components/funnel/blocks types/funnel.ts types/funnel.typetest.ts` | exit 1 (aucune occurrence) |
| Serveur de dev (tâche 9) | `npx next dev -p 3107` (équivalent de `npm run dev` sur un port libre) | Ready in 4.5s, aucune ligne error/warn/hydrat dans le log |
| HTTP | `curl -s -o <fichier> -w "%{http_code}" http://localhost:3107<route>` | `/t/demo/decouverte` 200 · `/t/demo/diagnostic` 200 · `/t/inexistant/x` 404 · `/t/demo/inexistante` 404 · `/` 200 · `/reserver` 200 · `/ressource` 307 · `/merci` 307 (les deux 307 = garde cookies existante de middleware.ts, comportement prod inchangé) ; curl exit 0 partout |
| DOM | `grep` sur le HTML servi | découverte : `data-block` hero, richText, bullets, video, testimonial, cta ; diagnostic : hero, image, faq, countdown, cta. Les 9 types présents. `main.paper-grain`, `.eyebrow`, un seul `<h1>`, `.btn-primary`, `.surface-card`, `.container-tight`, `<iframe>`, `<details>`, `role="timer"`, `<strong>10 heures par semaine</strong>`, `<blockquote>`, `/_next/image` présents là où attendus. `<title>` et `<meta description>` issus de la config. |
| Contrôle visuel | Edge headless `--screenshot` sur les 2 pages (16:30-16:31Z) | Thème rendu : fond papier et sections bg-soft alternées, titres Fraunces, eyebrow argile, puces mousse, carte témoignage, bouton primaire argile arrondi, photo en carte surface, FAQ en cartes repliées, compte à rebours mono hydraté côté client (82 j 06 h 28 min 51 s avant 2027 au moment de la capture, valeur cohérente). |

Le serveur de dev a été arrêté après les contrôles (taskkill PID 17484, exit 0).

## Not proven here
- Lint : non exécutable dans ce projet (voir ci-dessus) ; à trancher hors story (installer ESLint = dépendance nouvelle).
- Les cas `@ts-expect-error` de `types/funnel.typetest.ts` sont type-checkés par le build (fichier inclus par `tsconfig.json` via `**/*.ts`) ; aucune mutation n'a été faite pour le démontrer (doctrine : la mutation appartient à la revue).
- Hydratation du compte à rebours : vérifiée par la capture (valeurs réelles affichées) et par l'absence d'erreur dans le log serveur ; la console navigateur n'a pas été lue.
- Pré-existant, hors périmètre : le bandeau `components/common/DemoBanner` (mode démo local, layout racine) contient un tiret cadratin visible sur toutes les pages, y compris /t/... ; non modifié ici.

Verification status: complete
