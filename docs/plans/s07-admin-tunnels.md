---
validated: no
---
# Plan : Story s07-admin-tunnels

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Branch: `feature/s07-admin-tunnels`
Spec: `docs/specs/2026-10-13-admin-tunnels-design.md` (à lire d'abord, ce plan argumente depuis la spec).
Story: `docs/stories.md`, s07-admin-tunnels.

**Goal:** La page `/admin` montre, tunnel par tunnel, les pages avec leur lien, leurs vues, leurs inscrits et leurs taux, filtre les contacts par tag, réserve un onglet Ventes, et n'accepte plus le secret que dans un en-tête.

**Architecture:** Les pages du moteur envoient un seul événement PostHog `funnel_step_view` (propriétés `tunnel`, `etape`). Une route serveur `/api/admin/funnels` lit la structure des tunnels dans la config, compte les inscrits par tag dans Supabase et les vues par étape dans PostHog (une requête HogQL groupée), et renvoie des `null` là où une source est en panne. Côté client, `AdminShell` tient le secret, la période et l'onglet actif ; `FunnelsPanel` affiche les cartes ; `ContactsPanel` gagne un filtre par tag.

**Tech Stack:** Next.js App Router (routes `app/api/*/route.ts`), TypeScript strict, zod, fetch PostgREST pur (`lib/supabase.ts`), HogQL (`lib/posthog-query.ts`), posthog-js côté client. Aucune dépendance ajoutée.

## Global Constraints

- Thème clair unique, tokens de `app/globals.css`, chiffres en `var(--font-mono)`, cartes `.surface-card`, aucune librairie UI (`docs/design-system.md`).
- Aucun tiret cadratin dans le code, les textes ou les commits. Textes en français, tutoiement.
- Le secret admin n'apparaît dans aucune adresse (ni `?secret=` lu, ni écrit). En-tête `x-admin-secret` uniquement, sur toutes les routes admin.
- `SUPABASE_SERVICE_ROLE_KEY` et `POSTHOG_PERSONAL_API_KEY` restent côté serveur (jamais importés dans un fichier `"use client"`).
- Diff vide sur : `config.ts`, `app/page.tsx`, `app/ressource/`, `app/reserver/`, `app/merci/`, `middleware.ts`, `app/api/lead/`, `app/api/optin/`, `app/api/cron/`, `lib/airtable.ts`, `lib/resend.ts`, `funnels/*.ts`, `components/funnel/blocks/`.
- Pas de test runner (AGENTS.local.md) : la preuve est `npm run build` + `curl` contre le serveur local + record `docs/verif/s07-admin-tunnels.md`. Budget : 0 test runtime commité.
- Aucun push, aucun déploiement (Delphine fait les deux). Email réel : aucun envoi prévu par ce plan ; l'opt-in de preuve (tâche 9) en envoie un seul, vers delphinemm03.ai@gmail.com.
- Commits conventionnels, remote `delphine` uniquement.

## Review Focus

1. Secret absent, vide ou faux sur chaque route (`/api/admin/funnels`, `/api/admin/contacts`, `/api/admin/tags`, `/api/funnel/stats`) : 401, corps `{ok:false}` sans aucune donnée. Pinned : tâche 5 et tâche 6 (curls).
2. PostHog configuré mais en erreur (clé révoquée, 500) : la route funnels répond quand même 200 avec `sources.posthog = "indisponible"` et `vues = null` partout ; la page affiche pages et inscrits. Pinned : tâche 6 (clé fausse en local).
3. Tag inconnu ou tag de la config sans aucun contact : `inscrits = 0`, pas d'erreur ; dans Contacts, filtre sur un tag sans contact : liste vide avec message, pas d'erreur. Pinned : tâches 3 et 4.
4. `periode` hors liste (`?periode=12`, `?periode=abc`) : 400 avec message français, jamais une requête PostHog avec une valeur non entière (injection HogQL). Pinned : tâche 6.
5. Un tunnel dont une étape n'a jamais été vue : ligne à 0 vues, passage « · » si la précédente est à 0 (division par zéro), conversion « · » si 0 vues. Pinned : tâche 7 (rendu avec données vides).

---

## Tasks (ordered)

### Task 1 : Événement de vue des pages du moteur

**Files:**
- Modify: `lib/events.ts`
- Modify: `lib/posthog-client.ts:27-30`
- Modify: `components/funnel/PageView.tsx`
- Modify: `app/t/[funnel]/[step]/page.tsx:36-53`

**Interfaces:**
- Produces: `FUNNEL_EVENTS.FUNNEL_STEP_VIEW = "funnel_step_view"` ; `PageView({ event, props? })` avec `props: { tunnel: string; etape: string }` pour les pages du moteur.

- [ ] **Step 1 : Ajouter l'événement**

Dans `lib/events.ts`, ajouter une entrée à `FUNNEL_EVENTS` (la constante `FUNNEL_STEPS` ne change pas) :

```ts
export const FUNNEL_EVENTS = {
  LANDING_VIEW: "landing_view",
  LEAD_SIGNUP: "lead_signup",
  RESOURCE_VIEW: "resource_view",
  RESOURCE_ENGAGED: "resource_engaged",
  BOOKING_CLICK: "booking_click",
  BOOKING_VIEW: "booking_view",
  BOOKING_COMPLETED: "booking_completed",
  /** Vue d'une étape du moteur de pages, propriétés { tunnel, etape } (s07). */
  FUNNEL_STEP_VIEW: "funnel_step_view",
} as const;
```

- [ ] **Step 2 : PageView accepte des propriétés**

Remplacer `components/funnel/PageView.tsx` :

```tsx
"use client";

import { useEffect } from "react";
import { track } from "@/lib/posthog-client";
import type { FunnelEvent } from "@/lib/events";

export interface PageViewProps {
  event: FunnelEvent;
  /** Propriétés attachées à l'événement (ex. { tunnel, etape } pour le moteur de pages). */
  props?: Record<string, string>;
}

/** Capture un event de vue de page au montage, une seule fois par page. */
export function PageView({ event, props }: PageViewProps) {
  const key = JSON.stringify(props ?? {});
  useEffect(() => {
    track(event, props);
    // `key` fige les props : un nouvel objet identique ne renvoie pas l'événement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, key]);
  return null;
}
```

`track` dans `lib/posthog-client.ts` accepte déjà `props?: Record<string, unknown>` : aucune modification.

- [ ] **Step 3 : Monter PageView dans la route du moteur**

Dans `app/t/[funnel]/[step]/page.tsx`, ajouter les imports :

```ts
import { PageView } from "@/components/funnel/PageView";
import { FUNNEL_EVENTS } from "@/lib/events";
```

et dans le JSX, juste après `<main ...>` :

```tsx
      <PageView
        event={FUNNEL_EVENTS.FUNNEL_STEP_VIEW}
        props={{ tunnel: found.funnel.slug, etape: found.step.slug }}
      />
```

- [ ] **Step 4 : Vérifier**

Run : `npm run build`
Expected : build vert, les routes `/t/demo/*` et `/t/guides-sommet/*` toujours listées en statique (SSG).

Run (serveur `npm run dev` lancé, `NEXT_PUBLIC_POSTHOG_KEY` présent dans `.env.local`) : ouvrir `http://localhost:3000/t/demo/decouverte` dans Chrome, onglet Réseau, filtrer `posthog` : une requête `capture` dont le corps contient `"event":"funnel_step_view"`, `"tunnel":"demo"`, `"etape":"decouverte"`. Une seule par chargement.
Expected : exactement un événement. Noter dans le record que le filtre d'hôte l'exclut des comptages (localhost).

- [ ] **Step 5 : Commit**

```bash
git add lib/events.ts components/funnel/PageView.tsx "app/t/[funnel]/[step]/page.tsx"
git commit -m "feat(s07): événement funnel_step_view sur les pages du moteur"
```

### Task 2 : Comptage des vues par étape (PostHog)

**Files:**
- Modify: `lib/posthog-query.ts` (ajout)

**Interfaces:**
- Produces: `countStepViews(days: number): Promise<Map<string, number>>`, clé `${tunnel}/${etape}`.

- [ ] **Step 1 : Ajouter la requête groupée**

À la fin de `lib/posthog-query.ts` :

```ts
/**
 * Vues par étape du moteur sur les `days` derniers jours, clé `${tunnel}/${etape}`.
 * Une étape absente de la Map n'a eu aucune vue. `days` est forcé en entier
 * borné avant d'entrer dans la requête (pas d'interpolation libre).
 */
export async function countStepViews(days: number): Promise<Map<string, number>> {
  const safeDays = Math.min(Math.max(Math.trunc(days), 1), 90);
  const sql = `
    SELECT properties.tunnel AS tunnel, properties.etape AS etape, count() AS c
    FROM events
    WHERE event = 'funnel_step_view'
      AND timestamp > now() - INTERVAL ${safeDays} DAY
      ${PROD_HOST_FILTER}
    GROUP BY tunnel, etape
  `;
  const result = await queryHogQL(sql);
  const views = new Map<string, number>();
  for (const row of result.results ?? []) {
    const [tunnel, etape, count] = row;
    if (typeof tunnel === "string" && typeof etape === "string" && typeof count === "number") {
      views.set(`${tunnel}/${etape}`, count);
    }
  }
  return views;
}
```

- [ ] **Step 2 : Vérifier le typage**

Run : `npx tsc --noEmit`
Expected : 0 erreur.

- [ ] **Step 3 : Commit**

```bash
git add lib/posthog-query.ts
git commit -m "feat(s07): comptage HogQL des vues par tunnel et étape"
```

### Task 3 : Comptages et filtre par tag (Supabase)

**Files:**
- Modify: `lib/supabase.ts` (ajouts + paramètre `tag` sur `listContacts` et `countContacts`)

**Interfaces:**
- Produces: `countContactsByTag(tag: string): Promise<number>` ; `listTagNames(): Promise<string[]>` ; `listContacts({ search?, tag?, limit, offset })` ; `countContacts(search?, tag?)`.

- [ ] **Step 1 : Identifiants des contacts porteurs d'un tag**

Après `applySearch` dans `lib/supabase.ts` :

```ts
/**
 * Ids des contacts qui portent le tag (nom exact). Deux requêtes plutôt qu'une
 * jointure !inner : la jointure filtrante ne renverrait que le tag filtré dans
 * la colonne tags, et on veut tous les tags du contact.
 */
async function contactIdsByTag(tag: string): Promise<string[]> {
  const url = restUrl("tunnel_contact_tags");
  url.searchParams.set("select", "contact_id,tunnel_tags!inner(name)");
  url.searchParams.set("tunnel_tags.name", `eq.${tag}`);
  const res = await call(url, { headers: headers() }, "contactIdsByTag");
  const rows: { contact_id: string }[] = await res.json();
  return rows.map((r) => r.contact_id);
}

/** Filtre `id=in.(...)` ; renvoie false si aucun contact ne porte le tag (rien à lister). */
async function applyTag(url: URL, tag?: string): Promise<boolean> {
  if (!tag) return true;
  const ids = await contactIdsByTag(tag);
  if (ids.length === 0) return false;
  url.searchParams.set("id", `in.(${ids.join(",")})`);
  return true;
}
```

- [ ] **Step 2 : Brancher le tag sur la liste et le comptage**

Modifier `listContacts` et `countContacts` :

```ts
export async function listContacts(opts: {
  search?: string;
  tag?: string;
  limit: number;
  offset: number;
}): Promise<ContactWithTags[]> {
  const url = restUrl("tunnel_contacts");
  url.searchParams.set(
    "select",
    "id,email,first_name,created_at,updated_at,unsubscribed_at,tunnel_contact_tags(tunnel_tags(name))"
  );
  url.searchParams.set("order", "created_at.desc,id.asc");
  url.searchParams.set("limit", String(opts.limit));
  url.searchParams.set("offset", String(opts.offset));
  applySearch(url, opts.search);
  if (!(await applyTag(url, opts.tag))) return [];

  const res = await call(url, { headers: headers() }, "listContacts");
  const rows: ContactRow[] = await res.json();
  return rows.map(({ tunnel_contact_tags, ...contact }) => ({
    ...contact,
    tags: tunnel_contact_tags
      .map((link) => link.tunnel_tags?.name)
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b, "fr")),
  }));
}

export async function countContacts(search?: string, tag?: string): Promise<number> {
  const url = restUrl("tunnel_contacts");
  url.searchParams.set("select", "id");
  url.searchParams.set("limit", "1");
  applySearch(url, search);
  if (!(await applyTag(url, tag))) return 0;

  const res = await call(url, { headers: headers("count=exact") }, "countContacts");
  const total = res.headers.get("content-range")?.split("/")[1];
  return total && total !== "*" ? parseInt(total, 10) : 0;
}
```

- [ ] **Step 3 : Comptage par tag et liste des tags**

À la fin du fichier :

```ts
/** Nombre d'inscriptions portant ce tag (0 si le tag n'existe pas). */
export async function countContactsByTag(tag: string): Promise<number> {
  const url = restUrl("tunnel_contact_tags");
  url.searchParams.set("select", "contact_id,tunnel_tags!inner(name)");
  url.searchParams.set("tunnel_tags.name", `eq.${tag}`);
  url.searchParams.set("limit", "1");
  const res = await call(url, { headers: headers("count=exact") }, "countContactsByTag");
  const total = res.headers.get("content-range")?.split("/")[1];
  return total && total !== "*" ? parseInt(total, 10) : 0;
}

/** Noms de tags existants, triés, pour le filtre de l'admin. */
export async function listTagNames(): Promise<string[]> {
  const url = restUrl("tunnel_tags");
  url.searchParams.set("select", "name");
  url.searchParams.set("order", "name.asc");
  const res = await call(url, { headers: headers() }, "listTagNames");
  const rows: { name: string }[] = await res.json();
  return rows.map((r) => r.name);
}
```

- [ ] **Step 4 : Vérifier contre la base vivante**

Run : `npx tsc --noEmit` puis, avec `.env.local` renseigné, un script jetable dans le scratchpad :

```ts
// scratch/check-tags.ts, lancé avec: npx tsx scratch/check-tags.ts (ou node --env-file)
import { countContactsByTag, listTagNames, countContacts } from "../lib/supabase";
console.log(await listTagNames());
console.log(await countContactsByTag("guide-monetisation-youtube"));
console.log(await countContactsByTag("tag-qui-n-existe-pas"));
console.log(await countContacts(undefined, "tag-qui-n-existe-pas"));
```

Expected : liste des tags (peut être vide), un entier, `0`, `0`. Aucune erreur. Supprimer le script après.

- [ ] **Step 5 : Commit**

```bash
git add lib/supabase.ts
git commit -m "feat(s07): comptage par tag, liste des tags et filtre tag sur les contacts"
```

### Task 4 : Routes contacts (filtre tag) et tags, secret en en-tête seulement

**Files:**
- Modify: `app/api/admin/contacts/route.ts`
- Create: `app/api/admin/tags/route.ts`
- Create: `lib/admin-auth.ts`

**Interfaces:**
- Produces: `requireAdminSecret(req): boolean` ; `GET /api/admin/contacts?tag=` ; `GET /api/admin/tags` qui renvoie `{ ok: true, data: { tags: string[] } }`.

- [ ] **Step 1 : Vérification du secret partagée**

Créer `lib/admin-auth.ts` :

```ts
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Secret admin lu dans l'en-tête x-admin-secret uniquement (jamais dans
 * l'adresse : les query strings finissent dans les logs). Comparaison en
 * temps constant. Sans ADMIN_SECRET côté serveur, tout est refusé.
 */
export function isAdminRequest(req: NextRequest): boolean {
  const expected = process.env.ADMIN_SECRET;
  const given = req.headers.get("x-admin-secret");
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
```

- [ ] **Step 2 : Route contacts**

Dans `app/api/admin/contacts/route.ts` : importer `isAdminRequest`, ajouter `tag` au schéma, retirer le `?secret=`.

```ts
import { isAdminRequest } from "@/lib/admin-auth";

const querySchema = z.object({
  search: z.string().max(200, "Recherche trop longue (200 caractères max)").optional(),
  tag: z.string().trim().min(1).max(100, "Tag trop long (100 caractères max)").optional(),
  page: /* inchangé */,
  format: /* inchangé */,
});

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return errors.unauthorized("Secret invalide");
  }
  // ... suite inchangée jusqu'au parse, qui ajoute :
  const parsed = querySchema.safeParse({
    search: params.get("search") ?? undefined,
    tag: params.get("tag") ?? undefined,
    page: params.get("page") ?? undefined,
    format: params.get("format") ?? undefined,
  });
  // ...
  const { search, tag, page, format } = parsed.data;
  // csv :
  if (format === "csv") return csvResponse(await listAll(search, tag));
  // json :
  const [contacts, total] = await Promise.all([
    listContacts({ search, tag, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    countContacts(search, tag),
  ]);
```

et `listAll(search?: string, tag?: string)` passe `tag` à `listContacts`. Mettre à jour le commentaire de tête : « en-tête x-admin-secret uniquement ».

- [ ] **Step 3 : Route tags**

Créer `app/api/admin/tags/route.ts` :

```ts
import { NextRequest } from "next/server";
import { success, errors } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/admin-auth";
import { isSupabaseConfigured, listTagNames } from "@/lib/supabase";

/** Noms de tags existants, pour le filtre de l'onglet Contacts. */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return errors.unauthorized("Secret invalide");
  if (!isSupabaseConfigured()) {
    return errors.internal("Supabase non configuré (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  try {
    return success({ tags: await listTagNames() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/tags] error:", message);
    return errors.internal(message);
  }
}
```

- [ ] **Step 4 : Vérifier par curl** (serveur local, `S` = secret du `.env.local`, jamais affiché)

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/admin/contacts"                       # 401
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/admin/contacts?secret=$S"             # 401 (le query string ne compte plus)
curl -s -o /dev/null -w "%{http_code}\n" -H "x-admin-secret: faux" "http://localhost:3000/api/admin/tags" # 401
curl -s -H "x-admin-secret: $S" "http://localhost:3000/api/admin/tags"                                    # {"ok":true,"data":{"tags":[...]}}
curl -s -H "x-admin-secret: $S" "http://localhost:3000/api/admin/contacts?tag=tag-inconnu"                # total 0, contacts []
curl -s -H "x-admin-secret: $S" "http://localhost:3000/api/admin/contacts?tag=guide-monetisation-youtube" # contacts portant ce tag, colonne tags complète
curl -s -H "x-admin-secret: $S" "http://localhost:3000/api/admin/contacts?tag=guide-monetisation-youtube&format=csv" | head -3
```

Expected : codes et corps comme en commentaire ; les corps 401 ne contiennent que `{"ok":false,"error":{...}}`.

- [ ] **Step 5 : Commit**

```bash
git add lib/admin-auth.ts app/api/admin/contacts/route.ts app/api/admin/tags/route.ts
git commit -m "feat(s07): filtre par tag, route des tags, secret admin en en-tête uniquement"
```

### Task 5 : Route stats historique en en-tête

**Files:**
- Modify: `app/api/funnel/stats/route.ts:6-12`

- [ ] **Step 1 : Remplacer la lecture du secret**

```ts
import { isAdminRequest } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return errors.unauthorized("Secret invalide");
  }
  // reste inchangé
