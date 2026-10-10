# Review : Story s02-contacts-supabase

> Fresh-context review (agent reviewer, 10/10/2026). Diff jugé : `git diff main...feature/s02-contacts-supabase` (HEAD d43fcfa).

Review status: complete

## Plan compliance
- [x] Le code fait ce que le plan spécifie, rien de plus. Les 9 tâches du plan sont toutes dans le diff : migration 001 (citext, UNIQUE email, UNIQUE name, PK composite, RLS sans policy), types/contacts.ts, lib/supabase.ts (motif lib/airtable.ts, fetch pur), route admin, script d'import Node pur, ContactsPanel monté dans /admin, .env.example (noms seuls). FunnelDashboard modifié a minima (children + contexte du secret).
- [x] Interdits respectés, chacun vérifié : diff vide sur tous les chemins protégés ; package.json et package-lock.json inchangés (zéro dépendance) ; NEXT_PUBLIC_SUPABASE absent du code ; aucune valeur de clé dans le diff (les 4 valeurs de .env.local grep-ées littéralement : absentes, y compris l'URL du projet) ; .env.local non suivi par git.

## Anti-hallucination
- [x] Aucune référence inventée : success/errors dans lib/api-response.ts, types contacts, AdminSecretContext, process.loadEnvFile (Node 25, prouvé en vrai au temps 2).
- [x] Le point central (idempotence portée par la base) est exact dans le diff : on_conflict=email + merge-duplicates (upsertContact), on_conflict=name + merge-duplicates (ensureTags), on_conflict composite + ignore-duplicates (tagContact) ; la migration déclare les contraintes correspondantes. Le commentaire SQL explique le choix citext (ON CONFLICT exige la contrainte).
- [x] La normalisation (trim + lower) existe réellement aux deux endroits : normalizeEmail() dans lib/supabase.ts, et dans collect() du script d'import. L'effet de bord de casse de merge-duplicates est neutralisé par construction.
- [x] Route admin : secret lu dans x-admin-secret avec repli ?secret=, comparé avant tout parsing ; ADMIN_SECRET absent = 401 ; le secret n'apparaît dans aucune réponse ni dans le CSV. Garde anti-injection Excel présente (apostrophe sur = + - @, échappements). Comparaison non timing-safe : explicitement acceptée par le plan.

## Rules compliance
- [x] Conventions du dépôt respectées (français, tutoiement, lib/ un fichier un job, réponses homogènes, idempotence par contraintes).
- [x] ADR 006 respecté (tables tunnel_* dans public, RLS sans policy), raffine l'ADR 002 et le dit.
- [x] Design : ContactsPanel réutilise les variables et classes du thème ; le rouge d'erreur est celui que FunnelDashboard utilisait déjà. Pas de dérive.

## Tests
- [x] Record vérifié et COURANT : git diff --quiet 8dab18e...HEAD hors docs = exit 0. Pris du record : build exit 0, dry-run verbatim, toutes les preuves du temps 2 sur base vivante (upsert double = 1 ligne même id, re-import = 0 créé / 2 mis à jour, 401/200/CSV BOM, RLS anon aveugle, POST anon 42501).
- [x] État vivant re-dérivé par le relecteur, en lecture seule : 3 tables tunnel_* présentes, 0 ligne (nettoyage confirmé), RLS true et 0 policy, email citext, anon = []. Tout concorde, ref ueoibcaihsklbdnjzdij confirmé. Aucune écriture, aucune clé affichée.
- [x] Morsure prouvée par neutralisation (baseline dry-run reproduite à l'identique) : M1 suppression du toLowerCase() : écart détectable (3 contacts, 5 tags) ; M2 séparateur forcé à "," : "Colonne email introuvable", exit 2 ; M3 c.first_name devenu c.firstName : tsc passe de 0 à 1 erreur. Trois mutations, trois rouges, arbre restauré propre.
- [x] Budget : 0 test runtime commité sur 25, conforme au plan. Test, Typecheck, E2E : commandes absentes, non lancées, correctement déclaré.

## Critères d'acceptation, un par un
1. Tables + migration versionnée : prouvé (diff + record + re-vérification live).
2. Email unique, réinsertion = mise à jour : prouvé (record détail 2 + contrainte confirmée live).
3. Import CSV rejouable sans doublon : prouvé (deux passages, comptes identiques ; mutations rouges sur le filet local).
4. Export CSV avec tags : prouvé (BOM octet par octet, en-tête, contenu, Content-Disposition).
5. /admin protégée, liste + recherche : volet sécurité et données prouvé côté route (200/401, casse, vide) ; le rendu visuel du panneau reste un geste humain (voir Not verified).

## Regressions
- [x] /api/funnel/stats intact et re-prouvé 401 sans secret. FunnelDashboard : children optionnel, provider rendu après soumission du secret : aucun changement pour l'existant.

## Findings
- minor : docs (ADR 006, plan, research) : 9 tirets cadratins dans les lignes ajoutées, contraires à la convention du projet. CORRIGÉ au ship (remplacés par deux-points ou trait d'union, commit de ship).
- minor : app/api/admin/contacts/route.ts (listAll) : l'export suppose des pages de 1000 lignes (EXPORT_CHUNK) ; si le réglage max-rows du projet descendait sous 1000, l'export s'arrêterait à la première page partielle. Théorique (défaut Supabase = 1000), à durcir si s09 touche à la config.
- minor : app/api/admin/contacts/route.ts (cell) : la garde formule ne couvre pas la tabulation initiale ni un = au milieu d'une cellule jointe. Risque résiduel faible (données saisies par Delphine).

## Not verified
- Le panneau Contacts n'a jamais été rendu dans un navigateur (aucun outil navigateur dans les deux sessions). Geste humain : ouvrir /admin, saisir le secret, vérifier tableau, recherche, pagination (jamais exercée au-delà de 2 contacts), bouton Exporter CSV, texte d'état vide.
- L'export CSV jamais ouvert dans Excel ; la fixture n'a pas d'accent.
- Les colonnes exactes de l'export Systeme.io réel restent supposées (mapping --email-col/--prenom-col/--tags-col disponible), à verrouiller en s09.

## Verdict
Trois minors, zéro major, zéro critical. Le point central de la story (idempotence portée par la base) est prouvé trois fois : dans le diff, dans le record sur base vivante, et par les lectures live et mutations du relecteur. Le seul manque reconnu, le contrôle visuel du panneau, est un geste humain listé, pas un bloqueur.

Max severity: minor
Ship allowed: yes
