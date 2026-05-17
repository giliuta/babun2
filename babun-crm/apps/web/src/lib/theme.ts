// v596 §4.7 — Theme module.
//
// Source of truth for the user's appearance choice:
//   "auto" — follow the OS via `prefers-color-scheme: dark`.
//   "light" — force light, ignore OS.
//   "dark"  — force dark, ignore OS.
//
// Persisted in localStorage. Applied by toggling `theme-dark` on the
// <html> element so the CSS variable cascade (see globals.css)
// flips every surface in one synchronous repaint.

export type ThemeChoice = "auto" | "light" | "dark";

const STORAGE_KEY = "babun:theme";
const HTML_DARK_CLASS = "theme-dark";

export function loadThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "auto";
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "auto") return raw;
  return "auto";
}

export function saveThemeChoice(choice: ThemeChoice): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, choice);
}

/** Resolves the choice to a concrete light/dark mode given the
 *  current OS preference. Returns "dark" or "light" — never "auto". */
export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "auto") return choice;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Applies the resolved theme to <html>. Idempotent. */
export function applyTheme(mode: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  if (mode === "dark") {
    html.classList.add(HTML_DARK_CLASS);
  } else {
    html.classList.remove(HTML_DARK_CLASS);
  }
}

/** Subscribes to system theme changes. Calls the callback whenever
 *  the OS toggles `prefers-color-scheme`. Returns an unsubscribe
 *  function. No-op on the server. */
export function subscribeSystemTheme(
  cb: (mode: "light" | "dark") => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const listener = (e: MediaQueryListEvent) => cb(e.matches ? "dark" : "light");
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}
