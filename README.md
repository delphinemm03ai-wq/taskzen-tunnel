# Claude Tunnel OS

**Crée, optimise et déploie ton tunnel de vente — entièrement piloté par Claude Code.**

Un template prêt à l'emploi pour construire un tunnel de conversion en 4 étapes :

```
Landing (opt-in)  →  Ressource (VSL / vidéo / PDF)  →  Réserver un appel (Cal.com)  →  Merci
```

Tu décris ton business à Claude Code, il génère le copywriting, le design, configure tes outils (Airtable, PostHog, Resend, Cal.com) et déploie sur Vercel. Sans toucher au code si tu ne veux pas.

---

## Démarrage en 3 étapes

### 1. Récupère le projet

```bash
git clone <url-de-ce-repo> mon-tunnel
cd mon-tunnel
npm install
```

> Sur GitHub, tu peux aussi cliquer **"Use this template"** pour créer ton propre repo, puis le cloner.

### 2. Ouvre dans Claude Code et lance l'onboarding

```bash
claude
```

Puis tape :

```
/onboarding
```

Claude va, dans l'ordre :
1. **T'interviewer** sur ton business (ce que tu vends, à qui, ta ressource, ton appel).
2. **Te demander tes clés API une par une** (avec les liens) et les ranger lui-même dans `.env`.
3. **Créer ta base de leads** sur Airtable automatiquement.
4. **Générer ton tunnel** (design + copywriting) adapté à ton business.

Tu n'as aucun fichier à éditer à la main.

### 3. Vois ton tunnel et mets-le en ligne

```
/preview   → voir ton tunnel en local
/deploy    → le publier sur Vercel
```

---

## Le mode démo

Tu peux lancer le tunnel **sans aucune clé** pour voir à quoi il ressemble :

```bash
npm run dev
```

Le tunnel s'affiche entièrement (avec un contenu d'exemple). Un bandeau "Mode démo" rappelle ce qu'il reste à brancher. Lance `/onboarding` quand tu es prêt à le rendre fonctionnel.

---

## Les commandes Claude Code

| Commande | Rôle |
|----------|------|
| `/onboarding` | Setup complet (interview + outils + génération) |
| `/funnel` | Génère / régénère les 4 pages |
| `/copy` | Écrit le copywriting (frameworks de conversion) |
| `/design` | Crée une identité visuelle unique |
| `/resource` | Configure ta ressource (vidéo, PDF, VSL) |
| `/crm` | Gère tes leads dans Airtable |
| `/analytics` | Taux de conversion par étape (PostHog) |
| `/optimize` | Améliore l'étape qui convertit le moins |
| `/deploy` | Mise en ligne sur Vercel + GitHub |
| `/preview` | Lance le serveur local |
| `/brain-status` | État du projet |
| `/memory-save` | Sauvegarde les apprentissages |

Tu peux aussi parler en langage naturel : *"écris ma landing"*, *"change les couleurs"*, *"déploie"* — Claude active la bonne commande.

---

## Ce dont tu as besoin

| Outil | Pour | Obligatoire ? |
|-------|------|---------------|
| [Airtable](https://airtable.com) | Stocker les leads | Recommandé |
| [PostHog](https://posthog.com) | Mesurer les conversions | Recommandé |
| [Resend](https://resend.com) | Envoyer la ressource par email | Recommandé |
| [Cal.com](https://cal.com) | Réservation d'appel | Recommandé |
| [Vercel](https://vercel.com) + [GitHub](https://github.com) | Déploiement | Pour mettre en ligne |

Tout est optionnel pour démarrer (mode démo). Configure au fur et à mesure.

---

## Stack technique

Next.js (App Router) · React 19 · TypeScript · Tailwind CSS v4 · PostHog · Airtable · Resend · Cal.com.

Tout le contenu (textes, couleurs, liens) vit dans **`config.ts`** — la source unique. Les pages lisent ce fichier ; tu n'as jamais besoin de modifier le JSX.

---

## Structure

```
app/            Les pages du tunnel (/, /ressource, /reserver, /merci) + /admin + API
components/     Composants (funnel, admin, common, ui)
lib/            Airtable, Resend, PostHog, validation, events
config.ts       Configuration centrale (textes, couleurs, liens)
memory/         Le "cerveau" : ton business, ton offre, tes apprentissages
.claude/        Les commandes Claude Code
```

---

Construit pour être piloté par Claude Code. Lance `/onboarding` et c'est parti.
