# Plan lot 1 : format de page, serveur MCP, exigences X1 à X7

Source unique : cahier des charges (02-sas). Le worktree part du modèle initial (pas de Supabase, Stripe ni moteur de pages) : le lot 1 est donc autonome, avec des ports (interfaces) pour ce qui viendra plus tard.

## Étapes
1. Format de page (`lib/page-format/`) : schéma zod versionné, 15 types d'éléments (F03), opérations de modification (`applyChanges`), rendu serveur pur (`renderPageHtml`), sans IA.
2. Stockage (`lib/store/`) : interface `Store` + implémentation mémoire. Le stockage durable (Supabase) est un port à brancher, rien n'est écrit sur une base distante.
3. Outils (`lib/mcp/tools.ts`) : create_page, update_page, get_page, publish_page, delete_page, create_funnel, schedule_email_sequence, send_email_to_list. Réponses courtes (X4), modifications par différence (X5), confirmations (X6).
4. Serveur MCP (`lib/mcp/server.ts`, `app/api/mcp/route.ts`) : JSON-RPC 2.0 (initialize, tools/list, tools/call), clé en en-tête, limite 60 appels/min/clé, journal des appels avec taille de la demande (X2).
5. Pages publiques (`app/p/[funnel]/[step]`) rendues par le serveur à partir de la description. Interface web `app/api/pages/[id]` qui utilise les mêmes opérations (X7).
6. Tests (vitest) : un fichier par exigence X.

## Hors lot
Éditeur visuel (interface), Stripe, envoi réel Resend, stockage durable, gestion multi-clés (F34 détaillé).