```

- [ ] **Step 2 : Vérifier**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/funnel/stats?secret=$S"   # 401
curl -s -H "x-admin-secret: $S" "http://localhost:3000/api/funnel/stats?days=30"               # {"ok":true,...}
```

- [ ] **Step 3 : Commit**

```bash
git add app/api/funnel/stats/route.ts
git commit -m "fix(s07): la route stats lit le secret dans l'en-tête, plus dans l'adresse"
```

### Task 6 : Route `/api/admin/funnels`

**Files:**
- Create: `types/admin.ts`
- Create: `lib/admin-funnels.ts`
- Create: `app/api/admin/funnels/route.ts`

**Interfaces:**
- Consumes: `allFunnels` (`funnels/index.ts`), `countStepViews`, `countEvent`, `countContactsByTag`, `FUNNEL_EVENTS`, `isAdminRequest`.
- Produces: types `AdminStep`, `AdminFunnel`, `AdminFunnelsData` ; `GET /api/admin/funnels?periode=7|30|90` qui renvoie `{ ok: true, data: AdminFunnelsData }`.

- [ ] **Step 1 : Types partagés client et serveur**

Créer `types/admin.ts` :

```ts
/** Données de l'onglet Tunnels (story s07). `null` = source indisponible. */

export type SourceStatus = "ok" | "indisponible";

export interface AdminStep {
  slug: string;
  titre: string;
  /** Adresse publique complète, ouverte dans un nouvel onglet. */
  url: string;
  /** Tag posé par le bloc opt-in de l'étape, s'il y en a un. */
  tag: string | null;
  /** Étape cible d'un opt-in (page de remerciement). */
  remerciement: boolean;
  vues: number | null;
  /** Renseigné seulement si l'étape porte un opt-in (tag non nul) ou pour la landing historique. */
  inscrits: number | null;
}

export interface AdminFunnel {
  slug: string;
  nom: string;
  /** Carte « Tunnel Méthode IA (pages historiques) » : événements nommés, pas de tag. */
  historique: boolean;
  inscrits: number | null;
  vues: number | null;
  etapes: AdminStep[];
}

export interface AdminFunnelsData {
  periode: 7 | 30 | 90;
  sources: { posthog: SourceStatus; supabase: SourceStatus };
  tunnels: AdminFunnel[];
}
```

