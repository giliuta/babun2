// Location labels reference book (Дом / Квартира / Офис / Вилла / ...).
// Persisted in localStorage. Used for the preset chips in
// LocationsBlock when creating/editing a client's object.
//
// Single-tenant for now; when multi-tenant lands, prefix key with
// tenant id. Seed matches what was previously hard-coded.

import { getStorage } from "../storage/provider";

export interface LocationLabel {
  id: string;
  name: string;
}

const STORAGE_KEY = "babun2:settings:location-labels";

// STORY-078 leak fix — labels Дом / Квартира / Офис / Вилла are
// HVAC/cleaning-flavoured. Beauty / auto-service tenants don't need
// them. Default empty; preset kept exposed for the vertical-driven
// onboarding seed (future story).
export const SEED_LOCATION_LABELS: LocationLabel[] = [];

export const HOME_SERVICE_LABELS_PRESET: LocationLabel[] = [
  { id: "loclbl-house",    name: "Дом" },
  { id: "loclbl-flat",     name: "Квартира" },
  { id: "loclbl-office",   name: "Офис" },
  { id: "loclbl-villa",    name: "Вилла" },
];

export function loadLocationLabels(): LocationLabel[] {
  const parsed = getStorage().get<LocationLabel[]>(STORAGE_KEY);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveLocationLabels(labels: LocationLabel[]): void {
  getStorage().set(STORAGE_KEY, labels);
}

export function generateLocationLabelId(): string {
  return `loclbl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
