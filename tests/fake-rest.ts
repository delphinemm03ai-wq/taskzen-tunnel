import type { Rest, RestRequest, RestResponse } from "@/lib/store/supabase-store";

type Row = Record<string, unknown>;

/**
 * Faux PostgREST en mémoire, juste ce qu'il faut pour le magasin : filtres eq., upsert, insertion avec 409,
 * PATCH filtré, DELETE, et la fonction tunnel_create_funnel (transaction : tout ou rien).
 * Aucun réseau. L'atomicité réelle repose sur la fonction SQL de la migration 004, non exécutée ici.
 */
export class FakeRest {
  tables: Record<string, Row[]> = { tunnel_pages: [], tunnel_funnels: [], tunnel_email_sequences: [], tunnel_mcp_calls: [], tunnel_contacts: [], tunnel_tags: [], tunnel_contact_tags: [] };
  requests: RestRequest[] = [];
  /** Simule une erreur SQL à l'insertion de la n-ième page dans tunnel_create_funnel. */
  failOnPageIndex: number | null = null;
  private seq = 0;

  private unique: Record<string, string[]> = {
    tunnel_pages: ["id"], tunnel_funnels: ["id", "slug"], tunnel_email_sequences: ["id"], tunnel_contacts: ["email"], tunnel_tags: ["name"],
  };

  rest: Rest = async (req) => {
    this.requests.push(structuredClone(req));
    const t = req.path.startsWith("rpc/") ? null : req.path;
    if (req.path === "rpc/tunnel_create_funnel") return this.createFunnel(req.body as { bundle: Row });
    if (!t || !this.tables[t]) return { status: 404, body: { message: "table inconnue" } };
    const rows = this.tables[t];
    const filters = Object.entries(req.query ?? {}).filter(([, v]) => v.startsWith("eq."));
    const match = (r: Row) => filters.every(([k, v]) => String(r[k]) === v.slice(3));

    switch (req.method) {
      case "GET": {
        let out = rows.filter(match);
        const limit = req.query?.limit ? Number(req.query.limit) : undefined;
        if (limit) out = out.slice(0, limit);
        return { status: 200, body: structuredClone(out) };
      }
      case "POST": {
        const incoming = req.body as Row[];
        const onConflict = req.query?.on_conflict;
        const merge = req.prefer?.includes("merge-duplicates");
        const ignore = req.prefer?.includes("ignore-duplicates");
        const returned: Row[] = [];
        for (const row of incoming) {
          const keys = onConflict ? onConflict.split(",") : null;
          const existing = keys ? rows.find((r) => keys.every((k) => r[k] === row[k])) : undefined;
          if (existing && merge) Object.assign(existing, row);
          else if (existing && ignore) continue;
          else {
            if (this.violates(t, row)) return { status: 409, body: { code: "23505" } };
            const stored = { ...row, ...(t === "tunnel_contacts" || t === "tunnel_tags" ? { id: row.id ?? `${t}-${++this.seq}` } : {}) };
            rows.push(stored);
          }
          returned.push(structuredClone(rows.find((r) => (keys ?? ["id"]).every((k) => r[k] === row[k])) ?? row));
        }
        return { status: 201, body: req.prefer?.includes("return=representation") ? returned : null };
      }
      case "PATCH": {
        const hit = rows.filter(match);
        for (const r of hit) Object.assign(r, req.body as Row);
        return { status: 200, body: req.prefer?.includes("return=representation") ? structuredClone(hit) : null };
      }
      case "DELETE":
        this.tables[t] = rows.filter((r) => !match(r));
        return { status: 204, body: null };
    }
  };

  private violates(t: string, row: Row): boolean {
    return (this.unique[t] ?? []).some((col) => this.tables[t].some((r) => r[col] !== undefined && r[col] === row[col]));
  }

  private createFunnel(req: { bundle: Row }): RestResponse {
    const snapshot = structuredClone(this.tables);
    const b = req.bundle as { funnel: Row; pages: Row[]; sequence: Row | null };
    const rollback = (status: number): RestResponse => {
      this.tables = snapshot;
      return { status, body: { message: "transaction annulée" } };
    };
    if (this.violates("tunnel_funnels", b.funnel)) return rollback(409);
    this.tables.tunnel_funnels.push(structuredClone(b.funnel));
    for (const [i, p] of b.pages.entries()) {
      if (this.failOnPageIndex === i) return rollback(500);
      if (this.violates("tunnel_pages", p)) return rollback(409);
      this.tables.tunnel_pages.push(structuredClone(p));
    }
    if (b.sequence) this.tables.tunnel_email_sequences.push(structuredClone(b.sequence));
    return { status: 204, body: null };
  }
}