- [ ] **Step 2 : Assemblage côté serveur**

Créer `lib/admin-funnels.ts` :

```ts
import { allFunnels } from "@/funnels";
import type { FunnelConfig } from "@/types/funnel";
import type { AdminFunnel, AdminFunnelsData, AdminStep, SourceStatus } from "@/types/admin";
import { countContactsByTag, isSupabaseConfigured } from "@/lib/supabase";
import { countEvent, countStepViews, isPostHogQueryConfigured } from "@/lib/posthog-query";
import { FUNNEL_EVENTS } from "@/lib/events";

/** Pages de juillet : chemin, titre, événement de vue, événement d'inscription (landing). */
const HISTORIQUE = {
  slug: "methode-ia",
  nom: "Tunnel Méthode IA (pages historiques)",
  etapes: [
    { slug: "accueil", path: "/", titre: "Accueil", vue: FUNNEL_EVENTS.LANDING_VIEW, inscription: FUNNEL_EVENTS.LEAD_SIGNUP },
    { slug: "ressource", path: "/ressource", titre: "Ressource", vue: FUNNEL_EVENTS.RESOURCE_VIEW, inscription: null },
    { slug: "reserver", path: "/reserver", titre: "Réservation", vue: FUNNEL_EVENTS.BOOKING_VIEW, inscription: null },
    { slug: "merci", path: "/merci", titre: "Merci", vue: FUNNEL_EVENTS.BOOKING_COMPLETED, inscription: null },
  ],
} as const;

/** Tag du premier bloc optin de l'étape, ou null. */
function optinTag(step: FunnelConfig["etapes"][number]): string | null {
  const bloc = step.blocs.find((b) => b.type === "optin");
  return bloc && bloc.type === "optin" ? bloc.tag : null;
}

/** Slugs des étapes visées par un etapeSuivante d'opt-in (pages de remerciement). */
function thankYouSlugs(funnel: FunnelConfig): Set<string> {
  const slugs = new Set<string>();
  for (const step of funnel.etapes) {
    for (const bloc of step.blocs) {
      if (bloc.type === "optin") slugs.add(bloc.etapeSuivante);
    }
  }
  return slugs;
}

/** Somme de nombres dont certains peuvent manquer : null dès qu'un terme est null. */
function sum(values: Array<number | null>): number | null {
  let total = 0;
  for (const v of values) {
    if (v === null) return null;
    total += v;
  }
  return total;
}

/** Tente une source ; en échec, journalise et renvoie null (la page reste utilisable). */
async function attempt<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[admin/funnels] ${label}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function buildAdminFunnels(origin: string, periode: 7 | 30 | 90): Promise<AdminFunnelsData> {
  const posthogOn = isPostHogQueryConfigured();
  const supabaseOn = isSupabaseConfigured();

  // Une seule requête PostHog pour toutes les étapes du moteur.
  const stepViews = posthogOn ? await attempt("countStepViews", () => countStepViews(periode)) : null;
  const posthog: SourceStatus = stepViews ? "ok" : "indisponible";

  // Un comptage Supabase par tag d'opt-in, en parallèle.
  const tags = allFunnels.flatMap((f) => f.etapes.map(optinTag)).filter((t): t is string => t !== null);
  const tagCounts = new Map<string, number | null>();
  let supabase: SourceStatus = supabaseOn ? "ok" : "indisponible";
  if (supabaseOn) {
    const counts = await Promise.all(tags.map((t) => attempt(`countContactsByTag(${t})`, () => countContactsByTag(t))));
    tags.forEach((t, i) => tagCounts.set(t, counts[i]));
    if (counts.some((c) => c === null)) supabase = "indisponible";
  }

  const tunnels: AdminFunnel[] = allFunnels.map((funnel) => {
    const merci = thankYouSlugs(funnel);
    const etapes: AdminStep[] = funnel.etapes.map((step) => {
      const tag = optinTag(step);
      const vues = stepViews ? (stepViews.get(`${funnel.slug}/${step.slug}`) ?? 0) : null;
      const inscrits = tag ? (supabase === "ok" ? (tagCounts.get(tag) ?? 0) : null) : null;
      return {
        slug: step.slug,
        titre: step.titre,
        url: `${origin}/t/${funnel.slug}/${step.slug}`,
        tag,
        remerciement: merci.has(step.slug),
        vues,
        inscrits,
      };
    });
    const optins = etapes.filter((e) => e.tag !== null);
    return {
      slug: funnel.slug,
      nom: funnel.nom,
      historique: false,
      inscrits: optins.length ? sum(optins.map((e) => e.inscrits)) : 0,
      vues: sum(etapes.map((e) => e.vues)),
      etapes,
    };
  });

  // Carte historique : événements nommés, comptés un par un (même période).
  const histo = await Promise.all(
    HISTORIQUE.etapes.map(async (e) => ({
      slug: e.slug,
      titre: e.titre,
      url: `${origin}${e.path}`,
      tag: null,
      remerciement: false,
      vues: posthogOn ? await attempt(`countEvent(${e.vue})`, () => countEvent(e.vue, periode)) : null,
      inscrits: e.inscription && posthogOn ? await attempt(`countEvent(${e.inscription})`, () => countEvent(e.inscription, periode)) : null,
    }))
  );
  tunnels.push({
    slug: HISTORIQUE.slug,
    nom: HISTORIQUE.nom,
    historique: true,
    inscrits: histo[0]?.inscrits ?? null,
    vues: sum(histo.map((e) => e.vues)),
    etapes: histo,
  });

  return { periode, sources: { posthog, supabase }, tunnels };
}
```

