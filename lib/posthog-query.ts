/**
 * Requêtes HogQL vers PostHog pour le dashboard admin.
 * Nécessite POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID (côté serveur).
 */

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

interface HogQLResult {
  results: Array<Array<string | number | null>>;
  columns: string[];
  error?: string | null;
}

export function isPostHogQueryConfigured(): boolean {
  return Boolean(process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID);
}

/** Exclut le trafic dev/preview des comptages analytiques. */
const PROD_HOST_FILTER = `
  AND properties.$host NOT LIKE '%localhost%'
  AND properties.$host NOT LIKE '%127.0.0.1%'
  AND properties.$host NOT LIKE '%vercel.app%'
`;

async function queryHogQL(sql: string): Promise<HogQLResult> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY!;
  const projectId = process.env.POSTHOG_PROJECT_ID!;

  const res = await fetch(`${POSTHOG_HOST}/api/projects/${projectId}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: sql } }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API error: ${res.status} ${text.slice(0, 200)}`);
  }

  const json: HogQLResult = await res.json();
  if (json.error) throw new Error(`PostHog HogQL error: ${json.error}`);
  return json;
}

/** Compte les occurrences d'un event sur les `days` derniers jours. */
export async function countEvent(eventName: string, days: number): Promise<number> {
  const safeEvent = eventName.replace(/'/g, "''");
  const sql = `
    SELECT count() AS c
    FROM events
    WHERE event = '${safeEvent}'
      AND timestamp > now() - INTERVAL ${days} DAY
      ${PROD_HOST_FILTER}
  `;
  const result = await queryHogQL(sql);
  const value = result.results?.[0]?.[0];
  return typeof value === "number" ? value : 0;
}
