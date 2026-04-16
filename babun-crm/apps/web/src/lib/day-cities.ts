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

// ─── Typed city palette (single source of truth) ──────────────────────
// По спеке: для каждого города — насыщенный цвет + светлый фон столбца
// + чуть темнее фон сегодня. Используется на календаре и в city-picker.

export interface CityConfig {
  name: string;
  code: string; // двухбуквенный код для компакта
  /** Тёмный оттенок = конец градиента заголовка + цвет текста/событий. */
  color: string;
  /** Светлый оттенок = начало градиента заголовка (135°). */
  c1: string;
  /** Светлый фон столбца = конец fade-перехода под заголовком. */
  bg: string;
  /** Чуть темнее для сегодняшнего дня. */
  bgToday: string;
}

// Палитра обновлена по спеке. color === c2 (gradient end).
export const CITIES: Record<string, CityConfig> = {
  "Пафос":    { name: "Пафос",    code: "ПФ", c1: "#38BDF8", color: "#0284C7", bg: "#F0F9FF", bgToday: "#E0F2FE" },
  "Лимассол": { name: "Лимассол", code: "ЛМ", c1: "#FB923C", color: "#EA580C", bg: "#FFF7ED", bgToday: "#FFEDD5" },
  "Ларнака":  { name: "Ларнака",  code: "ЛК", c1: "#34D399", color: "#059669", bg: "#ECFDF5", bgToday: "#D1FAE5" },
  "Никосия":  { name: "Никосия",  code: "НК", c1: "#C084FC", color: "#7C3AED", bg: "#FAF5FF", bgToday: "#EDE9FE" },
};

export const CITY_LIST = Object.values(CITIES);

// Common Cyprus cities used as quick-pick presets in the city picker.
export const CITY_PRESETS: string[] = CITY_LIST.map((c) => c.name);

export function getCityConfig(city: string): CityConfig | null {
  return CITIES[city] ?? null;
}

export function getCityColor(city: string): string {
  return CITIES[city]?.color ?? "#6b7280";
}

export function getCityBg(city: string, today: boolean): string | null {
  const cfg = CITIES[city];
  if (!cfg) return null;
  return today ? cfg.bgToday : cfg.bg;
}
