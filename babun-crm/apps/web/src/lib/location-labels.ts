// Location labels reference book (Дом / Квартира / Офис / Вилла / ...).
// Persisted in localStorage. Used for the preset chips in
// LocationsBlock when creating/editing a client's object.
//
// Single-tenant for now; when multi-tenant lands, prefix key with
// tenant id. Seed matches what was previously hard-coded.

export interface LocationLabel {
  id: string;
  name: string;
}

const STORAGE_KEY = "babun2:settings:location-labels";

export const SEED_LOCATION_LABELS: LocationLabel[] = [
  { id: "loclbl-house",    name: "Дом" },
  { id: "loclbl-flat",     name: "Квартира" },
  { id: "loclbl-office",   name: "Офис" },
  { id: "loclbl-villa",    name: "Вилла" },
];

export function loadLocationLabels(): LocationLabel[] {
  if (typeof window === "undefined") return SEED_LOCATION_LABELS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_LOCATION_LABELS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : SEED_LOCATION_LABELS;
  } catch {
    return SEED_LOCATION_LABELS;
  }
}

export function saveLocationLabels(labels: LocationLabel[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
  } catch {
    // ignore quota errors
  }
}

export function generateLocationLabelId(): string {
  return `loclbl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
