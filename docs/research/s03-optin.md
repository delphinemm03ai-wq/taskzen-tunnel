# Research : Story s03-optin

## The five structuring facts
1. La route existante `app/api/lead/route.ts` est le modèle exact du flux demandé (rate-limit, zod, envoi email non bloquant via `after()`, upsert par email) mais elle écrit dans Airtable et reste INTACTE (interdit du plan s02 reconduit) : s03 crée `app/api/optin` à côté, qui écrit dans Supabase via lib/supabase.ts (s02).
2. `lib/schemas.ts` porte déjà `emailField` (format strict, blocklist jetables, lowercase) et `optinSchema` : réutiliser `emailField`, créer un `funnelOptinSchema` (prénom OPTIONNEL selon la config du bloc, champs funnel/step, honeypot) sans toucher à `optinSchema`.
3. `components/funnel/OptinForm.tsx` n'a PAS de honeypot (vérifié : aucun champ caché) et vise en dur `/api/lead` + `/ressource` : il n'est pas réutilisable tel quel. Le bloc `optin` du moteur est un NOUVEAU composant client calqué dessus (états, styles), paramétré par la config (libellés, tag, étape suivante, email de confirmation), avec honeypot.
4. `lib/resend.ts` n'exporte que des emails codés en dur (sendResourceEmail, sendFollowupEmail) ; `sendEmail` est privé. s03 ajoute un export `sendFunnelConfirmationEmail({to, firstName, subject, html})` construit depuis la config du tunnel, sans modifier les fonctions existantes. RESEND_FROM_EMAIL (contact@taskzen.fr, domaine vérifié) vit dans Vercel, pas en local : l'orchestrateur remplit .env.local avant l'exécution.
5. L'idempotence vient de s02 : upsertContact + ensureTags + tagContact sont déjà prouvés sur la base vivante ; le double clic est de plus coupé côté client (bouton désactivé pendant l'envoi) et l'envoi email n'est déclenché qu'à la création ou mise à jour réussie, dans `after()` comme le modèle.

## Target story
Bloc formulaire configurable dans le moteur (prénom optionnel + email), soumission valide = contact upserté + tag du tunnel + email de confirmation Resend (objet et corps dans la config) + redirection vers l'étape suivante ; invalide (email malformé, honeypot) = erreur sans persistance ; rate-limit ; idempotent ; test réel de bout en bout avec une adresse réelle.

## Current state of the code
- `types/funnel.ts` : union Block à 9 types (s01) ; ajouter un 10e type `optin` (champs : labelEmail, labelPrenom?, prenomRequis?, bouton, tag, etapeSuivante, email {objet, corpsHtml simplifié ou segments}).
- `funnels/demo.ts` : 2 étapes ; l'étape decouverte recevra le bloc optin pour la démo et le test réel.
- `lib/supabase.ts` (s02) : upsertContact/ensureTags/tagContact, normalisation email incluse.
- `lib/rate-limit.ts` : checkRateLimit(key, {limit, windowSeconds}) + getClientIp : réutilisés tels quels.
- `middleware.ts` : ne touche pas /t ni /api/optin. `BlockRenderer.tsx` : garde never, le type optin cassera la compilation tant que le composant n'existe pas : ordre des tâches à respecter.

## Anchor points
- `types/funnel.ts` (+OptinBlock), `components/funnel/blocks/OptinBlock.tsx` (client), `BlockRenderer.tsx` (case optin), `app/api/optin/route.ts`, `lib/resend.ts` (+1 export), `lib/schemas.ts` (+funnelOptinSchema), `funnels/demo.ts` (bloc optin sur decouverte).

## Verified APIs / functions
- `checkRateLimit`, `getClientIp` (lib/rate-limit.ts) ; `after` de next/server (utilisé par api/lead, Next 15 ok) ; `success/errors` (lib/api-response.ts) ; `upsertContact/ensureTags/tagContact` (lib/supabase.ts, signatures lues) ; `emailField` exporté ? À VÉRIFIER : s'il n'est pas exporté, l'exporter (ajout d'un mot-clé, pas une refonte).
- Redirection : le composant client fait `router.push` vers l'étape suivante du même tunnel (`/t/<funnel>/<etapeSuivante>`), comme OptinForm le fait vers /ressource.

## Traps & constraints
- Honeypot : champ caché `website` ; s'il est rempli, répondre 200 avec un corps neutre (ne pas apprendre aux robots) mais NE RIEN persister ni envoyer : le critère "affiche une erreur" du stories.md est à lire côté humain (email malformé = erreur visible) ; pour le honeypot, silence poli. Documenter ce choix dans le plan.
- L'email de confirmation est défini par tunnel dans la config : pas de HTML libre (même règle que RichText : segments typés ou gabarit fixe + variables), pour garder le rendu déterministe et éviter l'injection.
- Ne pas casser s01 : le typetest doit gagner un cas optin invalide. Budget mutations à la revue.
- Test réel : adresse réelle simple SANS alias + (règle Systeme.io apprise) ; l'adresse de Delphine delphinemm03.ai@gmail.com est celle déjà utilisée pour ce genre de test. L'envoi réel est autorisé UNIQUEMENT vers cette adresse, une fois.
- .env.local du worktree : à remplir par l'orchestrateur (clés Supabase re-tirées par l'API de gestion + RESEND_API_KEY/RESEND_FROM_EMAIL tirés de l'env Vercel du projet). L'implémenteur ne tire aucune clé lui-même.

## Open questions
- `emailField` exporté ou non (à trancher en 1 minute à l'exécution, les deux issues sont triviales).
- Le corps de l'email de confirmation : gabarit fixe (titre, texte, bouton vers l'étape suivante) + variables depuis la config : retenu, cohérent avec resourceEmailHtml existant.

## Real complexity
Score stories : 3. Verdict : 3 confirmé. Toutes les briques existent (s01 moteur, s02 persistance, rate-limit, resend) ; le travail est un assemblage discipliné : 1 type, 1 composant, 1 route, 1 export email, 1 schéma, la démo et les preuves.

## Split proposal
Non nécessaire.
