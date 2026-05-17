"use client";

import { useEffect } from "react";
import {
  applyTheme,
  loadThemeChoice,
  resolveTheme,
  subscribeSystemTheme,
} from "@/lib/theme";

// v596 §4.7 — Mounts once at the root layout to apply the user's
// theme choice on every page load + keep it in sync with the OS
// when the user chose "auto".
//
// Why a client component instead of inline script in <head>: we
// accept a brief flash of light theme on first paint in exchange
// for not blocking the HTML stream. The flash is bounded by the
// React hydration window (~10-50ms on modern hardware) and goes
// away once the user lands on a page.
//
// Side-effects-only — renders nothing.

export function ThemeBootstrap(): null {
  useEffect(() => {
    const choice = loadThemeChoice();
    applyTheme(resolveTheme(choice));
    if (choice !== "auto") return;
    return subscribeSystemTheme((mode) => applyTheme(mode));
  }, []);
  return null;
}
