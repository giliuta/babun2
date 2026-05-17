"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Smartphone } from "@babun/shared/icons";
import {
  applyTheme,
  loadThemeChoice,
  resolveTheme,
  saveThemeChoice,
  subscribeSystemTheme,
  type ThemeChoice,
} from "@/lib/theme";

// v596 §4.7 — Appearance picker.
//
// Three options:
//   • «Авто»     — follow OS (`prefers-color-scheme: dark`).
//   • «Светлая»  — force light.
//   • «Тёмная»   — force dark.
//
// Tapping a chip persists the choice + applies it instantly + sets
// up / tears down the system-theme listener so «Авто» tracks the
// OS even after a settings revisit.
//
// Layout matches RegionSection — grouped-list card with a section
// title and a horizontally-scrollable chip row.

const OPTIONS: Array<{
  value: ThemeChoice;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "auto", label: "Авто", Icon: Smartphone },
  { value: "light", label: "Светлая", Icon: Sun },
  { value: "dark", label: "Тёмная", Icon: Moon },
];

export default function AppearanceSection() {
  const [choice, setChoice] = useState<ThemeChoice>("auto");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(loadThemeChoice());
  }, []);

  const pick = (next: ThemeChoice) => {
    setChoice(next);
    saveThemeChoice(next);
    applyTheme(resolveTheme(next));
  };

  // Keep tracking the OS while "Авто" is the active choice so the
  // theme flips live when the user toggles night-mode on iOS.
  useEffect(() => {
    if (choice !== "auto") return;
    return subscribeSystemTheme((mode) => applyTheme(mode));
  }, [choice]);

  return (
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        Внешний вид
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-3">
        <div className="flex gap-2">
          {OPTIONS.map(({ value, label, Icon }) => {
            const active = choice === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => pick(value)}
                aria-pressed={active}
                className={`flex-1 h-12 rounded-[12px] flex flex-col items-center justify-center gap-0.5 transition ${
                  active
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                    : "bg-[var(--fill-tertiary)] text-[var(--label)] active:bg-[var(--fill-secondary)]"
                }`}
              >
                <Icon size={16} strokeWidth={2.2} />
                <span className="text-[12px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
        <div className="px-1 pt-2 text-[11px] text-[var(--label-secondary)]">
          {choice === "auto"
            ? "Babun следует системной теме iPhone."
            : choice === "dark"
              ? "Тёмная тема активна на всех устройствах под этим аккаунтом."
              : "Светлая тема активна на всех устройствах под этим аккаунтом."}
        </div>
      </div>
    </div>
  );
}
