import { fetchRest, type Rest, type RestResponse } from "@/lib/store/supabase-store";
import type { SequenceRecord } from "@/lib/store/store";
import { sentKey, type Enrollee, type SequenceRepo } from "./engine";

const PAGE = 1000;

function must(r: RestResponse, label: string): Record<string, unknown>[] {
  if (r.status < 200 || r.status >= 300) {
    console.error(`[sequences] ${label} failed`, { status: r.status, body: r.body });
    throw new Error(`Supabase ${label} failed: ${r.status}`);
  }
  return Array.isArray(r.body) ? (r.body as Record<string, unknown>[]) : [];
}

export class SupabaseSequenceRepo implements SequenceRepo {
  constructor(private rest: Rest = fetchRest) {}

  private async all(path: string, query: Record<string, string>, label: string) {
    const out: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const rows = must(await this.rest({ method: "GET", path, query: { ...query, limit: String(PAGE), offset: String(offset) } }), label);
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }

  async listActive() {
    const rows = await this.all("tunnel_email_sequences", { select: "*", activated_at: "not.is.null", order: "created_at.asc,id.asc" }, "listActive");
    return rows as unknown as SequenceRecord[];
  }

  async enrollees(tag: string): Promise<Enrollee[]> {
    const rows = await this.all(
      "tunnel_contact_tags",
      {
        select: "created_at,contact_id,tunnel_contacts!inner(email,first_name,unsubscribed_at),tunnel_tags!inner(name)",
        "tunnel_tags.name": `eq.${tag}`,
        order: "created_at.asc,contact_id.asc",
      },
      "enrollees"
    );
    return rows.map((r) => {
      const c = r.tunnel_contacts as { email: string; first_name: string | null; unsubscribed_at: string | null };
      return { contactId: String(r.contact_id), email: c.email, firstName: c.first_name, unsubscribedAt: c.unsubscribed_at, enrolledAt: String(r.created_at) };
    });
  }

  async lastSaleByContact(contactIds: string[]) {
    const wanted = new Set(contactIds);
    const latest = new Map<string, string>();
    if (!wanted.size) return latest;
    const rows = await this.all("tunnel_sales", { select: "contact_id,created_at", order: "created_at.asc,id.asc" }, "lastSaleByContact");
    for (const r of rows) if (wanted.has(String(r.contact_id))) latest.set(String(r.contact_id), String(r.created_at));
    return latest;
  }

  async sentKeys(sequenceId: string) {
    const rows = await this.all("tunnel_sequence_sends", { select: "email_id,contact_id", sequence_id: `eq.${sequenceId}`, order: "email_id.asc,contact_id.asc" }, "sentKeys");
    return new Set(rows.map((r) => sentKey(String(r.email_id), String(r.contact_id))));
  }

  async claim(sequenceId: string, emailId: string, contactId: string) {
    const rows = must(
      await this.rest({
        method: "POST",
        path: "tunnel_sequence_sends",
        query: { on_conflict: "sequence_id,email_id,contact_id", select: "email_id" },
        body: [{ sequence_id: sequenceId, email_id: emailId, contact_id: contactId }],
        prefer: "resolution=ignore-duplicates,return=representation",
      }),
      "claim"
    );
    return rows.length > 0;
  }

  async release(sequenceId: string, emailId: string, contactId: string) {
    must(
      await this.rest({
        method: "DELETE",
        path: "tunnel_sequence_sends",
        query: { sequence_id: `eq.${sequenceId}`, email_id: `eq.${emailId}`, contact_id: `eq.${contactId}` },
        prefer: "return=minimal",
      }),
      "release"
    );
  }
}
