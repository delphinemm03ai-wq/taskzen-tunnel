---
validated: yes
---
# Plan : Story s03-optin

Branch: `feature/s03-optin`
Research: `docs/research/s03-optin.md` : à lire d'abord, ce plan ne le répète pas.

## Target story
Bloc opt-in configurable dans le moteur : soumission valide = contact upserté + tag + email de confirmation (défini par la config du tunnel) + redirection étape suivante ; invalide = erreur visible sans persistance ; honeypot = silence sans persistance ; rate-limit ; idempotent ; prouvé en vrai avec l'adresse réelle de Delphine.

## Tasks (ordered)
1. [x] `types/funnel.ts` : type `OptinBlock` (type:"optin", labelEmail, labelPrenom?, prenomRequis?: boolean, boutonTexte, tag, etapeSuivante, email: {objet, titre, texte, boutonTexte?}). `types/funnel.typetest.ts` : +2 cas @ts-expect-error (optin sans tag, email sans objet).
2. [x] `lib/schemas.ts` : exporter `emailField` si besoin, ajouter `funnelOptinSchema` (email, firstName optionnel par défaut, funnel, step, website honeypot optional) sans toucher optinSchema.
3. [x] `lib/resend.ts` : export `sendFunnelConfirmationEmail({to, firstName, subject, title, text, buttonLabel, buttonUrl})` : gabarit fixe aux couleurs du thème (reprendre la structure de resourceEmailHtml), aucune injection de HTML libre.
4. [x] `app/api/optin/route.ts` : rate-limit (5/min par IP, clé optin:), zod, résolution du tunnel/étape via getFunnel (400 si inconnu ou si l'étape n'a pas de bloc optin), honeypot rempli = 200 neutre sans persistance ni email, sinon upsertContact + ensureTags([tag]) + tagContact puis email dans after() (non bloquant, échec loggé), réponse success avec l'URL de l'étape suivante.
5. [x] `components/funnel/blocks/OptinBlock.tsx` ("use client") : états idle/envoi/erreur, bouton désactivé pendant l'envoi, honeypot caché (autocomplete off, aria-hidden, tabIndex -1), styles du thème (classes existantes), erreurs en toutes lettres sous le champ, router.push vers /t/<funnel>/<etapeSuivante> au succès. `BlockRenderer.tsx` : case "optin".
6. [x] `funnels/demo.ts` : bloc optin sur l'étape decouverte (tag demo-optin, étape suivante diagnostic, email de confirmation complet en français).
7. [x] Vérifications hors ligne : `npm run build` (SSG /t/demo inchangées + route /api/optin) ; curl le serveur local : POST invalide 400 avec message français, honeypot 200 sans ligne en base, rate-limit 429 à la 6e requête ; diff vide sur les chemins protégés.
8. [x] Preuve réelle de bout en bout (UNE fois) : POST valide avec delphinemm03.ai@gmail.com (adresse réelle, sans alias) : contact créé dans tunnel-maison avec le tag demo-optin (relire par listContacts), email de confirmation réellement parti (réponse Resend 200, id noté). Puis NETTOYER : supprimer ce contact de test et son tag via SQL de gestion (nettoyage seulement), le dire dans le record. Delphine vérifie la réception dans sa boîte (geste humain listé).
9. [x] Verification record docs/verif/s03-optin.md complet (commandes, exit codes, id d'envoi Resend masqué au besoin), plan coché.

## Run interdicts
- Diff vide sur : `config.ts`, `app/page.tsx`, `app/ressource/`, `app/reserver/`, `app/merci/`, `middleware.ts`, `app/api/lead/`, `app/api/funnel/`, `app/api/cron/`, `lib/airtable.ts`, `app/t/` (la route générique ne change pas), `app/admin/`, `components/admin/`. Dans lib/resend.ts et lib/schemas.ts : AJOUTS seulement, aucune ligne existante modifiée (export d'emailField toléré).
- Aucune dépendance npm. Aucun push. Pas de cadratin. Textes français, tutoiement.
- Envoi d'email réel : UNIQUEMENT vers delphinemm03.ai@gmail.com, UNE seule fois, à la tâche 8. Tout autre destinataire est interdit, y compris en test.
- Les clés (.env.local) sont fournies par l'orchestrateur : l'implémenteur ne tire ni n'affiche aucune clé.

## The point everything turns on
Le honeypot et la validation DOIVENT court-circuiter toute persistance et tout envoi : l'ordre dans la route est rate-limit, zod, honeypot, puis seulement Supabase et after(email). Les trois endroits où ça peut se tromper :
1. L'email parti avant l'échec de persistance (ou l'inverse) : l'envoi vit dans after() APRÈS l'upsert réussi, comme api/lead.
2. Un honeypot qui renvoie une erreur (apprend aux robots) ou qui persiste quand même : 200 neutre, zéro écriture, vérifié par le compte en base avant/après.
3. La redirection codée en dur au lieu de venir de la config (etapeSuivante inexistante = casse au build via le typetest ou au moins 400 à la route).

## Files touched
- Nouveaux : app/api/optin/route.ts, components/funnel/blocks/OptinBlock.tsx, docs/verif/s03-optin.md.
- Modifiés (ajouts seulement) : types/funnel.ts, types/funnel.typetest.ts, lib/schemas.ts, lib/resend.ts, components/funnel/blocks/BlockRenderer.tsx, funnels/demo.ts.

## Test strategy
Pas de runner (Test: absent). Filet : typage (build + 2 nouveaux cas typetest) ; curls déterministes contre le serveur local (400/429/200 neutre) avec comptes en base avant/après lus par lib/supabase.ts ; UNE preuve réelle (tâche 8) pour l'invariant que rien de local ne peut prouver : l'email part vraiment et le contact existe vraiment. Budget : 0 test runtime commité sur 25.

## Definition of Done
- 5 critères de la story prouvés (record) ; build vert ; diff vide sur les interdits ; contact de test nettoyé, base revenue à son état d'avant ; email réel reçu par Delphine (à confirmer par elle, listé comme geste humain) ; commits conventionnels, aucun push.
