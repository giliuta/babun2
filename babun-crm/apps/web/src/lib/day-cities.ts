// Per-team per-date city overrides. When a brigade is working in a
// non-default city on a given day, the dispatcher assigns it via the
// calendar day header. Keys are "<teamId>:<YYYY-MM-DD>".

const STORAGE_KEY = "babun-day-cities";

export type DayCityMap = Record<string, string>;

export function loadDayCities(): DayCityMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as DayCityMap;
    }
    return {};
  } catch {
    return {};
  }
}

export function saveDayCities(map: DayCityMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function dayCityKey(teamId: string, dateKey: string): string {
  return `${teamId}:${dateKey}`;
}

// Returns the assigned city for this team+date, or an empty string if
// none. Callers should fall back to the team's default_city when empty.
export function getDayCity(
  map: DayCityMap,
  teamId: string | null,
  dateKey: string
): string {
  if (!teamId) return "";
  return map[dayCityKey(teamId, dateKey)] ?? "";
}

export function setDayCity(
  map: DayCityMap,
  teamId: string,
  dateKey: string,
  city: string
): DayCityMap {
  const key = dayCityKey(teamId, dateKey);
  const next = { ...map };
  if (city.trim() === "") {
    delete next[key];
  } else {
    next[key] = city.trim();
  }
  return next;
}

// Common Cyprus cities used as quick-pick presets in the city picker.
export const CITY_PRESETS: string[] = [
  "Пафос",
  "Лимассол",
  "Ларнака",
  "Никосия",
  "Айя-Напа",
];

// A stable color per city — used to tint day-headers and picker buttons.
// Custom cities fall back to the neutral gray returned by getCityColor.
export const CITY_COLORS: Record<string, string> = {
  "Пафос": "#3b82f6", // blue
  "Лимассол": "#8b5cf6", // purple
  "Ларнака": "#10b981", // emerald
  "Никосия": "#f59e0b", // amber
  "Айя-Напа": "#ec4899", // pink
};

export function getCityColor(city: string): string {
  return CITY_COLORS[city] ?? "#6b7280"; // gray-500 fallback
}