Note : pour la carte historique, « inscrits » = événement PostHog `lead_signup` sur la période (ces pages écrivent dans Airtable, pas dans Supabase). Le dire dans la note sous la carte (tâche 7).

- [ ] **Step 3 : La route**

Créer `app/api/admin/funnels/route.ts` :

```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { success, errors } from "@/lib/api-response";
import { isAdminRequest } from "@/lib/admin-auth";
import { buildAdminFunnels } from "@/lib/admin-funnels";

const querySchema = z.object({
  periode: z
    .enum(["7", "30", "90"], { errorMap: () => ({ message: "Période invalide (7, 30 ou 90 jours)" }) })
    .default("30"),
});

/** Onglet Tunnels de l'admin : structure depuis la config, vues PostHog, inscrits Supabase. */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return errors.unauthorized("Secret invalide");

  const parsed = querySchema.safeParse({ periode: req.nextUrl.searchParams.get("periode") ?? undefined });
  if (!parsed.success) return errors.badRequest(parsed.error.issues[0]?.message || "Paramètres invalides");

  const periode = Number(parsed.data.periode) as 7 | 30 | 90;
  try {
    return success(await buildAdminFunnels(req.nextUrl.origin, periode));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/funnels] error:", message);
    return errors.internal(message);
  }
}
```

