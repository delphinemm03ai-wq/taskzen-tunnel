---
description: Crée une direction artistique unique pour le tunnel (couleurs, typographie, ambiance). Utilise la skill frontend-design.
---
# Design — Direction artistique

Donner au tunnel une identité visuelle distinctive, adaptée au business.

## Prérequis
Lire : `memory/identity/business.md`, `memory/identity/offer.md`, `memory/identity/brand.md`.
**Utiliser la skill `frontend-design`** pour viser une esthétique mémorable (éviter le générique "AI slop").

## Workflow

1. Demander la vibe souhaitée (ou la déduire du business) : minimal raffiné / éditorial / audacieux / tech / luxe / chaleureux / etc.
2. Choisir une direction COHÉRENTE :
   - **Palette** : une couleur dominante + 1 accent (CSS variables). Éviter le violet-sur-blanc cliché.
   - **Typographie** : une display caractérielle + une body lisible (Google Fonts via `next/font`). Éviter Inter/Roboto/Arial en display.
   - **Thème** : clair ou sombre selon la vibe.
3. Appliquer :
   - `config.ts > brand` (colorPrimary, colorAccent, colorBg, theme).
   - `app/globals.css` : variables CSS (`--color-primary`, `--color-accent`, `--color-bg`, dérivés `-dark`/`-light`, `--color-ink`, etc.) + ajuster fonts si besoin.
   - `app/layout.tsx` : importer les nouvelles fonts via `next/font/google` et mettre à jour les variables `--font-display` / `--font-body`.
4. Mettre à jour `memory/identity/brand.md`.
5. Lancer `/preview` pour vérifier dans le navigateur.

## Règles
- **Identité UNIQUE** : ne jamais reproduire le design d'un autre projet. Chaque tunnel doit se démarquer.
- Respecter `prefers-reduced-motion`.
- Garder les classes utilitaires (`.btn-primary`, `.surface-card`, `.reveal`...) cohérentes avec la nouvelle palette.
- Tester le contraste (accessibilité) et le rendu mobile.
