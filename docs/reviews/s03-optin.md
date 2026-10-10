# Review : Story s03-optin

> Revue en contexte frais (agent reviewer, 10/10/2026). Diff jugé : `git diff main...feature/s03-optin` (HEAD 9b76e28).

Review status: complete

## Plan compliance
- [x] Le code fait ce que le plan spécifie, rien de plus. Les 9 tâches présentes dans le diff : type OptinBlock + 2 cas typetest, funnelOptinSchema, sendFunnelConfirmationEmail, route /api/optin, composant OptinBlock + case BlockRenderer, bloc optin sur demo/decouverte, record complet.
- [x] Interdits respectés, chacun vérifié : diff vide sur tous les chemins protégés ; lib/resend.ts et lib/schemas.ts en ajouts seulement (zéro ligne supprimée ou modifiée) ; aucune dépendance npm ; zéro cadratin dans les lignes ajoutées ; aucune valeur de clé dans le diff.
- Écarts déclarés, jugés acceptables : extension mécanique de l'union dans types/funnel.ts ; emailField réutilisé via z.pipe ; prenomRequis vérifié en route ; cas 400 supplémentaires défensifs ; commentaire "9 types de blocs" périmé (finding minor).

## Anti-hallucination
- [x] Aucune référence inventée : chaque import ouvert et vérifié (api-response, rate-limit, supabase, resend, funnels/index, after de next/server, config.brand).
- [x] Point de bascule vérifié dans le code : ordre rate-limit, parse, zod, résolution config, honeypot (200 neutre, return avant toute écriture), prenomRequis, upsert, tags, puis email dans after() seulement après l'upsert réussi. Redirection lue dans la config, jamais du client ; funnel/step via useParams.
- [x] Honeypot : chemin de code vérifié + record cohérent (7 requêtes, comptes base avant/après 0/0/0, aucun envoi).

## Rules compliance
- [x] Conventions respectées (français tutoyé, commits conventionnels, aucun push).
- [x] Aucun ADR contredit : 002, 003 (email = gabarit fixe, textes de config échappés par escapeHtml, pas de HTML libre), 006.
- [x] Design system : OptinBlock reprend le motif d'OptinForm (thème, .btn-primary, .error-in, label au-dessus, honeypot hors écran). "use client" uniquement sur Countdown et OptinBlock.

## Tests
- [x] Record vérifié : Tree 01cee92 correspond à HEAD hors docs (exit 0). Build final exit 0 (route /api/optin, pages /t/demo toujours SSG), premier essai exit 1 honnêtement consigné (directive @ts-expect-error mal placée : preuve que les directives sont consommées). Preuves locales (400 x4, honeypot neutre, 429 à la 6e, idempotence 2 POST = 1 contact) et reprise de la tâche 8 (envoi réel accepté après correction DKIM, contact relu puis nettoyé, base à 0) : cohérentes et horodatées.
- [x] Budget : 0 test runtime commité, 2 cas typetest, sous 25.
- [x] Morsure prouvée : case "optin" retiré de BlockRenderer = 1 erreur rouge ; email rendu optional dans le schéma = 2 erreurs rouges ; arbre restauré propre après chaque mutation. La mutation "honeypot après l'upsert" n'a pas été rejouée en live : couverte par la lecture du code (return avant upsertContact) et par le record (7 honeypots, 0 écriture).

## Regressions
- [x] api/lead, OptinForm, lib/airtable intacts ; optinSchema non touché ; garde never prouvée ; pages /t/demo toujours SSG et rendues (record, Chrome headless).

## Findings
- minor : funnels/demo.ts:4 : le commentaire d'en-tête dit "les 9 types de blocs" alors que l'union en compte 10. Une ligne de doc à corriger au prochain passage.
- minor : app/api/optin/route.ts : le honeypot est évalué après la résolution du tunnel : un robot avec tunnel invalide reçoit 400 au lieu du 200 neutre. Rien d'exploitable, rien de persisté.
- minor : app/api/optin/route.ts : deux soumissions valides côté serveur = deux emails ; le "un seul email au double clic" repose sur le bouton désactivé (prouvé au navigateur). Limite consignée au record, conforme à la research.

## Not verified
- La réception de l'email chez Delphine n'avait pas de témoin au moment de la revue : CONFIRMÉE par Delphine elle-même juste après (« reçu », 10/10 ~22h05, journal du jour). Le rendu HTML du gabarit dans sa boîte reste à regarder à l'occasion.
- Le bouton de l'email de test pointe vers localhost (NEXT_PUBLIC_SITE_URL absent du .env.local de test) : artefact d'environnement, la prod a la variable côté Vercel.
- Le contact n'a pas été regardé dans l'écran /admin pendant un opt-in de test (relu par listContacts) : à l'occasion.
- Rate-limit en mémoire par instance : limite préexistante de lib/rate-limit.ts, non changée ici.

## Verdict
Les 5 critères de la story sont prouvés (bloc configurable, contact + tag + email accepté + redirection, erreurs sans persistance, honeypot silencieux, rate-limit, test réel de bout en bout nettoyé). Le filet de types mord. Trois findings, tous mineurs. Gestes humains restants non bloquants, et la réception de l'email est confirmée par Delphine.

Max severity: minor
Ship allowed: yes