- [ ] **Step 4 : Vérifier par curl**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/admin/funnels"                                  # 401
curl -s -o /dev/null -w "%{http_code}\n" -H "x-admin-secret: $S" "http://localhost:3000/api/admin/funnels?periode=12"  # 400
curl -s -H "x-admin-secret: $S" "http://localhost:3000/api/admin/funnels?periode=30" | python -m json.tool | head -40
```

Expected : 3 tunnels (`demo` 2 étapes, `guides-sommet` 12 étapes, `methode-ia` 4 étapes), `url` en `http://localhost:3000/...`, `tag` renseigné sur `decouverte` (`demo-optin`) et sur les 11 `inscription-*`, `remerciement: true` sur `diagnostic` et `merci`. En local, `sources.posthog` vaut `ok` et les vues valent 0 (filtre d'hôte).

Panne simulée : relancer le serveur avec `POSTHOG_PERSONAL_API_KEY=faux` : même route, 200, `sources.posthog: "indisponible"`, `vues: null` partout, `inscrits` toujours renseignés. Puis `SUPABASE_URL=https://inexistant.supabase.co` : 200, `sources.supabase: "indisponible"`, `inscrits: null` sur les étapes opt-in, vues intactes. Remettre les vraies valeurs.

- [ ] **Step 5 : Commit**

```bash
git add types/admin.ts lib/admin-funnels.ts app/api/admin/funnels/route.ts
git commit -m "feat(s07): route /api/admin/funnels, structure config + vues + inscrits par tag"
```

### Task 7 : Interface : coquille à onglets, onglet Tunnels, filtre tag, onglet Ventes

**Files:**
- Create: `components/admin/AdminShell.tsx`
- Create: `components/admin/FunnelsPanel.tsx`
- Create: `components/admin/SalesPlaceholder.tsx`
- Modify: `components/admin/ContactsPanel.tsx`
- Modify: `app/admin/page.tsx`
- Delete: `components/admin/FunnelDashboard.tsx` (remplacé par AdminShell ; la carte historique vient de la route)
- Modify: `docs/design-system.md:32` (ligne du composant)

**Interfaces:**
- Consumes: `AdminFunnelsData` (`types/admin.ts`), `/api/admin/funnels`, `/api/admin/tags`, `/api/admin/contacts?tag=`.
- Produces: `AdminSecretContext` reste exporté par `ContactsPanel.tsx` (import inchangé ailleurs) ; `ContactsPanel({ tag, onTagChange })` ; `FunnelsPanel({ periode, onInscritsClick })`.

- [ ] **Step 1 : La coquille**

Créer `components/admin/AdminShell.tsx` :

