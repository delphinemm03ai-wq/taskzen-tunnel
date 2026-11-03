"use client";

import { AdminGate } from "./AdminGate";
import { PageEditor } from "./PageEditor";
import { TunnelsDashboard } from "./TunnelsDashboard";

export function EditorRoute({ pageId }: { pageId: string }) {
  return <AdminGate>{(secret) => <PageEditor pageId={pageId} secret={secret} />}</AdminGate>;
}

export function TunnelsRoute() {
  return <AdminGate>{(secret) => <TunnelsDashboard secret={secret} />}</AdminGate>;
}
