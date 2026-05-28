---
description: Orchestrateur qui génère ou régénère les 4 pages du tunnel. Applique le copywriting et le design dans config.ts.
---
# Funnel — Génération du tunnel

Génère ou régénère les 4 pages (Landing, Ressource, Réserver, Merci) en cohérence.

## Prérequis
Lire : `memory/identity/business.md`, `memory/identity/offer.md`, `memory/funnel/strategy.md`, `memory/funnel/copy.md`, `memory/identity/brand.md`.
Si `business.md` contient `[À CONFIGURER]` → proposer `/onboarding` d'abord.

## Workflow

1. **Copy** : s'il manque du copywriting validé (`copy.md` vide), lancer `/copy` d'abord.
2. **Design** : si la marque est encore au défaut et l'utilisateur veut son identité, proposer `/design`.
3. **Appliquer dans `config.ts`** : écrire toutes les sections (`business`, `brand`, `landing`, `resource`, `booking`, `thankyou`, `legal`) à partir de la mémoire.
   - C'est la SEULE source : ne pas mettre de texte en dur dans les pages.
4. **Vérifier** : les 4 pages lisent bien `config.ts` (elles le font déjà — ne pas réécrire le JSX sauf besoin réel de structure).
5. **Preview** : lancer `/preview` et inviter l'utilisateur à vérifier dans le navigateur.

## Règles
- Toujours confirmer avant d'écraser un `config.ts` déjà personnalisé.
- Synchroniser `config.ts` ET `memory/funnel/copy.md`.
- Ne pas casser le mode démo (laisser les fallbacks).
- Après génération, proposer `/deploy`.
