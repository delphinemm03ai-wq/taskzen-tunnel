import type { Page } from "@/lib/page-format/schema";
import { applyChanges, type Change } from "@/lib/page-format/ops";
import { diffPages, rebaseOps, samePage } from "./diff";

/** Nombre d'actions annulables (valeur proposée par le cahier des charges, F02). */
export const MAX_UNDO = 20;
/** Des frappes successives dans le même champ, à moins d'une seconde, comptent pour une seule action. */
export const COALESCE_MS = 1000;

export interface EditorState {
  /** Page affichée et modifiée. */
  page: Page;
  /** Dernière page connue du serveur (base de comparaison pour l'enregistrement). */
  saved: Page;
  /** Version du serveur correspondant à `saved`. */
  version: number;
  undo: Page[];
  redo: Page[];
  lastKey?: string;
  lastAt?: number;
}

export function initState(page: Page, version: number): EditorState {
  return { page, saved: page, version, undo: [], redo: [] };
}

export function isDirty(s: EditorState): boolean {
  return !samePage(s.page, s.saved);
}

/** Applique une édition (mêmes opérations que le serveur d'outils). `key` regroupe les frappes d'un même champ. */
export function edit(s: EditorState, changes: Change[], opts: { key?: string; now: number }): EditorState {
  const next = applyChanges(s.page, changes).page;
  const coalesce = opts.key !== undefined && s.lastKey === opts.key && s.lastAt !== undefined && opts.now - s.lastAt < COALESCE_MS && s.undo.length > 0;
  const undo = coalesce ? s.undo : [...s.undo, s.page].slice(-MAX_UNDO);
  return { ...s, page: next, undo, redo: [], lastKey: opts.key, lastAt: opts.now };
}

export function undo(s: EditorState): EditorState {
  const prev = s.undo[s.undo.length - 1];
  if (!prev) return s;
  return { ...s, page: prev, undo: s.undo.slice(0, -1), redo: [...s.redo, s.page], lastKey: undefined, lastAt: undefined };
}

export function redo(s: EditorState): EditorState {
  const nextPage = s.redo[s.redo.length - 1];
  if (!nextPage) return s;
  return { ...s, page: nextPage, redo: s.redo.slice(0, -1), undo: [...s.undo, s.page].slice(-MAX_UNDO), lastKey: undefined, lastAt: undefined };
}

/** Opérations à envoyer au serveur pour enregistrer (rien si rien n'a changé). */
export function pendingOps(s: EditorState): Change[] {
  return diffPages(s.saved, s.page);
}

/** Le serveur a accepté `sent` et répond avec la nouvelle version. L'historique est conservé. */
export function markSaved(s: EditorState, sent: Page, version: number): EditorState {
  return { ...s, saved: sent, version };
}

export interface RebaseResult {
  state: EditorState;
  /** true : les modifications locales ont été reportées sur la version du serveur. false : elles n'ont pas pu l'être et sont abandonnées. */
  kept: boolean;
  /** true : il y avait des modifications locales non enregistrées. */
  hadLocalChanges: boolean;
}

/**
 * Conflit de version : le serveur (par exemple l'IA) a modifié la page entre-temps.
 * On repart de la version du serveur sans l'écraser, puis on rejoue par-dessus les modifications locales non enregistrées.
 */
export function rebaseOnServer(s: EditorState, serverPage: Page, serverVersion: number): RebaseResult {
  const local = pendingOps(s);
  const rebased = rebaseOps(serverPage, local);
  const base = initState(rebased ?? serverPage, serverVersion);
  return {
    state: { ...base, saved: serverPage },
    kept: rebased !== null,
    hadLocalChanges: local.length > 0,
  };
}
