// v598 §4.4 — Local activity log.
//
// In-memory + localStorage ring buffer of writes the user performed
// from this device. Used by /dashboard/audit to answer questions
// like «did I really delete that?» or «when did I last touch this
// client?» without round-tripping a server.
//
// Scope is intentionally per-device. A future commit can lift the
// log to Supabase (one row per entry, audit_log table) so other
// users in the same tenant see the same trail, but the per-device
// version is the cheapest 80% of the value: 99% of «wait did I do
// that?» questions are about the dispatcher's own recent actions.
//
// Capacity: 500 entries. Above that the oldest entries fall off
// the buffer so the localStorage payload stays bounded (~80 kB).

const STORAGE_KEY = "babun:audit-log";
const MAX_ENTRIES = 500;

export type AuditEntityKind =
  | "appointment"
  | "client"
  | "service"
  | "master"
  | "team"
  | "expense"
  | "income"
  | "settings";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "status_change"
  | "import"
  | "export";

export interface AuditEntry {
  /** ISO timestamp. */
  ts: string;
  entity: AuditEntityKind;
  action: AuditAction;
  /** Free-text summary the dispatcher reads. */
  summary: string;
  /** Optional record id so the UI can deep-link. */
  entityId?: string;
}

function readBuffer(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as AuditEntry[];
  } catch {
    return [];
  }
}

function writeBuffer(entries: AuditEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent("babun:audit-log-changed"));
  } catch {
    /* quota or private mode */
  }
}

/** Append a single entry. Caller doesn't pass `ts` — we stamp it
 *  here so every log line uses the same wall clock. */
export function logAudit(entry: Omit<AuditEntry, "ts">): void {
  const next: AuditEntry = { ...entry, ts: new Date().toISOString() };
  const buf = readBuffer();
  buf.unshift(next);
  if (buf.length > MAX_ENTRIES) buf.length = MAX_ENTRIES;
  writeBuffer(buf);
}

/** Returns entries newest-first. */
export function loadAuditLog(): AuditEntry[] {
  return readBuffer();
}

/** Wipes the local log. UI exposes this behind a confirm prompt. */
export function clearAuditLog(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("babun:audit-log-changed"));
  } catch {
    /* swallow */
  }
}
