import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store/store";
import { NotConfiguredMailer } from "@/lib/mcp/tools";
import { handleRpc } from "@/lib/mcp/server";
import { authenticate } from "@/lib/mcp/auth";

export const dynamic = "force-dynamic";

/** Point d'entrée MCP (JSON-RPC 2.0 sur HTTP). */
export async function POST(req: NextRequest) {
  const caller = authenticate(req.headers);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = await req.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON invalide" } }, { status: 400 });
  }
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const ctx = { store: getStore(), mailer: new NotConfiguredMailer(), baseUrl };
  const res = await handleRpc(ctx, caller, body, Buffer.byteLength(raw));
  if (res === null) return new NextResponse(null, { status: 202 });
  return NextResponse.json(res);
}

export function GET() {
  return NextResponse.json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: "POST" } });
}
