// Locale types and localStorage persistence for i18n.
// All functions are client-safe — they guard against SSR via
// `typeof window !== "undefined"` before touching localStorage.

export type Locale = "ru" | "en";

export const SUPPORTED_LOCALES: Locale[] = ["ru", "en"];

export const DEFAULT_LOCALE: Locale = "ru";

const STORAGE_KEY = "babun:locale";

/** Read locale from localStorage; falls back to DEFAULT_LOCALE. */
export function loadLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (SUPPORTED_LOCALES as string[]).includes(raw)) {
      return raw as Locale;
    }
  } catch {
    // quota / security errors — ignore
  }
  return DEFAULT_LOCALE;
}

/** Persist locale selection to localStorage. */
export function saveLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // quota / security errors — ignore
  }
}