```tsx
"use client";

import { useState } from "react";
import { AdminSecretContext, ContactsPanel } from "@/components/admin/ContactsPanel";
import { FunnelsPanel } from "@/components/admin/FunnelsPanel";
import { SalesPlaceholder } from "@/components/admin/SalesPlaceholder";

type Tab = "tunnels" | "contacts" | "ventes";
type Periode = 7 | 30 | 90;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "tunnels", label: "Tunnels" },
  { id: "contacts", label: "Contacts" },
  { id: "ventes", label: "Ventes" },
];

/** Saisie du secret, puis trois onglets. Le secret ne vit que dans l'état React. */
export function AdminShell() {
  const [secret, setSecret] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [tab, setTab] = useState<Tab>("tunnels");
  const [periode, setPeriode] = useState<Periode>(30);
  const [contactsTag, setContactsTag] = useState("");

  if (!submitted) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (secret.trim()) setSubmitted(true);
        }}
        className="surface-card"
        style={{ padding: "2rem", maxWidth: "26rem", margin: "0 auto", display: "grid", gap: "1rem" }}
      >
        <label htmlFor="admin-secret" style={{ fontWeight: 600, fontSize: "0.9rem" }}>Secret admin</label>
        <input
          id="admin-secret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          autoComplete="current-password"
          style={{ padding: "0.85rem 1rem", borderRadius: 10, border: "1.5px solid var(--color-line)", fontSize: "1rem" }}
        />
        <button type="submit" className="btn-primary">Accéder au tableau de bord</button>
      </form>
    );
  }

  return (
    <AdminSecretContext.Provider value={secret}>
      <div style={{ display: "grid", gap: "1.4rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "1rem", flexWrap: "wrap" }}>
          <div role="tablist" style={{ display: "flex", gap: "0.4rem", borderBottom: "1px solid var(--color-line)" }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                style={{
                  border: 0, background: "transparent", font: "inherit", padding: "0.6rem 0.9rem", cursor: "pointer",
                  color: tab === t.id ? "var(--color-primary-dark)" : "var(--color-ink-soft)",
                  fontWeight: tab === t.id ? 600 : 400,
                  borderBottom: `3px solid ${tab === t.id ? "var(--color-primary)" : "transparent"}`,
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "tunnels" && (
            <div role="group" aria-label="Période" style={{ display: "flex", gap: "0.4rem" }}>
              {([7, 30, 90] as Periode[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={periode === d}
                  onClick={() => setPeriode(d)}
                  className={periode === d ? "btn-primary" : "btn-outline"}
                  style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
                >
                  {d} jours
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === "tunnels" && (
          <FunnelsPanel
            periode={periode}
            onInscritsClick={(tag) => {
              setContactsTag(tag);
              setTab("contacts");
            }}
          />
        )}
        {tab === "contacts" && <ContactsPanel tag={contactsTag} onTagChange={setContactsTag} />}
        {tab === "ventes" && <SalesPlaceholder />}
      </div>
    </AdminSecretContext.Provider>
  );
}
```

- [ ] **Step 2 : L'onglet Ventes**

Créer `components/admin/SalesPlaceholder.tsx` :

```tsx
/** Encart d'attente : les ventes arrivent avec Stripe (story s04). */
export function SalesPlaceholder() {
  return (
    <div className="surface-card" style={{ padding: "2rem", display: "grid", gap: "0.6rem" }}>
      <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Ventes et chiffre d'affaires</h2>
      <p style={{ margin: 0, color: "var(--color-ink-soft)", maxWidth: "34rem" }}>
        Les ventes et le chiffre d'affaires apparaîtront ici avec le paiement Stripe (story s04).
      </p>
    </div>
  );
}
```

- [ ] **Step 3 : L'onglet Tunnels**

Créer `components/admin/FunnelsPanel.tsx` :

