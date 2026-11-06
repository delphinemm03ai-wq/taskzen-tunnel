# Design System — Tunnel maison Taskzen

Charte Taskzen (relevé de taskzen.fr, `context/charte-taskzen.md` de l'AIOS), décidée par Delphine le 06/11/2026 à la place de l'ancien thème argile et papier. Source de vérité des tokens : `app/globals.css` (`:root`). `config.ts > brand` ne sert qu'aux e-mails. Thème sombre uniquement.

## Tokens
- Colors :
  - `--color-primary` #b58bf9 (lavande), `--color-primary-dark` #c4a4fe (texte d'emphase sur fond sombre, jamais un fond sous du texte blanc), `--color-primary-light` #bf83fe (décoratif)
  - `--color-accent` #bf83fe (accents et validations), `--color-error` #ff9db0
  - `--gradient-primary` #8a55e0 vers #6a3fc0 (boutons, seul fond admis sous du texte blanc)
  - Fonds : `--color-bg` #090b1e (indigo nuit), `--color-bg-soft` (sections alternées), `--color-surface` #1b1c36 (cartes et champs)
  - Texte : `--color-ink` #f3f0f9, `--color-ink-soft` #a4a2b7 (secondaire), `--color-line` #313047 (filets, jamais du texte)
- Typography : `--font-display` Fraunces (titres h1-h4, 600, interlettrage -0.02em), `--font-body` Inter (corps, line-height 1.6), `--font-mono` Space Mono (le reçu, les chiffres).
- Spacing / radius : `--radius` 1rem ; conteneurs `.container-tight` (max 64rem) ; ombres `--shadow-card` (cartes) et `--shadow-lift` (éléments mis en avant).

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
| `components/admin/AdminShell` | Admin : secret, onglets Tunnels / Contacts / Ventes, période |
| `components/admin/FunnelsPanel` | Cartes par tunnel (pages, vues, inscrits, taux) |
| `components/common/DemoBanner` | Bandeau de démo |

## UI patterns
- Forms : libellé au-dessus, bordure `--color-line`, focus primary, erreur inline animée (`.error-in`), honeypot caché. Jamais d'alerte navigateur.
- States : chargement sobre (texte), vide dit pourquoi, erreur en toutes lettres près du champ, succès par redirection vers l'étape suivante (jamais un cul-de-sac).
- Feedback : inline uniquement, pas de toasts. Les montants et compteurs en `--font-mono`.
- Pages de tunnel : hero (eyebrow, h1 Fraunces, sous-texte ink-soft), sections aérées sur bg et bg-soft alternés, cartes surface, un seul CTA primaire par écran.

## Do / Don't
- Fais : tout nouveau bloc du moteur consomme ces tokens et classes ; une page reste lisible sans JavaScript ; un seul CTA primaire par étape.
- Fais : l'admin reste utilitaire (tableaux, mono pour les chiffres), même thème.
- Ne fais pas : de nouvelle couleur hors tokens, de texte blanc sur `primary` ou `accent`, de texte en `line`, de tiret cadratin dans les textes.
- Ne fais pas : de mode clair, d'animation bloquante, de dépendance UI externe (pas de librairie de composants en plus).
