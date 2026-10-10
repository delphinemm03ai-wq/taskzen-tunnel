# taskzen-tunnel — settings and conventions

**This file is yours. `install.sh` never overwrites it, and `/ks-setup` is its only creator.**
`AGENTS.md` belongs to the method and is rebuilt on every update — write nothing there.

Every value below is read by the pipeline commands. One setting per line, `Name: value`, nothing
else on the line: a command reads the value as everything after the colon, trimmed. Change any of
them at any time.

**After changing anything here, rerun `install.sh`** — it reassembles `AGENTS.md` from the method's
rules plus this file, and `AGENTS.md` is what an agent loads automatically. Settings are also read
straight from here, so those take effect immediately; the conventions at the bottom only reach an
agent through `AGENTS.md`, and stay stale until you reinstall.

## Pipeline settings

```
Merge mode:        local
Target branch:     main
Plan validation:   autonomous
Ship confirmation: automatic
Story track:       auto
Flow threshold:    2
Design source:     internal
Design skill:      —
Design tool:       —
Test budget:       25
Verification mode: record
Full suite:        execute-end
E2E stage:         —
E2E scope:         nominal
E2E browsers:      —
Build stage:       ship-if-route
Issue tracker:     —
Worktree root:     .worktrees/
```

| Setting | Accepted values |
| --- | --- |
| Merge mode | `local` (squash-merged locally, no review platform) · `pr` (a pull request against the target branch) |
| Plan validation | `human` (a checkpoint blocks until you validate) · `autonomous` (the agent validates its own plan) |
| Ship confirmation | `human` (asked before any merge) · `automatic` |
| Design source | `internal` (the agent draws, using `Design skill`) · `external` (a brief goes to `Design tool`) |
| Story track | `auto` (the story's complexity picks the lane) · `full` (always the six-phase pipeline) · `flow` (always `/ks-flow`) |
| Flow threshold | complexity at or below which `auto` picks `/ks-flow` |
| Test budget | tests per story — a plan wanting more says why |
| Verification mode | `record` (the implementer records what it ran; the reviewer checks the record instead of re-running) · `rerun` (the reviewer runs everything itself) |
| Full suite | when the whole unit suite runs: `execute-end` · `ship` · `both` |
| E2E stage | when the end-to-end suite runs: `execute-end` · `ship` · `ci` · `—` |
| E2E scope | how far the end-to-end suite goes; `nominal` is one happy path |
| E2E browsers | browsers for the story cycle, e.g. `chromium`; `—` means the project's own default. Ship always runs them all |
| Build stage | when the production build runs: `ship-if-route` (only when a route or manifest moved) · `ship` · `review` · `ci` · `—` |

## Project commands

```
Package manager:   npm
Test:              —
Typecheck:         —
E2E:               —
Build:             npm run build
```

A command left at `—` is one the agents cannot run: they say so rather than guess one.

## Project conventions

- Next.js 15 App Router, TypeScript strict, alias de chemin `@/`. Tailwind 4 + variables CSS de `app/globals.css` (theme argile / mousse / papier).
- Une page de tunnel = de la donnee : config TS typee dans `funnels/<slug>.ts`, rendue par la bibliotheque de blocs de `components/funnel/`. Aucun LLM dans le chemin de rendu (ADR 003). Toute config invalide doit casser au build.
- `lib/` : un fichier = un job. Validation zod (`lib/schemas.ts`), reponses API via `lib/api-response.ts`, cadence via `lib/rate-limit.ts`.
- Donnees : Supabase schema `tunnel`, migrations SQL versionnees dans `supabase/migrations/`, acces serveur uniquement (`lib/supabase.ts`). La cle service_role et la cle secrete Stripe ne touchent jamais le client.
- Idempotence partout ou argent ou email circule : contraintes d'unicite en base (email, stripe_event_id, envoi par contact/sequence/index).
- Les routes prod actuelles (`/`, `/ressource`, `/reserver`, `/merci`, `api/lead`) ne se cassent jamais ; le moteur vit sous `/t/`.
- Textes visibles en francais, tutoiement, jamais de tiret cadratin (U+2014). Commentaires de code en francais, dans le style du depot.
- Git : commits conventionnels (feat/fix/docs/chore), remote `delphine` uniquement, jamais `origin` (template public). Stripe reste en mode test tant que Delphine n'a pas valide le passage en prod.
