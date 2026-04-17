// Draft clients are minimal client records (name + phone) stored locally
// when a dispatcher creates an appointment for a new person without going
// through the full client form. They persist alongside real clients and
// are merged into lookups by id.

const DRAFT_CLIENTS_KEY = "babun-draft-clients";

export interface DraftClient {
  id: string;
  full_name: string;
  phone: string;
  telegram_username?: string;
  instagram_username?: string;
  // STORY-005: free-form dispatcher note (language, preferences).
  comment?: string;
  // Legacy fields — kept optional so draft records written before
  // STORY-005 still load cleanly. The UI no longer collects them;
  // address and A/C unit count live on each appointment's location.
  city?: string;
  address?: string;
  ac_units?: number;
}

export function loadDraftClients(): DraftClient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFT_CLIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDraftClients(list: DraftClient[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_CLIENTS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function upsertDraftClient(draft: DraftClient): void {
  const existing = loadDraftClients();
  const next = existing.filter((d) => d.id !== draft.id);
  next.push(draft);
  saveDraftClients(next);
  // STORY-006: notify subscribers that the draft list changed so
  // callers don't have to wait for an appointments-level refresh to
  // re-read localStorage. Without this, a freshly-created draft
  // reaches the sheet only after the first save.
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("babun:drafts-changed"));
  }
}
