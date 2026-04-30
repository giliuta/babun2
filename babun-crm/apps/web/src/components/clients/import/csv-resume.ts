// STORY-046 — Tab-close / network-drop resume support.
//
// Persists the in-flight import position so the user can continue a
// half-imported file after an accidental close. NOT auto-resume — the
// /dashboard/clients page surfaces a toast with three buttons:
// Продолжить / Начать заново / Игнорировать. The user picks.

const STORAGE_KEY = "babun:import:active";
const TTL_MS = 60 * 60 * 1000; // 1 hour

export interface ImportResumeState {
  fileHash: string;
  fileName: string;
  totalRows: number;
  importedRows: number;
  totalBatches: number;
  lastBatchIndex: number;
  /** Unix epoch ms. */
  timestamp: number;
}

export function loadResumeState(): ImportResumeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImportResumeState;
    if (typeof parsed.fileHash !== "string") return null;
    if (typeof parsed.timestamp !== "number") return null;
    if (Date.now() - parsed.timestamp > TTL_MS) {
      // Auto-prune stale entries on read so the toast never fires for
      // forgotten imports older than the TTL.
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveResumeState(state: ImportResumeState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors — resume is a nice-to-have
  }
}

export function clearResumeState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
