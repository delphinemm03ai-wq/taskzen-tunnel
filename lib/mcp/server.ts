import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { PageError } from "@/lib/page-format/ops";
import { checkRateLimit } from "@/lib/rate-limit";
import { TOOL_META, ToolContext, ToolError, ToolName, handlers, schemas } from "./tools";

export const MCP_PROTOCOL_VERSION = "2025-03-26";
export const RATE_LIMIT_PER_MINUTE = 60; // valeur proposée par le cahier des charges (F34), à confirmer

export interface CallerKey {
  id: string;
  scope: "rw" | "ro";
}

/**
 * Clés lues dans la variable d'environnement TUNNEL_MCP_KEYS, format "id:secret:rw,id2:secret2:ro".
 * Les clés multiples révocables avec expiration (F34) ne sont pas faites au lot 1.
 */
export function parseKeys(raw: string | undefined): { id: string; secret: string; scope: "rw" | "ro" }[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => p.trim().split(":"))
    .filter((p) => p.length >= 2 && p[0] && p[1])
    .map(([id, secret, scope]) => ({ id, secret, scope: scope === "ro" ? "ro" : "rw" }));
}

export function toolList() {
  return (Object.keys(schemas) as ToolName[]).map((name) => ({
    name,
    description: TOOL_META[name].description,
    inputSchema: zodToJsonSchema(schemas[name], { target: "jsonSchema7", $refStrategy: "root" }),
  }));
}

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };
type RpcResponse = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const rpcError = (id: RpcRequest["id"], code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

function zodMessage(e: z.ZodError): string {
  const i = e.issues[0];
  return `${i.path.join(".") || "demande"} : ${i.message}`;
}

/** Traite une requête JSON-RPC. Retourne null pour une notification (aucune réponse attendue). */
export async function handleRpc(ctx: ToolContext, caller: CallerKey, req: RpcRequest, rawBytes: number): Promise<RpcResponse | null> {
  if (req.id === undefined) return null;
  switch (req.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id: req.id,
        result: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: "taskzen-tunnel", version: "0.1.0" } },
      };
    case "ping":
      return { jsonrpc: "2.0", id: req.id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id: req.id, result: { tools: toolList() } };
    case "tools/call":
      return { jsonrpc: "2.0", id: req.id, result: await callTool(ctx, caller, req.params ?? {}, rawBytes) };
    default:
      return rpcError(req.id, -32601, `Méthode inconnue : ${req.method}`);
  }
}

async function callTool(ctx: ToolContext, caller: CallerKey, params: Record<string, unknown>, rawBytes: number) {
  const name = params.name as ToolName;
  const out = (payload: unknown, isError: boolean) => {
    const text = JSON.stringify(payload);
    ctx.store.logCall({ at: new Date().toISOString(), keyId: caller.id, tool: String(name), requestBytes: rawBytes, responseBytes: Buffer.byteLength(text), ok: !isError }).catch((e) => console.error("[mcp] journal des appels indisponible :", e instanceof Error ? e.message : e));
    return { content: [{ type: "text", text }], isError };
  };

  if (!(name in schemas)) return out({ error: "unknown_tool", message: `Outil inconnu : ${String(name)}` }, true);
  if (TOOL_META[name].write && caller.scope === "ro") {
    return out({ error: "forbidden", message: "Cette clé est en lecture seule." }, true);
  }
  if (!checkRateLimit(`mcp:${caller.id}`, { limit: RATE_LIMIT_PER_MINUTE, windowSeconds: 60 }).allowed) {
    return out({ error: "rate_limited", message: `Limite de ${RATE_LIMIT_PER_MINUTE} appels par minute atteinte. Réessaie dans une minute.` }, true);
  }
  const parsed = schemas[name].safeParse(params.arguments ?? {});
  if (!parsed.success) return out({ error: "invalid_arguments", message: zodMessage(parsed.error) }, true);

  try {
    const result = await (handlers[name] as (c: ToolContext, a: unknown) => Promise<unknown>)(ctx, parsed.data);
    return out(result, false);
  } catch (e) {
    if (e instanceof ToolError || e instanceof PageError) return out({ error: e.code, message: e.message }, true);
    if (e instanceof z.ZodError) return out({ error: "invalid_arguments", message: zodMessage(e) }, true);
    return out({ error: "internal_error", message: "Erreur interne." }, true);
  }
}
