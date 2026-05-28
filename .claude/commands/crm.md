---
description: Gère la base Airtable des leads. Consulte, filtre et met à jour les contacts capturés par le tunnel.
---
# CRM — Gestion des leads (Airtable)

Consulter et gérer les leads via le MCP Airtable.

## Prérequis
Lire `memory/funnel/config.md` pour Base ID + Table Leads ID.
Si non configuré → proposer `/onboarding`.

## Capacités

- **Voir les leads** : `mcp__airtable__list_records` sur la table Leads (paginer si besoin).
- **Filtrer** : par `Statut` (optin / resource_viewed / booking / client / perdu), par date, par source.
- **Stats rapides** : compter par statut, taux d'inscrits → bookings.
- **Mettre à jour** : changer un statut, ajouter une note (`mcp__airtable__update_records`).

## Workflow type

1. Demander ce que l'utilisateur veut (voir, filtrer, stats, MAJ).
2. Exécuter via le MCP Airtable.
3. Afficher un tableau lisible (prénom, email, statut, date).
4. Proposer une action de suite (ex : marquer un lead "client", exporter).

## Règles
- Max 10 records par appel PATCH Airtable.
- Confirmer avant une mise à jour en masse (> 5 leads).
- Ne jamais exposer la clé API.
