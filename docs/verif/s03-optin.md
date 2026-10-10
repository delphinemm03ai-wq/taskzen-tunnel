# Verification : story s03-optin

> Écrit par l'implémenteur juste avant le commit, et commité avec lui. Le reviewer compare
> `Tree:` au commit ; s'ils correspondent, il prend ces résultats comme prouvés au lieu de les
> rejouer. Les commandes sont celles d'AGENTS.local.md, citées telles quelles.

`Tree:` a été produit dans cet ordre : `git add -A`, puis `git write-tree`, sur le code testé.
Ce record et les cases du plan (sous `docs/`) sont écrits ensuite.

Tree: 01cee92352b9b5cdc5edbe88b5b4f7187827ff19

| Run | Command | Result | When |
| --- | --- | --- | --- |
| Test (full suite) | aucune | n'existe pas dans ce projet (réglage `Test` à `-` dans AGENTS.local.md) | non lancé |
| Typecheck | aucune | réglage `Typecheck` à `-` ; le type check passe par le build (ligne suivante) | non lancé |
| Build (1er essai) | `npm run build` | exit 1 · `types/funnel.typetest.ts:43:1 Unused '@ts-expect-error' directive` (cas optin sans tag écrit sur plusieurs lignes : l'erreur tombe sur la ligne `satisfies`) | 2026-10-10T18:39:17Z |
| Build | `npm run build` | exit 0 · "Compiled successfully" · "Linting and checking validity of types" passé · 15/15 pages statiques · `● /t/[funnel]/[step]` toujours SSG (`/t/demo/decouverte`, `/t/demo/diagnostic`) · nouvelle route `ƒ /api/optin` | 2026-10-10T18:40:36Z |
| E2E | aucune | n'existe pas dans ce projet (réglage `E2E` à `-`) | non lancé |

Le build a été lancé après la dernière modification de code (le cas typetest remis sur une
ligne, comme les cas existants). Aucun fichier de code n'a changé après lui. Il compte comme
type check (AGENTS.local.md : "`npm run build` type-checks"). Les deux nouveaux
`@ts-expect-error` (optin sans tag, email sans objet) sont donc consommés : sinon le build casse.

## Preuves locales contre le serveur (tâche 7)

Serveur : `RESEND_API_KEY= RESEND_FROM_EMAIL= npx next start -p 3461` sur le build ci-dessus.
`@next/env` garde une variable déjà présente dans `process.env` (même vide) : Resend est donc
désactivé pour tout ce bloc, aucun email ne peut partir. Chaque groupe de requêtes utilise sa
propre IP via `x-forwarded-for` pour isoler les compteurs de rate-limit.

Comptes en base avant (API de gestion, lecture) : `[{"contacts":0,"tags":0,"liens":0}]` ;
via `lib/supabase.ts` (`countContacts`) : `{"contacts_total":0}`.

Sorties verbatim (2026-10-10T18:42Z) :

```
== 400 email malformé
{"ok":false,"error":{"code":"bad_request","message":"Adresse email invalide"}}
HTTP 400
== 400 email absent
{"ok":false,"error":{"code":"bad_request","message":"L'adresse email est requise"}}
HTTP 400
== 400 étape sans bloc optin
{"ok":false,"error":{"code":"bad_request","message":"Formulaire inconnu"}}
HTTP 400
== 400 tunnel inconnu
{"ok":false,"error":{"code":"bad_request","message":"Formulaire inconnu"}}
HTTP 400
== 200 honeypot
{"ok":true,"data":{"redirectTo":"/t/demo/diagnostic"}}
HTTP 200
== rate-limit, 6 requêtes même IP (honeypot rempli)
{"ok":true,"data":{"redirectTo":"/t/demo/diagnostic"}} HTTP 200
{"ok":true,"data":{"redirectTo":"/t/demo/diagnostic"}} HTTP 200
{"ok":true,"data":{"redirectTo":"/t/demo/diagnostic"}} HTTP 200
{"ok":true,"data":{"redirectTo":"/t/demo/diagnostic"}} HTTP 200
{"ok":true,"data":{"redirectTo":"/t/demo/diagnostic"}} HTTP 200
{"ok":false,"error":{"code":"too_many_requests","message":"Trop de requêtes. Réessaie dans une minute."}} HTTP 429
```

Comptes en base après (2026-10-10T18:43:05Z) : `{"contacts_total":0,"recherche":[]}` via
`lib/supabase.ts` (recherche "robot") et `[{"contacts":0,"tags":0,"liens":0}]` via l'API de
gestion. Le honeypot (7 requêtes au total, avec un email valide) n'a rien écrit ; la réponse
est identique à un succès. Aucun log d'envoi côté serveur.

**Idempotence** (même serveur, Resend désactivé), 2026-10-10T18:43:20Z : deux POST valides
identiques avec `Test.Optin@Example.com` (domaine réservé) :

```
{"ok":true,"data":{"redirectTo":"/t/demo/diagnostic"}} HTTP 200
{"ok":true,"data":{"redirectTo":"/t/demo/diagnostic"}} HTTP 200
{"contacts_total":1,"recherche":[{"email":"test.optin@example.com","first_name":"Idem","tags":["demo-optin"]}]}
HTTP 201 [{"contacts":1,"tags":1,"liens":1}]
[optin] Resend non configuré : email de confirmation ignoré
[optin] Resend non configuré : email de confirmation ignoré
```

Deux soumissions = 1 contact, 1 tag, 1 liaison. Nettoyé aussitôt (18:43:58Z) par l'API de
gestion : `[{"contacts_supprimes":"test.optin@example.com","tags_supprimes":"demo-optin"}]`,
puis `[{"contacts":0,"tags":0,"liens":0}]`. Limite : côté serveur, deux soumissions
déclenchent deux envois ; le "un seul email" du double clic repose sur le bouton désactivé
pendant l'envoi (vu ci-dessous), comme prévu par la research.

## Contrôle visuel dans un navigateur

Chrome headless local (`--remote-debugging-port`, profil jetable du scratchpad), piloté par un
script CDP jetable (non commité), fenêtre 1280x900.

- `/t/demo/decouverte`, Resend désactivé : le bloc optin s'affiche entre le témoignage et le
  CTA, sur fond `bg-soft`, champs "Ton prénom" et "Ton email, pour recevoir la méthode",
  bouton argile "Je reçois la méthode", aux couleurs du thème. Honeypot hors écran
  (`honeypot visible ? false`).
- Saisie "Test" / "pas-un-email", clic : le message "Adresse email invalide" s'affiche en rouge
  sous le champ email, l'URL reste `/t/demo/decouverte`. Base relue ensuite : 0 / 0 / 0.

## Preuve réelle de bout en bout (tâche 8) : BLOQUÉE côté email le 10/10 à 18h45, puis PROUVÉE à 21h58 (voir la reprise en fin de document)

Serveur : `npx next start -p 3462` avec `.env.local` complet (Resend actif). UNE soumission,
dans le navigateur headless, prénom "Delphine", email `delphinemm03.ai@gmail.com`,
2026-10-10T18:45:57Z.

```
honeypot visible ? false
bouton désactivé pendant l'envoi ? true
url après soumission : /t/demo/diagnostic
message d'erreur : null
```

Log serveur (verbatim, tronqué par le `slice(0, 120)` existant de `sendEmail`) :

```
[optin] envoi confirmation échoué (delphinemm03.ai@gmail.com): resend_error_403: {"message":"The taskzen.fr domain is not verified. Please, add and verify your domain on https://resend.com/domains","na
```

Base relue par `lib/supabase.ts` (18:46:23Z) :
`{"contacts_total":1,"recherche":[{"email":"delphinemm03.ai@gmail.com","first_name":"Delphine","tags":["demo-optin"]}]}`
et `[{"contacts":1,"tags":1,"liens":1}]` par l'API de gestion.

Donc : contact créé avec le tag `demo-optin`, bouton désactivé pendant l'envoi, redirection
vers l'étape suivante lue dans la config : **prouvés**. Email de confirmation : **non parti**.
Resend a répondu 403, le domaine de l'expéditeur (`RESEND_FROM_EMAIL`, en @taskzen.fr) n'est
pas vérifié pour le compte de la clé fournie. Le comportement du code sur cet échec est celui
du plan : l'écriture est faite, l'envoi dans `after()` échoue sans bloquer la réponse, l'échec
est loggé. Aucun nouvel essai : l'envoi réel était autorisé une seule fois, et changer
d'expéditeur n'est pas une décision d'implémentation.

Nettoyage (18:46:44Z) par l'API de gestion :
`[{"contacts_supprimes":"delphinemm03.ai@gmail.com","tags_supprimes":"demo-optin"}]`, puis
`[{"contacts":0,"tags":0,"liens":0}]` et `{"contacts_total":0,"recherche":[]}` via
`lib/supabase.ts`. La base est revenue à son état d'avant le run (vide).

L'id d'envoi Resend n'aurait de toute façon pas été lisible : `sendEmail` (privée, existante)
ne renvoie que `{ ok }`, et `lib/resend.ts` est en ajouts seulement. Une réussite se lit dans
le log `[optin] email de confirmation envoyé (demo/decouverte)`.

## Interdits vérifiés (sur le diff indexé)

- Diff vide sur config.ts, app/page.tsx, app/ressource/, app/reserver/, app/merci/,
  middleware.ts, app/api/lead/, app/api/funnel/, app/api/cron/, lib/airtable.ts, app/t/,
  app/admin/, components/admin/, package.json, package-lock.json.
- lib/resend.ts et lib/schemas.ts : 0 ligne supprimée ou modifiée (ajouts seulement ;
  `emailField` n'a pas eu besoin d'être exporté, il est utilisé dans le même fichier).
- 0 tiret cadratin dans les lignes ajoutées.
- 0 valeur de `.env.local` dans le diff (vérifié par script) ; `.env.local` non suivi.
- Serveurs locaux et Chrome headless arrêtés (ports 3461, 3462, 9333 libres).

## Not proven here

- **La réception de l'email** : bloquée par Resend (403, domaine non vérifié pour cette clé).
  À débloquer par Delphine ou l'orchestrateur (vérifier taskzen.fr dans le compte Resend de la
  clé, ou fournir la clé du compte où il est vérifié), puis rejouer la tâche 8 seule : aucun
  code à changer. Le rendu du gabarit HTML n'a donc été vu dans aucune boîte mail.
