// Cities reference book. Persisted in localStorage.
// Used in client forms, appointment forms, and reports.

export interface City {
  id: string;
  name: string;
  country: string;
  isActive: boolean;
}

const STORAGE_KEY = "babun2:settings:cities";

export const SEED_CITIES: City[] = [
  { id: "city-limassol",  name: "Лимассол",  country: "Cyprus", isActive: true },
  { id: "city-paphos",    name: "Пафос",     country: "Cyprus", isActive: true },
  { id: "city-larnaca",   name: "Ларнака",   country: "Cyprus", isActive: true },
  { id: "city-nicosia",   name: "Никосия",   country: "Cyprus", isActive: true },
  { id: "city-ayia-napa", name: "Айя-Напа",  country: "Cyprus", isActive: true },
];

export function loadCities(): City[] {
  if (typeof window === "undefined") return SEED_CITIES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_CITIES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_CITIES;
  } catch {
    return SEED_CITIES;
  }
}

export function saveCities(cities: City[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cities));
  } catch {
    // ignore quota errors
  }
}

export function generateCityId(): string {
  return `city-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getActiveCities(cities: City[]): City[] {
  return cities.filter((c) => c.isActive);
}
