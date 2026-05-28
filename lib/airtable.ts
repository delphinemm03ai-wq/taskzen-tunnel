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
    "Created At": new Date().toISOString(),
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
