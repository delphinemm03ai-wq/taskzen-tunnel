# ADR 003 — Pages par configuration typée, rendu déterministe sans LLM

- Status: accepted
- Date: 2026-10-10
- Scope: framing

## Context
Exigence fondatrice de Delphine (10/10) : construire et modifier les pages vite et sans consommer de jetons. Systeme.io imposait un éditeur visuel bloquant et une API qui refuse le HTML libre.

## Decision
Une page = une suite de blocs typés dans un fichier TS versionné (`funnels/<slug>.ts`). Une bibliothèque de composants React rend chaque bloc. Le rendu est une fonction pure config vers HTML, généré statiquement au build. Aucun LLM dans le chemin de rendu ; le LLM n'intervient que pour éditer la config, comme un humain le ferait.

## Considered options
- Génération de pages par LLM à la demande — rejetée : lente, coûteuse en jetons, non reproductible ; c'est précisément ce que le produit doit éliminer.
- Éditeur visuel maison — rejeté : des semaines de travail pour recréer le défaut de Systeme.io ; Delphine opère en langage naturel via Claude, pas à la souris.
- CMS headless (Contentful, Sanity) — rejeté : service externe de plus, données hors de git, abonnement.

## Consequences
- Plus facile : zéro jeton au rendu, build en secondes, historique git, retour arrière trivial, pas de code fantôme possible.
- Plus dur : chaque nouveau type de bloc demande un composant codé une fois (puis réutilisé partout).
- À surveiller : garder le type FunnelConfig strict pour que toute config invalide casse au build, pas en prod.
