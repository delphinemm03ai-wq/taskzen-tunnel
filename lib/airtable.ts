/**
 * Airtable — CRM des leads du tunnel.
 *
 * Si les variables d'env ne sont pas configurées, isAirtableConfigured()
 * renvoie false : le tunnel passe alors en mode démo (le lead est loggé,
 * pas stocké). Lance /onboarding pour configurer Airtable.
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || "Leads";

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
  AIRTABLE_TABLE_ID
)}`;

export function isAirtableConfigured(): boolean {
  return Boolean(AIRTABLE_API_KEY && AIRTABLE_BASE_ID);
}

function headers() {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
}

export interface LeadFields {
  Email: string;
  Prenom?: string;
  Statut?: string;
  Source?: string;
  "UTM Source"?: string;
  "UTM Medium"?: string;
  "UTM Campaign"?: string;
}

export async function findLeadByEmail(
  email: string
): Promise<AirtableRecord | null> {
  const safeEmail = email.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const formula = encodeURIComponent(`{Email} = "${safeEmail}"`);
  const res = await fetch(`${BASE_URL}?filterByFormula=${formula}&maxRecords=1`, {
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Airtable findLeadByEmail failed: ${res.status}`);
  }

  const data: AirtableResponse = await res.json();
  return data.records[0] || null;
}

export async function createLead(fields: LeadFields): Promise<AirtableRecord> {
  const allFields: Record<string, unknown> = {
    ...fields,
    Statut: fields.Statut ?? "optin",
    // Champ Airtable de type "date" (sans heure) : n'accepte que YYYY-MM-DD.
    "Created At": new Date().toISOString().slice(0, 10),
  };

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ records: [{ fields: allFields }] }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Airtable] createLead failed", { status: res.status, body: text });
    throw new Error(`Airtable createLead failed: ${res.status}`);
  }

  const data: AirtableResponse = await res.json();
  return data.records[0];
}

export async function updateLead(
  recordId: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  const res = await fetch(BASE_URL, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ records: [{ id: recordId, fields }] }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Airtable] updateLead failed", { status: res.status, body: text });
    throw new Error(`Airtable updateLead failed: ${res.status}`);
  }

  const data: AirtableResponse = await res.json();
  return data.records[0];
}

/**
 * Leads en statut "optin" (pas encore réservé) pour la séquence de relance
 * J+2 / J+4 / J+7. Champs "Relance J2/J4/J7 envoyée" (checkbox) évitent les
 * doublons d'envoi. "Statut" doit passer à autre chose que "optin" dès qu'un
 * lead réserve, pour sortir automatiquement de la séquence (voir note dans
 * memory/funnel/sequence-emails-relance.md : pas encore de webhook Cal.com,
 * mise à jour manuelle du Statut en attendant).
 */
export interface FollowupLead {
  id: string;
  email: string;
  firstName?: string;
  createdAt: string;
  relanceJ2Sent: boolean;
  relanceJ4Sent: boolean;
  relanceJ7Sent: boolean;
}

export async function listLeadsForFollowup(): Promise<FollowupLead[]> {
  const formula = encodeURIComponent(`{Statut} = "optin"`);
  const leads: FollowupLead[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(BASE_URL);
    url.searchParams.set("filterByFormula", formula);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), { headers: headers() });
    if (!res.ok) {
      throw new Error(`Airtable listLeadsForFollowup failed: ${res.status}`);
    }

    const data: AirtableResponse & { offset?: string } = await res.json();
    for (const record of data.records) {
      const createdAt = record.fields["Created At"];
      if (typeof createdAt !== "string") continue;
      leads.push({
        id: record.id,
        email: String(record.fields.Email ?? ""),
        firstName: record.fields.Prenom ? String(record.fields.Prenom) : undefined,
        createdAt,
        relanceJ2Sent: Boolean(record.fields["Relance J2 envoyee"]),
        relanceJ4Sent: Boolean(record.fields["Relance J4 envoyee"]),
        relanceJ7Sent: Boolean(record.fields["Relance J7 envoyee"]),
      });
    }
    offset = data.offset;
  } while (offset);

  return leads;
}

export async function markFollowupSent(
  recordId: string,
  stage: "j2" | "j4" | "j7"
): Promise<void> {
  const field =
    stage === "j2"
      ? "Relance J2 envoyee"
      : stage === "j4"
        ? "Relance J4 envoyee"
        : "Relance J7 envoyee";
  await updateLead(recordId, { [field]: true });
}