```tsx
"use client";

import { useContext, useEffect, useState } from "react";
import { AdminSecretContext } from "@/components/admin/ContactsPanel";
import type { AdminFunnel, AdminFunnelsData, AdminStep } from "@/types/admin";

const DASH = "·";
const mono = { fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" as const, whiteSpace: "nowrap" as const };
const th = { textAlign: "left" as const, fontSize: "0.72rem", textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "var(--color-ink-soft)", padding: "0.5rem 0.7rem", borderBottom: "1px solid var(--color-line)" };
const td = { padding: "0.6rem 0.7rem", borderBottom: "1px solid var(--color-line)", verticalAlign: "top" as const };
const num = { ...td, ...mono, textAlign: "right" as const };

function pct(part: number | null, whole: number | null): string {
  if (part === null || whole === null || whole === 0) return DASH;
  return `${((part / whole) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

function n(value: number | null): string {
  return value === null ? DASH : value.toLocaleString("fr-FR");
}

function Row({ step, prev, onInscritsClick }: { step: AdminStep; prev: AdminStep | null; onInscritsClick: (tag: string) => void }) {
  const inscrits = step.tag !== null || step.inscrits !== null;
  return (
    <tr>
      <td style={td}>
        <span style={{ fontWeight: 500 }}>{step.titre}</span>
        {step.tag && <span style={{ fontSize: "0.72rem", marginLeft: 6, color: "var(--color-ink-soft)" }}>opt-in</span>}
        {step.remerciement && <span style={{ fontSize: "0.72rem", marginLeft: 6, color: "var(--color-ink-soft)" }}>remerciement</span>}
        <a href={step.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontSize: "0.8rem", color: "var(--color-accent)", wordBreak: "break-all" }}>
          {new URL(step.url).pathname}
        </a>
      </td>
      <td style={num}>{n(step.vues)}</td>
      <td style={num}>{prev ? pct(step.vues, prev.vues) : DASH}</td>
      <td style={num}>
        {!inscrits ? DASH : step.tag && step.inscrits !== null ? (
          <button type="button" onClick={() => onInscritsClick(step.tag as string)} style={{ ...mono, background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--color-primary-dark)", fontWeight: 700, textDecoration: "underline" }}>
            {n(step.inscrits)}
          </button>
        ) : n(step.inscrits)}
      </td>
      <td style={num}>{inscrits ? pct(step.inscrits, step.vues) : DASH}</td>
    </tr>
  );
}

function FunnelCard({ funnel, sources, onInscritsClick }: { funnel: AdminFunnel; sources: AdminFunnelsData["sources"]; onInscritsClick: (tag: string) => void }) {
  const optins = funnel.etapes.filter((e) => e.tag !== null);
  const convVues = optins.length ? optins.reduce<number | null>((acc, e) => (acc === null || e.vues === null ? null : acc + e.vues), 0) : null;
  return (
    <article className="surface-card" style={{ padding: "1.4rem", display: "grid", gap: "0.8rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: "1.3rem" }}>{funnel.nom}</h2>
        <div style={{ display: "flex", gap: "1.2rem", flexWrap: "wrap" }}>
          <Kpi label={funnel.historique ? "Inscrits (période)" : "Inscrits (total)"} value={n(funnel.inscrits)} />
          <Kpi label={`Vues (${funnel.etapes.length} pages)`} value={n(funnel.vues)} />
          {optins.length > 0 && <Kpi label="Conversion" value={pct(funnel.inscrits, convVues)} />}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", minWidth: 560 }}>
          <thead>
            <tr>
              <th style={th}>Page</th>
              <th style={{ ...th, textAlign: "right" }}>Vues</th>
              <th style={{ ...th, textAlign: "right" }}>Passage</th>
              <th style={{ ...th, textAlign: "right" }}>Inscrits</th>
              <th style={{ ...th, textAlign: "right" }}>Conv.</th>
            </tr>
          </thead>
          <tbody>
            {funnel.etapes.map((step, i) => (
              <Row key={step.slug} step={step} prev={i > 0 ? funnel.etapes[i - 1] : null} onInscritsClick={onInscritsClick} />
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--color-ink-soft)" }}>
        Passage : part des visiteurs de la page précédente arrivés sur celle-ci. Conv. : inscrits divisés par vues de la page.
        {funnel.historique && " Inscrits : événement d'inscription PostHog (ces pages écrivent dans Airtable)."}
      </p>
      {sources.posthog === "indisponible" && <Alerte>Vues indisponibles : PostHog n'a pas répondu.</Alerte>}
      {sources.supabase === "indisponible" && !funnel.historique && <Alerte>Inscrits indisponibles : Supabase n'a pas répondu (projet en pause ?).</Alerte>}
    </article>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 2 }}>
      <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-ink-soft)" }}>{label}</span>
      <b style={{ ...mono, fontSize: "1.25rem" }}>{value}</b>
    </div>
  );
}

function Alerte({ children }: { children: string }) {
  return (
    <p style={{ margin: 0, padding: "0.5rem 0.8rem", borderLeft: "3px solid var(--color-primary)", background: "var(--color-bg-soft)", fontSize: "0.85rem" }}>{children}</p>
  );
}

export function FunnelsPanel({ periode, onInscritsClick }: { periode: 7 | 30 | 90; onInscritsClick: (tag: string) => void }) {
  const secret = useContext(AdminSecretContext);
  const [data, setData] = useState<AdminFunnelsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!secret) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/funnels?periode=${periode}`, { headers: { "x-admin-secret": secret } })
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) {
          setError(json.error?.message || "Erreur");
          setData(null);
        } else {
          setData(json.data);
        }
      })
      .catch(() => setError("Connexion impossible"))
      .finally(() => setLoading(false));
  }, [secret, periode]);

  return (
    <section style={{ display: "grid", gap: "1.2rem" }}>
      {loading && <p style={{ color: "var(--color-ink-soft)", margin: 0 }}>Chargement…</p>}
      {error && <div className="surface-card" style={{ padding: "1.4rem", color: "#b91c1c" }}>{error}</div>}
      {data && data.tunnels.map((f) => (
        <FunnelCard key={f.slug} funnel={f} sources={data.sources} onInscritsClick={onInscritsClick} />
      ))}
    </section>
  );
}
```

- [ ] **Step 4 : ContactsPanel : filtre par tag contrôlé par la coquille**

Dans `components/admin/ContactsPanel.tsx` :

```tsx
export function ContactsPanel({ tag, onTagChange }: { tag: string; onTagChange: (tag: string) => void }) {
  const secret = useContext(AdminSecretContext);
  const [tags, setTags] = useState<string[]>([]);
  // ... états existants

  useEffect(() => {
    if (!secret) return;
    fetch("/api/admin/tags", { headers: { "x-admin-secret": secret } })
      .then((r) => r.json())
      .then((json) => setTags(json.ok ? json.data.tags : []))
      .catch(() => setTags([]));
  }, [secret]);

  useEffect(() => {
    if (!secret) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (tag) params.set("tag", tag);
    fetch(`/api/admin/contacts?${params}`, { headers: { "x-admin-secret": secret } })
    // ... suite inchangée
  }, [secret, search, tag, page]);
```

Dans `exportCsv`, ajouter `if (tag) params.set("tag", tag);`. Dans le formulaire, après le champ de recherche :

```tsx
        <select
          id="contacts-tag"
          aria-label="Filtrer par tag"
          value={tag}
          onChange={(e) => {
            setPage(1);
            onTagChange(e.target.value);
          }}
          style={inputStyle}
        >
          <option value="">Tous les tags</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
```

Si `tag` n'est pas dans `tags` (clic depuis Tunnels avant chargement), l'ajouter à la liste affichée : `const options = tag && !tags.includes(tag) ? [tag, ...tags] : tags;`. Messages : état vide avec tag : `Aucun contact avec le tag « ${tag} ».` ; compteur : ` avec le tag « ${tag} »`. Le `marginTop: "1.6rem"` de la section passe à 0 (la coquille gère l'espacement).

- [ ] **Step 5 : La page**

Remplacer `app/admin/page.tsx` :

```tsx
import config from "@/config";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = {
  title: "Admin : tunnels",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg-soft)" }}>
      <section className="container-tight" style={{ paddingTop: "3.5rem", paddingBottom: "4rem" }}>
        <span className="eyebrow">Tunnel maison</span>
        <h1 style={{ fontSize: "2.2rem", margin: "0.8rem 0 0.4rem" }}>Tableau de bord {config.business.name}</h1>
        <p style={{ color: "var(--color-ink-soft)", marginBottom: "2rem" }}>
          Pages, vues et inscrits par tunnel. Contacts filtrables par tag.
        </p>
        <AdminShell />
      </section>
    </main>
  );
}
```

Supprimer `components/admin/FunnelDashboard.tsx` (`git rm`). Dans `docs/design-system.md`, remplacer la ligne `components/admin/FunnelDashboard` par `components/admin/AdminShell` | Admin : secret, onglets Tunnels / Contacts / Ventes, période ; et ajouter `components/admin/FunnelsPanel` | Cartes par tunnel (pages, vues, inscrits, taux).

- [ ] **Step 6 : Vérifier dans le navigateur** (serveur local)

1. `npm run build` vert ; `grep -rn "secret=" app components` ne renvoie rien côté admin.
2. `/admin` : le secret saisi, l'onglet Tunnels s'ouvre avec 3 cartes ; demo 2 lignes, guides-sommet 12 lignes, historique 4 lignes ; chaque lien ouvre la bonne page dans un nouvel onglet ; l'adresse de l'onglet admin reste `/admin` sans `?secret=`.
3. Vues à 0 en local : Passage et Conv. affichent « · », pas `NaN` ni `Infinity`.
4. Clic sur un nombre d'inscrits : onglet Contacts, menu « Tag » positionné sur ce tag, liste filtrée (ou message « Aucun contact avec le tag … »).
5. Onglet Ventes : l'encart.
6. Panne simulée (clé PostHog fausse) : cartes affichées, vues « · », alerte PostHog sous chaque carte. Idem Supabase.
7. Largeur téléphone (DevTools 400 px) : pas de défilement horizontal de la page, le tableau défile dans sa carte.

- [ ] **Step 7 : Commit**

```bash
git add app/admin/page.tsx components/admin/ docs/design-system.md
git commit -m "feat(s07): admin à onglets, cartes par tunnel, filtre des contacts par tag, encart Ventes"
```

### Task 8 : Record de vérification local et documents

**Files:**
- Create: `docs/verif/s07-admin-tunnels.md`
- Modify: `docs/stories.md` (cases des critères prouvés en local)

- [ ] **Step 1 : Écrire le record** sur le modèle de `docs/verif/s03-optin.md` : pour chaque critère de la story, la commande, le code de sortie ou la capture décrite, la date. Marquer explicitement « À prouver en prod » pour les vues sur `pages.taskzen.fr` et le parcours test réel (tâche 9).

- [ ] **Step 2 : Cocher** dans `docs/stories.md` les critères prouvés en local (tous sauf le parcours test réel).

- [ ] **Step 3 : Commit**

```bash
git add docs/verif/s07-admin-tunnels.md docs/stories.md
git commit -m "docs(s07): record de vérification locale"
```

### Task 9 : Preuve réelle en prod (après push et déploiement par Delphine)

Gestes humains : Delphine pousse `feature/s07-admin-tunnels` fusionnée sur `main` (remote `delphine`) et déploie sur Vercel. Le DNS de `pages.taskzen.fr` doit répondre.

- [ ] **Step 1 : Vues.** Ouvrir 3 fois `https://pages.taskzen.fr/t/guides-sommet/inscription-quiz-reponse-ia` (fenêtre de navigation privée, 3 chargements). Attendre 2 minutes. Dans `/admin` en prod (secret saisi par Delphine ou par Claude dans Chrome, jamais dans l'adresse), période 7 jours : la ligne affiche 3 vues.
- [ ] **Step 2 : Inscrit.** Une seule inscription sur cette page avec `delphinemm03.ai@gmail.com` (adresse réelle, sans alias). Recharger `/admin` : 1 inscrit, conversion 33,3 %, clic sur « 1 » : Contacts filtré sur `guide-quiz-reponse-ia` avec cette seule ligne.
- [ ] **Step 3 : Protection en prod.** `curl -s -o /dev/null -w "%{http_code}\n" https://pages.taskzen.fr/api/admin/funnels` : 401 ; idem avec `?secret=x` : 401.
- [ ] **Step 4 : Nettoyage.** Avec l'accord explicite de Delphine, supprimer le contact de test (SQL de gestion, comme en s03) et noter l'état avant/après dans le record.
- [ ] **Step 5 : Compléter le record**, cocher le dernier critère, commit `docs(s07): preuve réelle en prod`.

## Run interdicts
- Diff vide sur les chemins listés dans Global Constraints. `lib/supabase.ts`, `lib/posthog-query.ts`, `lib/events.ts` : ajouts et signatures étendues seulement, aucune ligne existante supprimée hors celles citées.
- Aucune dépendance npm. Aucun push. Pas de cadratin.
- Aucune clé affichée ni copiée dans un fichier suivi par git. `.env.local` fourni par l'orchestrateur.
- Une seule inscription réelle (tâche 9), vers delphinemm03.ai@gmail.com, après accord.

## The point everything turns on
La route `/api/admin/funnels` doit toujours répondre 200 avec une structure complète, même quand PostHog ou Supabase tombe : la panne se lit dans `sources`, les nombres manquants valent `null`, et le client affiche « · ». Les trois endroits où ça peut se tromper :
1. Un `throw` qui remonte d'une source et renvoie 500 pour toute la page (chaque appel passe par `attempt`).
2. Un `0` confondu avec « inconnu » : 0 vue est un vrai chiffre, `null` est une panne ; ne jamais remplacer `null` par 0 côté client.
3. Le secret qui revient dans une adresse (fetch avec `?secret=`, pré-remplissage depuis l'URL) : `grep -rn "secret=" app components` doit rester vide.

## Files touched
- Nouveaux : `lib/admin-auth.ts`, `lib/admin-funnels.ts`, `types/admin.ts`, `app/api/admin/funnels/route.ts`, `app/api/admin/tags/route.ts`, `components/admin/AdminShell.tsx`, `components/admin/FunnelsPanel.tsx`, `components/admin/SalesPlaceholder.tsx`, `docs/verif/s07-admin-tunnels.md`.
- Modifiés : `lib/events.ts`, `lib/posthog-query.ts`, `lib/supabase.ts`, `components/funnel/PageView.tsx`, `app/t/[funnel]/[step]/page.tsx`, `app/api/admin/contacts/route.ts`, `app/api/funnel/stats/route.ts`, `components/admin/ContactsPanel.tsx`, `app/admin/page.tsx`, `docs/design-system.md`, `docs/stories.md`.
- Supprimé : `components/admin/FunnelDashboard.tsx`.

## Test strategy
Pas de runner. Filet : typage (`npm run build`, `tsc --noEmit`) ; curls déterministes contre le serveur local (401 sur les 4 routes, 400 sur la période, 200 avec `sources` en panne simulée) ; vérification visuelle en local (structure, liens, tirets, onglets, téléphone) ; une preuve réelle en prod (tâche 9) pour ce que le local ne peut pas prouver : les vues comptées sur l'hôte réel et l'inscription réelle.

## Definition of Done
- Les 8 critères de la story prouvés (record), build vert, diff vide sur les interdits, contact de test nettoyé avec accord, commits conventionnels sur `feature/s07-admin-tunnels`, aucun push par Claude.
