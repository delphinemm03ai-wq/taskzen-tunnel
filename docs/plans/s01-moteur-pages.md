---
validated: yes
---
# Plan — Story s01-moteur-pages

Branch: `feature/s01-moteur-pages`
Research: `docs/research/s01-moteur-pages.md` — read it first; this plan does not repeat it.

## Target story
Un tunnel défini dans `funnels/<slug>.ts` s'affiche sur `/t/<slug>/<etape>` : blocs typés (hero, texte riche, image, vidéo embed, liste à puces, FAQ, témoignage, compte à rebours, CTA bouton) rendus par le thème existant, zéro LLM au rendu, config invalide = échec de build, les 4 pages prod intactes, `npm run build` passe.

## Tasks (ordered)
1. [x] `types/funnel.ts` : union discriminée `Block` (9 types, champ `type`), `FunnelStep` (slug, titre, blocs, metaDescription optionnelle), `FunnelConfig` (slug, nom, étapes ordonnées). Types stricts, aucun champ libre.
2. [x] `types/funnel.typetest.ts` : cas de compilation avec `@ts-expect-error` (bloc au type inconnu, champ manquant, étape sans slug) : prouve au build que la config invalide casse (ADR 003). Next build type-checke, aucun runner requis.
3. [x] `funnels/demo.ts` (`satisfies FunnelConfig`, jamais `as const` seul) : tunnel de démonstration en 2 étapes contenant les 9 blocs au moins une fois, textes français de vrai contenu Taskzen (pas de lorem ipsum). `funnels/index.ts` : registre `getFunnel(slug)` + `allFunnels` pour generateStaticParams.
4. [x] `components/funnel/blocks/` : 8 composants serveur (Hero, RichText, ImageBlock, VideoEmbed, Bullets, Faq, Testimonial, CtaButton), composés exclusivement des classes et tokens existants (design-system.md). Image : `next/image` pour les chemins `/public`, `img` simple pour une URL externe (pas de remotePatterns à configurer).
5. [x] `components/funnel/blocks/Countdown.tsx` : seul composant client ("use client"), cible une date ISO, affichage mono, rien d'autre en client.
6. [x] `components/funnel/blocks/BlockRenderer.tsx` : switch exhaustif sur l'union avec garde `never` (un type de bloc oublié casse à la compilation).
7. [x] `app/t/[funnel]/[step]/page.tsx` : `generateStaticParams` depuis le registre, `dynamicParams = false` (slug inconnu = 404 au build, pas au runtime), `generateMetadata` (titre + description), rendu de la liste de blocs dans `main.paper-grain`.
8. [x] Vérification : `npm run lint`, `npm run build` (les pages /t/demo/... apparaissent comme statiques dans la sortie du build), `git diff --stat main -- app/page.tsx app/ressource app/reserver app/merci config.ts middleware.ts` vide.
9. [x] Contrôle visuel sur `npm run dev` : les 9 blocs rendus avec le thème (couleurs, Fraunces sur titres, boutons), capture rapide documentée. Écrire le verification record (template verification-record).

## Run interdicts
- Diff vide obligatoire sur : `config.ts`, `app/page.tsx`, `app/ressource/`, `app/reserver/`, `app/merci/`, `middleware.ts`, `app/api/`, `lib/` (le moteur n'y touche pas en s01).
- Aucune dépendance npm ajoutée, aucun runner de test installé (Test: — dans AGENTS.local.md).
- Aucun `git push` : le ship décidera ; Vercel déploie main à chaque push.
- Pas de tiret cadratin dans les textes rendus ; textes visibles en français, tutoiement.
- Pas de PageView ni d'événement PostHog en s01 (c'est s07).
- Jamais `git stash`, jamais de changement de branche dans ce worktree.

## The point everything turns on
Le typage qui fait du build le filet : `satisfies FunnelConfig` sur chaque fichier de tunnel + union discriminée + garde `never` dans BlockRenderer. Les trois endroits où ça peut se tromper :
1. `as const` sans `satisfies` (la config invalide passe silencieusement) : comparer funnels/demo.ts au critère "config invalide casse au build" via types/funnel.typetest.ts.
2. `dynamicParams` laissé à sa valeur par défaut (true) : un slug inconnu rendrait au runtime au lieu de 404 ; vérifier la constante exportée dans page.tsx.
3. Countdown rendu côté serveur (erreur d'hydratation ou gel de l'horloge) : vérifier la directive "use client" et que lui seul l'a.

## Files touched
- Nouveaux : `types/funnel.ts`, `types/funnel.typetest.ts`, `funnels/demo.ts`, `funnels/index.ts`, `components/funnel/blocks/{Hero,RichText,ImageBlock,VideoEmbed,Bullets,Faq,Testimonial,CtaButton,Countdown,BlockRenderer}.tsx`, `app/t/[funnel]/[step]/page.tsx`.
- Modifiés : aucun fichier existant.

## Test strategy
Pas de runner dans le projet (Test: —, décision ks-setup) : le filet de cette story est structurel, conforme à testing-doctrine (tester l'invariant à la couche la plus proche).
- Invariant central "une config invalide casse au build" : porté par le type check du build Next + les cas `@ts-expect-error` de types/funnel.typetest.ts (0 test runtime, coût nul, échoue exactement quand la règle est supprimée).
- Invariant "slug inconnu = 404" : porté par `dynamicParams = false`, vérifié par la sortie du build (routes statiques listées) et un appel curl sur le serveur dev (404 attendu sur /t/inexistant/x).
- Rendu des 9 blocs : vérification visuelle documentée (tâche 9), pas de test de composant (rendre une liste n'est pas une règle, doctrine).
- Budget : 0 test runtime sur 25. Le harnais de test arrivera avec s02+ si une story le justifie.

## Definition of Done
- Les 9 critères d'acceptation de docs/stories.md cochés, preuves dans le verification record.
- `npm run lint` et `npm run build` passent ; pages /t/demo statiques dans la sortie de build.
- Diff vide sur les fichiers interdits (commande de la tâche 8).
- Textes conformes (français, pas de cadratin).
- Commits conventionnels sur `feature/s01-moteur-pages`, aucun push.
