import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getStore } from "@/lib/store";
import { authenticate } from "@/lib/mcp/auth";
import { patchPageFromEditor, readPageForEditor } from "@/lib/pages-api";
import { PageError } from "@/lib/page-format/ops";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authenticate(req.headers)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const res = await readPageForEditor(getStore(), (await params).id);
  return res ? NextResponse.json(res) : NextResponse.json({ error: "page_not_found" }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = authenticate(req.headers);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (caller.scope === "ro") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const body = await req.json();
    return NextResponse.json(await patchPageFromEditor(getStore(), (await params).id, body));
  } catch (e) {
    if (e instanceof PageError) return NextResponse.json({ error: e.code, message: e.message }, { status: e.code === "page_not_found" ? 404 : 409 });
    if (e instanceof ZodError) return NextResponse.json({ error: "invalid_changes", message: e.issues[0]?.message }, { status: 400 });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
