"use client";

/* eslint-disable react-hooks/set-state-in-effect */
// Same hydration-from-storage pattern used in CsvImportHint /
// SplashScreen / usePwaInstallState. The early-return setState in the
// gating effect is a legitimate "external system → React" sync.

// STORY-059 — calendar first-run empty state.
//
// Single shape: a small dismissable hint above the bottom tab bar
// with one CTA ("Добавить первую запись"). Renders only when there
// are no appointments yet.
//
// v432 — STORY-073's two-CTA fork state was removed: it covered the
// calendar grid, came back automatically every time the user toggled
// the personal calendar off, and made the team-calendar default feel
// like an unfinished onboarding step. The personal-calendar toggle
// lives in Settings → Мой календарь now and the fork-flow nudge is
// no longer needed.

import { useEffect, useState } from "react";
import { CalendarPlus, X } from "@babun/shared/icons";
import { getStorage } from "@babun/shared/storage";

const DISMISS_KEY = "babun:hint-calendar-empty-dismissed";

interface Props {
  /** Live tenant appointment count. Component returns null when > 0. */
  appointmentsCount: number;
  /** Tap-to-create handler. */
  onCreateClick: () => void;
}

export function CalendarEmptyState({
  appointmentsCount,
  onCreateClick,
}: Props) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (appointmentsCount > 0) {
      setDismissed(true);
      return;
    }
    let stored = false;
    try {
      stored = getStorage().getRaw(DISMISS_KEY) === "1";
    } catch {
      // private mode — show once, accept re-show on reload.
    }
    setDismissed(stored);
  }, [appointmentsCount]);

  if (appointmentsCount > 0 || dismissed) return null;

  // ─── Standard hint ────────────────────────────────
  const handleDismiss = () => {
    try {
      getStorage().setRaw(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const handleCreate = () => {
    try {
      getStorage().setRaw(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
    onCreateClick();
  };

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
      style={{
        bottom: "calc(env(safe-area-inset-bottom) + 80px)",
        maxWidth: "calc(100vw - 32px)",
        width: 360,
      }}
      aria-live="polite"
    >
      <div className="bg-[var(--surface-card)] rounded-[18px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[var(--separator)] p-4">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
            <CalendarPlus size={22} strokeWidth={2} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-[var(--label)] tracking-tight">
              Пока нет записей
            </div>
            <div className="text-[13px] text-[var(--label-secondary)] mt-0.5 leading-snug">
              Тапни на любую ячейку времени, чтобы добавить первую запись. Или нажми кнопку ниже.
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Скрыть подсказку"
            className="flex-shrink-0 w-8 h-8 -mr-1 -mt-1 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] transition"
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="mt-3 w-full h-11 rounded-[12px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
        >
          Добавить первую запись
        </button>
      </div>
    </div>
  );
}
