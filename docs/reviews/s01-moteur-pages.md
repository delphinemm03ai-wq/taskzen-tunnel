# Review — Story s01-moteur-pages

> Fresh-context review (agent reviewer, 10/10/2026). Chaque problème classé : critical / major / minor.
> Diff jugé : `git diff main...feature/s01-moteur-pages` (18 fichiers, 881 insertions, tous nouveaux)

Review status: complete

## Record de vérification (mode `record`)
- Tree du record : `7bdf466` ; vérifié `git diff --quiet 7bdf466 HEAD -- . ':(exclude)docs'` : exit 0, le code jugé est exactement celui que l'implémenteur a vérifié. Worktree propre.
- Pris du record comme preuve : `npm run build` exit 0 (13/13 pages, `/t/demo/decouverte` et `/t/demo/diagnostic` en SSG), diffs vides sur les interdits, curl 200/404/307 sur dev, captures Edge des 2 pages, DOM des 9 blocs. Timestamps (16:28-16:31Z) postérieurs à la dernière édition de code, cohérents.
- Re-vérifié par le relecteur : diff vide sur `config.ts`, `app/page.tsx`, `app/ressource/`, `app/reserver/`, `app/merci/`, `middleware.ts`, `app/api/`, `lib/`, `package.json`, `package-lock.json`, `next.config.ts` : confirmé vide. Baseline `npx tsc --noEmit` : exit 0.
- Test, Typecheck, E2E : non définis dans AGENTS.local.md, donc "not run (does not exist)", conformément au record.
- Lint : `npm run lint` exit 1 car ESLint n'est pas installé (next lint ouvre l'assistant interactif) ; le configurer ajouterait des dépendances, interdit par le plan. Déviation acceptable telle qu'enregistrée : honnête, motivée, et le type check du build couvre l'essentiel. À trancher hors story (finding minor).

## Plan compliance
- [x] Le code fait ce que le plan spécifie, rien de plus : les 9 tâches présentes (types, typetest, demo + registre, 8 composants serveur, Countdown client, BlockRenderer, route, vérifs). Aucun fichier hors de la liste "Files touched" (plus les 3 docs attendus).
- [x] Interdits respectés, chacun vérifié : diff vide sur les chemins interdits (re-vérifié) ; aucune dépendance npm ; pas de PostHog ni PageView dans le diff ; aucun cadratin dans le code de la story ; textes visibles en français, tutoiement partout ; aucun push (commits locaux).

## Anti-hallucination
- [x] Aucune référence inventée : `lucide-react` ^0.460.0 présent dans package.json ; `public/images/delphine-founder.png` existe ; alias `@/*` dans tsconfig ; tous les tokens CSS utilisés et toutes les classes vérifiés dans app/globals.css ; Next 15 params en Promise correctement awaité.
- [x] Pas de logique plausible-mais-fausse : Countdown sans écart d'hydratation (serveur et premier rendu client affichent "--", l'heure n'est lue qu'au montage, interval nettoyé) ; RichText distingue lien interne/externe sur le type contraint ; ImageBlock next/image pour /public et img pour URL externe comme décidé au plan.
- [x] Le code fait ce qu'il affirme.

## Points spécifiques du run
1. **Filet "config invalide casse le build" : mordu, prouvé par 3 mutations rouges sur 4** (chacune restaurée, `git diff --exit-code` propre à la fin) :
   - M1 `titre` rendu optionnel sur HeroBlock : 1 erreur TS2578. Restauré.
   - M2 case "cta" retiré du switch de BlockRenderer : 1 erreur TS2322 (garde d'exhaustivité). Restauré.
   - M3 `satisfies FunnelConfig` remplacé par `as const` dans demo.ts : exit 0, PAS rouge seul, car le filet est doublé par `funnels/index.ts` (`allFunnels: readonly FunnelConfig[]`). Avec `as const` seul, un champ en trop passerait : c'est le `satisfies` qui le bloque, prouvé par le cas `champLibre` du typetest.
   - M4 `type: "bullets"` changé en `"carrousel"` dans la config demo : 2 erreurs TS2322, l'invariant central tient bout en bout. Restauré.
2. **`dynamicParams = false`** : exporté ligne 9 de app/t/[funnel]/[step]/page.tsx, plus notFound() défensif. 404 vérifiés dans le record.
3. **"use client"** : un seul fichier le porte, Countdown.tsx. Conforme.
4. **Interdits** : tous vérifiés.
5. **Lint** : déviation acceptable (voir plus haut).

## Rules compliance
- [x] Conventions du dépôt : commits conventionnels, commentaires en français, TypeScript strict, moteur sous /t/, zéro LLM au rendu.
- [x] Aucun ADR contredit ; ADR 003 prouvé par mutation.
- [x] Design system respecté : uniquement tokens et classes de globals.css, un seul h1 (Hero), un seul CTA primaire par étape, sections alternées bg/bg-soft, chiffres du compte à rebours en font-mono, FAQ en details natifs, aucune nouvelle couleur ni dépendance UI.

## Tests
- [x] Record vérifié : current (tree = HEAD hors docs), pris comme preuve.
- [x] Filet structurel (0 test runtime sur budget 25, justifié au plan) ; les 7 cas @ts-expect-error pinnent les critères.
- [x] Morsure prouvée par neutralisation : 4 mutations, 3 rouges, M3 verte expliquée par le double filet du registre ; tout restauré.
- [x] Rien à supprimer : aucun test préexistant dans le projet.

## Regressions
- [x] Aucun fichier existant modifié ; routes prod intactes ; middleware ne touche pas /t ; record confirme /, /reserver 200 et /ressource, /merci 307 (garde cookies préexistante, inchangée).

## Findings
- minor : funnels/demo.ts:49 : l'embedUrl vidéo est un placeholder (youtube.com/embed/dQw4w9WgXcQ) sous un titre "La Méthode IA". Cette page sera publique en prod au prochain push de main. Remplacer par une vraie vidéo, ou le signaler explicitement au ship.
- minor : projet (hors diff) : `npm run lint` est inexécutable (ESLint non installé) alors que le plan et la DoD le citaient : à trancher hors story (story outillage, ou retirer la commande des plans).
- minor : types/funnel.ts:16 : le type `IsoDateTime` rejette "demain" mais accepte "2027-99-99Tn'importe" : filet partiel, suffisant pour s01, à durcir si la config vient un jour d'ailleurs que de ce dépôt.
- note (pré-existant, hors périmètre) : components/common/DemoBanner contient un cadratin visible sur toutes les pages y compris /t/... ; à nettoyer dans un cycle dédié.

## Not verified
- Pages non rendues par le relecteur lui-même (pas de navigateur) : preuve = record (captures Edge, greps DOM, curl) dont le tree correspond au code jugé. Geste humain conseillé : ouvrir /t/demo/decouverte et /t/demo/diagnostic, vérifier console navigateur, rendu mobile, chargement réel de l'iframe YouTube.
- Build de prod non relancé en revue : Build stage = ship-if-route et une route a bougé, donc le ship DOIT relancer `npm run build`.
- Compte à rebours non observé à travers plusieurs fuseaux ni au passage de la date cible.
- ESLint jamais exécuté sur ce code (inexécutable dans le projet).

## Verdict
Le filet central de la story (config invalide = build cassé) est réel et mord, prouvé par mutation ; les interdits sont tous respectés ; aucune référence inventée. Trois minors, dont le placeholder vidéo à régler au ship.

Max severity: minor
Ship allowed: yes
