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
  city?: string;
  // When a dispatcher creates a draft from the appointment sheet, they
  // usually already know the visit address and roughly how many A/C
  // units are on-site. Storing these here saves re-asking later when
  // the draft is promoted to a full Client record.
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
}
