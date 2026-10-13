/**
 * Assemblage de l'onglet Tunnels : structure lue dans la config (funnels/),
 * vues PostHog (une requête groupée), inscrits Supabase (un comptage par tag,
 * sur la même période que les vues). Une source en panne donne des `null` et
 * un statut « indisponible », jamais une erreur : la page reste utilisable.
 */

import { allFunnels } from "@/funnels";
import type { FunnelConfig, FunnelStep } from "@/types/funnel";
import type { AdminFunnel, AdminFunnelsData, AdminPeriode, AdminStep, SourceStatus } from "@/types/admin";
import { countContactsPerTag, isSupabaseConfigured } from "@/lib/supabase";
import { countEvent, countStepViews, isPostHogQueryConfigured } from "@/lib/posthog-query";
import { FUNNEL_EVENTS, type FunnelEvent } from "@/lib/events";

/** Pages de juillet : chemin, titre, événement de vue, événement d'inscription (landing seulement). */
const HISTORIQUE: {
  slug: string;
  nom: string;
  etapes: ReadonlyArray<{ slug: string; path: string; titre: string; vue: FunnelEvent; inscription: FunnelEvent | null }>;
} = {
  slug: "methode-ia",
  nom: "Tunnel Méthode IA (pages historiques)",
  etapes: [
    { slug: "accueil", path: "/", titre: "Accueil", vue: FUNNEL_EVENTS.LANDING_VIEW, inscription: FUNNEL_EVENTS.LEAD_SIGNUP },
    { slug: "ressource", path: "/ressource", titre: "Ressource", vue: FUNNEL_EVENTS.RESOURCE_VIEW, inscription: null },
    { slug: "reserver", path: "/reserver", titre: "Réservation", vue: FUNNEL_EVENTS.BOOKING_VIEW, inscription: null },
    { slug: "merci", path: "/merci", titre: "Merci", vue: FUNNEL_EVENTS.BOOKING_COMPLETED, inscription: null },
  ],
};

/** Tag du premier bloc optin de l'étape, ou null. */
function optinTag(step: FunnelStep): string | null {
  for (const bloc of step.blocs) {
    if (bloc.type === "optin") return bloc.tag;
  }
  return null;
}

/**
 * Pour chaque étape, les étapes du même tunnel qui y mènent : etapeSuivante
 * d'un opt-in, ou href d'un CTA vers /t/<tunnel>/<etape>. Une page d'inscription
 * parallèle (guides du sommet) n'a donc pas de page amont, et la page merci a
 * les onze. C'est ce qui donne un taux de passage honnête.
 */
function predecessors(funnel: FunnelConfig): Map<string, string[]> {
  const amont = new Map<string, string[]>();
  const prefix = `/t/${funnel.slug}/`;
  for (const step of funnel.etapes) {
    const cibles = new Set<string>();
    for (const bloc of step.blocs) {
      if (bloc.type === "optin") cibles.add(bloc.etapeSuivante);
      if (bloc.type === "cta" && bloc.href.startsWith(prefix)) cibles.add(bloc.href.slice(prefix.length).split(/[?#]/)[0]);
    }
    for (const cible of cibles) {
      if (cible === step.slug) continue;
      amont.set(cible, [...(amont.get(cible) ?? []), step.slug]);
    }
  }
  return amont;
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

export async function buildAdminFunnels(origin: string, periode: AdminPeriode): Promise<AdminFunnelsData> {
  const posthogOn = isPostHogQueryConfigured();
  const supabaseOn = isSupabaseConfigured();
  const since = new Date(Date.now() - periode * 86_400_000).toISOString();

  // Une seule requête PostHog pour toutes les étapes du moteur, une seule
  // lecture Supabase pour tous les tags : une panne reste une panne isolée.
  const stepViews = posthogOn ? await attempt("countStepViews", () => countStepViews(periode)) : null;
  const posthog: SourceStatus = stepViews ? "ok" : "indisponible";

  const tagCounts = supabaseOn ? await attempt("countContactsPerTag", () => countContactsPerTag(since)) : null;
  const supabase: SourceStatus = tagCounts ? "ok" : "indisponible";

  const tunnels: AdminFunnel[] = allFunnels.map((funnel) => {
    const merci = thankYouSlugs(funnel);
    const amont = predecessors(funnel);
    const vuesDe = (slug: string): number | null => (stepViews ? (stepViews.get(`${funnel.slug}/${slug}`) ?? 0) : null);
    const etapes: AdminStep[] = funnel.etapes.map((step) => {
      const tag = optinTag(step);
      const sources = amont.get(step.slug) ?? [];
      return {
        slug: step.slug,
        titre: step.titre,
        url: `${origin}/t/${funnel.slug}/${step.slug}`,
        tag,
        remerciement: merci.has(step.slug),
        vues: vuesDe(step.slug),
        vuesAmont: sources.length ? sum(sources.map(vuesDe)) : null,
        inscrits: tag ? (tagCounts ? (tagCounts.get(tag) ?? 0) : null) : null,
      };
    });
    const optins = etapes.filter((e) => e.tag !== null);
    return {
      slug: funnel.slug,
      nom: funnel.nom,
      historique: false,
      inscrits: optins.length ? sum(optins.map((e) => e.inscrits)) : null,
      vues: sum(etapes.map((e) => e.vues)),
      etapes,
    };
  });

  // Carte historique : événements nommés, comptés un par un (même période), pages en séquence.
  // Inscrits = événement lead_signup (ces pages écrivent dans Airtable, pas dans Supabase).
  const histoVues = await Promise.all(
    HISTORIQUE.etapes.map((e) => (posthogOn ? attempt(`countEvent(${e.vue})`, () => countEvent(e.vue, periode)) : null))
  );
  const histoInscrits = await Promise.all(
    HISTORIQUE.etapes.map((e) =>
      e.inscription && posthogOn ? attempt(`countEvent(${e.inscription})`, () => countEvent(e.inscription as FunnelEvent, periode)) : null
    )
  );
  const histo: AdminStep[] = HISTORIQUE.etapes.map((e, i) => ({
    slug: e.slug,
    titre: e.titre,
    url: `${origin}${e.path}`,
    tag: null,
    remerciement: false,
    vues: histoVues[i] ?? null,
    vuesAmont: i > 0 ? (histoVues[i - 1] ?? null) : null,
    inscrits: histoInscrits[i] ?? null,
  }));
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
