import { applyChanges, PageError } from "@/lib/page-format/ops";
import { StoreConflictError, type Store } from "@/lib/store/store";

/**
 * Lecture et modification d'une page pour l'éditeur visuel (X7).
 * Mêmes opérations (applyChanges) et même format que l'outil MCP update_page :
 * l'éditeur et l'IA travaillent sur la même description.
 */
export async function readPageForEditor(store: Store, pageId: string) {
  const rec = await store.getPage(pageId);
  return rec ? { page_id: pageId, version: rec.version, status: rec.status, page: rec.page } : null;
}

export async function patchPageFromEditor(store: Store, pageId: string, body: { changes: unknown; expected_version?: number }) {
  const rec = await store.getPage(pageId);
  if (!rec) throw new PageError("page_not_found", `Page introuvable : ${pageId}`);
  if (body.expected_version !== undefined && body.expected_version !== rec.version) {
    throw new PageError("version_conflict", `La page est en version ${rec.version}.`);
  }
  const { page, applied } = applyChanges(rec.page, body.changes);
  const readVersion = rec.version;
  rec.page = page;
  rec.version += 1;
  rec.updatedAt = new Date().toISOString();
  try {
    await store.putPage(pageId, rec, { expectedVersion: readVersion });
  } catch (e) {
    if (e instanceof StoreConflictError) throw new PageError("version_conflict", "La page a changé entre-temps.");
    throw e;
  }
  return { page_id: pageId, version: rec.version, applied };
}