- Le bouton de l'email pointerait vers `http://localhost:3462/...` en local
  (`NEXT_PUBLIC_SITE_URL` absent de `.env.local`) ; en prod, vers le domaine configuré.
- Le contact n'a pas été regardé dans le panneau `/admin` (relu par `listContacts`, la
  fonction qui alimente ce panneau).
- Rate-limit en mémoire par instance (limite connue de `lib/rate-limit.ts`, non changée).
- Lint et format : pas de commande dédiée au-delà du lint intégré au build.

Verification status: complete (tâche 8 prouvée le 10/10 à 21h58 après correction DNS, voir la reprise en fin de document)


## Reprise de la tâche 8 (10/10/2026, après correction DNS par Delphine)

Cause du blocage réglée : Delphine a recopié l'enregistrement DKIM (resend._domainkey, TXT p=MIGf...)
dans la zone DNS. Vérifié par nslookup avant la reprise : DKIM présent, SPF de send.taskzen.fr
(v=spf1 include:amazonses.com) présent, MX de send présent. Resend affichait "partiellement
vérifié" (propagation en cours) ; la preuve par l'envoi tranche.

Serveur : npx next start -p 3171 avec .env.local complet (Resend actif). UNE soumission :
- POST /api/optin {email: delphinemm03.ai@gmail.com, firstName: Delphine, funnel: demo, step: decouverte}
  : HTTP 200, {"ok":true,"data":{"redirectTo":"/t/demo/diagnostic"}}.
