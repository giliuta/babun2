// Lightweight analytics for the clients page — Sprint clients-99 (F4.9).
//
// MVP: events are buffered into localStorage so a future job (or the
// existing Telegram error channel) can pick them up. No PII is sent —
// the payload is whitelisted to plain primitives, never a full Client
// record. When a real analytics sink is wired up, replace `flush()`
// with a network call; the rest of the codebase needs no changes.

const BUFFER_KEY = "babun-analytics-buffer";
const MAX_BUFFER = 500; // hard cap so we never grow unbounded

export type AnalyticsEvent =
  | "clients.page_view"
  | "clients.add_button_click"
  | "clients.add_button_quota_block"
  | "clients.search"
  | "clients.filter_segment"
  | "clients.sort_change"
  | "clients.export_csv"
  | "clients.import_started"
  | "clients.import_completed"
  | "clients.bulk_sms_sent"
  | "clients.bulk_delete"
  | "clients.client_deleted"
  | "clients.client_restored"
  | "clients.gdpr_export"
  | "clients.duplicate_blocked";

type Props = Record<string, string | number | boolean | null | undefined>;

interface BufferedEvent {
  event: AnalyticsEvent;
  props: Props;
  at: string; // ISO timestamp
}

function readBuffer(): BufferedEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBuffer(events: BufferedEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = events.slice(-MAX_BUFFER);
    window.localStorage.setItem(BUFFER_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded → drop on the floor; analytics must never break the app.
  }
}

/**
 * Record a single event. Cheap (<1ms) — safe to call on hot paths
 * like keystrokes (search). Caller is responsible for debouncing if
 * needed.
 */
export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (typeof window === "undefined") return;
  // In dev, also log to console so it shows up in the browser without
  // having to inspect localStorage.
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.debug("[analytics]", event, props);
  }
  const buf = readBuffer();
  buf.push({ event, props, at: new Date().toISOString() });
  writeBuffer(buf);
}

/**
 * Drain the buffer — used by a future cron / page-leave handler that
 * uploads events to a server. Returns the events that were drained so
 * the caller can re-buffer on network failure.
 */
export function drain(): BufferedEvent[] {
  const buf = readBuffer();
  writeBuffer([]);
  return buf;
}

/** Read the current buffer without clearing it. Used by debug UIs. */
export function peek(): BufferedEvent[] {
  return readBuffer();
}
