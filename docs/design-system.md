# Design System — Tunnel maison Taskzen

Capture du système existant (direction "chaleureux coach", signature du reçu du temps perdu), déjà en prod. Source de vérité des tokens : `app/globals.css` (`:root`), miroir partiel dans `config.ts > brand`. Thème clair uniquement (pas de mode sombre dans ce produit).

## Tokens
- Colors :
  - `--color-primary` #a8431f (argile brûlée, actions principales), `--color-primary-dark` #7c3015 (survol, emphase), `--color-primary-light` #e8b48f (décoratif uniquement, jamais du texte sur fond clair)
  - `--color-accent` #3f5d3a (mousse profonde, accents et validations)
  - Fonds : `--color-bg` #f3ecdd (papier chaud), `--color-bg-soft` #eae0c9, `--color-surface` #fffcf5 (cartes)
  - Texte : `--color-ink` #241c16 (encre brune), `--color-ink-soft` #6b5b48 (secondaire), `--color-line` #dccfae (filets, jamais du texte)
- Typography : `--font-display` Fraunces (titres h1-h4, 600, interlettrage -0.02em), `--font-body` Work Sans (corps, line-height 1.6), `--font-mono` Space Mono (le reçu, les chiffres).
- Spacing / radius : `--radius` 14px partout ; conteneurs `.container-tight` (max 64rem) ; ombres `--shadow-card` (cartes) et `--shadow-lift` (éléments mis en avant).

## Contrastes (mesurés le 10/10/2026, WCAG)
Quinze paires texte/surface mesurées, toutes au-dessus de 4.5:1 (AA) : ink sur bg 14.25, ink sur surface 16.36, ink-soft sur bg 5.55, primary sur bg 5.12, accent sur bg 6.29, blanc sur primary 5.88, blanc sur primary-dark 8.95, blanc sur accent 7.22, primary-light sur primary-dark 4.96. Aucune correction de token nécessaire. `primary-light` sur fonds clairs est décoratif, pas du texte.

## Available components
| Component | Usage |
|---|---|
| `.btn-primary` | Bouton d'action principal (fond primary, texte surface) |
| `.btn-outline` | Bouton secondaire (contour, texte ink) |
| `.surface-card` | Carte sur fond surface, ombre card, radius 14 |
| `.eyebrow` | Sur-titre court au-dessus d'un headline |
| `.receipt`, `.receipt-row`, `.receipt-total`, `.receipt-heading` | Le reçu signature (mono, calcul du temps perdu) |
| `.container-tight`, `.funnel-grid` | Composition de page |
| `.reveal`, `.pop-in`, `.error-in`, `.blob-drift`, `.paper-grain`, `.link-underline` | Animations et textures existantes |
| `components/funnel/OptinForm` | Formulaire d'opt-in (champs, honeypot, états) |
| `components/funnel/CalEmbed` | Calendrier Cal.com intégré |
| `components/funnel/ResourceViewer` | Vidéo ou PDF de la ressource |
| `components/funnel/BookingCta` | Appel à la réservation |
| `components/funnel/PageView` | Événement de vue PostHog |
| `components/admin/FunnelDashboard` | Tableau de bord admin (secret, périodes, tableaux) |
| `components/common/DemoBanner` | Bandeau de démo |

## UI patterns
- Forms : libellé au-dessus, bordure `--color-line`, focus primary, erreur inline animée (`.error-in`), honeypot caché. Jamais d'alerte navigateur.
- States : chargement sobre (texte), vide dit pourquoi, erreur en toutes lettres près du champ, succès par redirection vers l'étape suivante (jamais un cul-de-sac).
- Feedback : inline uniquement, pas de toasts. Les montants et compteurs en `--font-mono`.
- Pages de tunnel : hero (eyebrow, h1 Fraunces, sous-texte ink-soft), sections aérées sur bg et bg-soft alternés, cartes surface, un seul CTA primaire par écran.

## Do / Don't
- Fais : tout nouveau bloc du moteur consomme ces tokens et classes ; une page reste lisible sans JavaScript ; un seul CTA primaire par étape.
- Fais : l'admin reste utilitaire (tableaux, mono pour les chiffres), même thème.
- Ne fais pas : de nouvelle couleur hors tokens, de texte en `primary-light` ou `line` sur fond clair, de tiret cadratin dans les textes.
- Ne fais pas : de mode sombre, d'animation bloquante, de dépendance UI externe (pas de librairie de composants en plus).