- Journal serveur : [optin] email de confirmation envoyé (demo/decouverte) : Resend a ACCEPTÉ l'envoi.
- Base relue (PostgREST service_role) : 1 contact delphinemm03.ai@gmail.com, prénom Delphine,
  tag demo-optin. Preuve conservée ci-dessous telle quelle :
  [{"email": "delphinemm03.ai@gmail.com", "first_name": "Delphine", "tunnel_contact_tags": [{"tunnel_tags": {"name": "demo-optin"}}]}]
- Nettoyage (SQL de gestion, nettoyage seulement) : contact et tag demo-optin supprimés.
  Comptes après nettoyage (Content-Range, count=exact) : tunnel_contacts 0, tunnel_tags 0,
  tunnel_contact_tags 0.
- Serveur arrêté.

Geste humain restant : Delphine confirme la réception de l'email dans sa boîte (contact@taskzen.fr,
objet défini dans funnels/demo.ts). Le lien du bouton pointe vers localhost (NEXT_PUBLIC_SITE_URL
absent du .env.local) : sans importance pour la preuve, à savoir pour la prod.
Note : l'id d'envoi Resend n'est pas lisible (sendEmail privée renvoie { ok } seulement), la
réussite se lit dans le journal serveur, conformément à l'écart 1 déjà déclaré.
