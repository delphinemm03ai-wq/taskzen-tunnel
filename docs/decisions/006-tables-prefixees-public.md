# ADR 006 : Tables préfixées tunnel_ dans le schéma public

- Status: accepted (raffine l'ADR 002 sur le point du schéma)
- Date: 2026-10-10
- Scope: story s02-contacts-supabase

## Context
L'ADR 002 prévoyait un schéma Postgres dédié `tunnel`. Vérifié en recherche : PostgREST (l'API REST de Supabase) n'expose que `public` et `graphql_public` par défaut ; exposer un schéma supplémentaire exige une modification de la configuration API du projet, une action de plus sur la ressource partagée, à refaire sur tout nouveau projet.

## Decision
Les tables du tunnel vivent dans `public` avec le préfixe `tunnel_` (tunnel_contacts, tunnel_tags, tunnel_contact_tags, puis tunnel_sales, tunnel_commissions, tunnel_scheduled_emails). RLS activée sur chacune, zéro policy : seule la clé service_role (serveur) y accède.

## Considered options
- Schéma dédié `tunnel` exposé dans PostgREST : rejeté : modification de config du projet en plus de la migration, invisible dans le repo, un piège de plus au prochain réveil ou à la prochaine migration de projet.
- Accès uniquement par l'API de gestion (SQL direct) sans PostgREST : rejeté : chaque lecture applicative deviendrait un appel privilégié ; PostgREST donne filtres, pagination et upsert gratuits.

## Consequences
- Plus facile : zéro config hors repo, l'API marche dès la migration appliquée ; l'isolation vis-à-vis des tables existantes est portée par le préfixe et par RLS.
- Plus dur : la frontière "ce qui appartient au tunnel" est une convention de nommage, pas un schéma : la discipline du préfixe est obligatoire pour toutes les stories suivantes.
- À surveiller : après le réveil du projet, vérifier qu'aucune table `tunnel_*` préexistante n'entre en collision.
