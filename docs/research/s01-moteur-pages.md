# Research — Story s01-moteur-pages

## The five structuring facts
1. Aucune route `/t` n'existe (app/ : page.tsx, ressource, reserver, merci, admin, api) : le moteur s'installe sur un terrain vierge, zéro collision.
2. Le middleware ne touche que `/ressource` et `/merci` (middleware.ts:15, :22) : les pages `/t/...` ne seront pas gatées par les cookies du tunnel historique.
3. Les composants funnel existants sont des composants à props fixes liés à `config.ts` (OptinForm() et ResourceViewer() sans props, components/funnel/*.tsx) : ils ne sont PAS réutilisables tels quels comme blocs paramétrés ; la bibliothèque de blocs est à écrire, seuls le style et les classes CSS se réutilisent.
4. Tout le vocabulaire visuel est en place dans app/globals.css (286 lignes) : .btn-primary, .btn-outline, .surface-card, .eyebrow, .container-tight, .funnel-grid, .paper-grain, .reveal, tokens :root ; le rendu des blocs est surtout de la composition de classes existantes.
5. `config.ts` se termine par `as const` + export default (config.ts:92) : le motif "config typée, source unique" existe déjà ; `funnels/*.ts` le généralise avec un type explicite `FunnelConfig` (le `as const` seul ne suffit pas pour valider une config au build, il faut un type contraint).

## Target story
Définir un tunnel dans `funnels/<slug>.ts` (métadonnées + étapes ordonnées + blocs typés), rendu sur `/t/<slug>/<etape>`. Blocs : hero, texte riche, image, vidéo embed, liste à puces, FAQ, témoignage, compte à rebours, CTA bouton. Critères : rendu sans erreur, blocs stylés par le thème, modification de config = page changée après build sans LLM, les 4 pages prod intactes, `npm run build` passe.

## Current state of the code
- `app/page.tsx`, `app/ressource`, `app/reserver`, `app/merci` : pages codées à la main qui lisent `config.ts`. Intactes, hors périmètre.
- `components/funnel/` : BookingCta({label}), CalEmbed(), OptinForm(), PageView({event}), ResourceViewer() : composants mono-usage branchés sur config.ts et lib/events.
- `config.ts` : source unique du tunnel historique (business, brand, landing, resource, booking, thankyou, legal).
- `app/globals.css` : tokens et classes utilitaires (fait n°4). Tailwind 4 via PostCSS, détection de contenu automatique (aucune liste `content` à maintenir).
- `next.config.ts` : minimal (reactStrictMode). Pas d'i18n, pas de rewrites : rien ne gêne une route `/t`.

## Anchor points
- Nouveau `types/funnel.ts` : types FunnelConfig, FunnelStep, Block (union discriminée par `type`).
- Nouveau `funnels/index.ts` : registre `getFunnel(slug)` + liste pour generateStaticParams.
- Nouveau `app/t/[funnel]/[step]/page.tsx` : generateStaticParams sur le registre, notFound() si slug inconnu, rend la liste de blocs.
- Nouveau `components/funnel/blocks/` : un composant par type de bloc + un `BlockRenderer` (switch sur l'union).
- Un tunnel de démonstration `funnels/demo.ts` sert de preuve pour les critères (tous les blocs présents).

## Verified APIs / functions
- `PageView({ event: FunnelEvent })` components/funnel/PageView.tsx:8 : réutilisable si on ajoute un événement générique ; sinon hors périmètre s01 (les stats sont s07). Décision au plan.
- Classes CSS vérifiées dans app/globals.css : btn-primary, btn-outline, surface-card, eyebrow, container-tight, funnel-grid, paper-grain, reveal/reveal-N, pop-in, error-in, blob-drift, receipt*.
- Next 15 App Router : `generateStaticParams` + `dynamicParams = false` donnent la génération statique et le 404 des slugs inconnus.

## Traps & constraints
- Aucun test existant dans le repo (aucun runner installé) : la vérification = build + rendu des routes de démo. Budget 25 tests sans harnais : installer un runner n'est PAS dans cette story (AGENTS.local.md : Test = —) ; la validation passe par le typage strict (config invalide casse au build, ADR 003) et le build.
- Le compte à rebours est le seul bloc qui exige du JavaScript client ("use client") : les autres blocs restent des composants serveur. Garder la séparation pour ne pas transformer toute page en bundle client.
- `as const` sans annotation de type accepte n'importe quelle structure : `funnels/*.ts` doit déclarer `satisfies FunnelConfig` (ou un type explicite) pour que les critères "config invalide casse au build" tiennent.
- Vercel déploie main à chaque push : le merge local ne pousse pas, mais le ship final mettra ces routes en prod. Risque faible (routes additives), à mentionner au ship.
- Images : next/image exige les domaines distants dans next.config si URL externe ; pour la v1 le bloc image accepte les chemins `/public` locaux et les URLs externes via `<img>` simple si hors domaine configuré. À trancher au plan.

## Open questions
- Le bloc image : next/image partout (et configurer remotePatterns) ou `<img>` pour les URLs externes ? Proposition : next/image pour /public, `<img>` sinon, simple et sans config.
- PageView générique dès s01 (événement `t_<funnel>_<step>_view`) ou rien avant s07 ? Proposition : rien en s01, critère s07 explicite déjà l'ajout.

## Real complexity
Score stories : 3. Verdict après lecture : 3, confirmé. Terrain vierge (fait n°1), vocabulaire visuel prêt (fait n°4) ; le travail réel est le type union + 9 composants de bloc + le registre + la route générique + le tunnel de démo. Une dizaine de tâches, dans la taille d'un cycle.

## Split proposal
Non nécessaire (3).
