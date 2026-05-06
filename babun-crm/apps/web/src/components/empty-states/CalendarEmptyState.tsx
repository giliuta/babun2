"use client";

/* eslint-disable react-hooks/set-state-in-effect */
// Same hydration-from-storage pattern used in CsvImportHint /
// SplashScreen / usePwaInstallState. The early-return setState in the
// gating effect is a legitimate "external system → React" sync.

// STORY-059 + STORY-073 — calendar first-run empty state.
//
// Two modes:
//   * personalCalendarEnabled = true  → standard "tap to create" hint
//     used by tenants already running an active calendar.
//   * personalCalendarEnabled = false → fork-state with two CTAs:
//       1. "Включить личный календарь" → calls onEnablePersonal
//       2. "Создать календарь для команды" → router.push("/dashboard/teams")
//     This is the first-time signup path where the owner hasn't
//     decided how the calendar will be used.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, X, CalendarHeart, Users } from "@babun/shared/icons";
import { getStorage } from "@babun/shared/storage";

const DISMISS_KEY = "babun:hint-calendar-empty-dismissed";

interface Props {
  /** Live tenant appointment count. Component returns null when > 0. */
  appointmentsCount: number;
  /** Tap-to-create handler — used in personal mode. */
  onCreateClick: () => void;
  /** STORY-073 — when false the empty state shows the two-CTA fork.
   *  Defaults to true to keep behaviour for tenants pre-migration. */
  personalCalendarEnabled?: boolean;
  /** STORY-073 — fired when the user clicks "Включить личный
   *  календарь" in the fork state. Page wires this to a server
   *  action that flips tenants.personal_calendar_enabled = true. */
  onEnablePersonal?: () => void | Promise<void>;
}

export function CalendarEmptyState({
  appointmentsCount,
  onCreateClick,
  personalCalendarEnabled = true,
  onEnablePersonal,
}: Props) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (appointmentsCount > 0) {
      setDismissed(true);
      return;
    }
    // Fork-state isn't dismissable — it's the only thing on the
    // empty calendar so the user always sees a path forward.
    if (!personalCalendarEnabled) {
      setDismissed(false);
      return;
    }
    let stored = false;
    try {
      stored = getStorage().getRaw(DISMISS_KEY) === "1";
    } catch {
      // private mode — show once, accept re-show on reload.
    }
    setDismissed(stored);
  }, [appointmentsCount, personalCalendarEnabled]);

  if (appointmentsCount > 0 || dismissed) return null;

  // ─── Fork state (STORY-073) ───────────────────────────────────
  if (!personalCalendarEnabled) {
    return (
      <div
        className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 80px)",
          maxWidth: "calc(100vw - 32px)",
          width: 360,
        }}
      >
        <div className="bg-[var(--surface-card)] rounded-[18px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[var(--separator)] p-4 space-y-3">
          <div>
            <div className="text-[16px] font-semibold text-[var(--label)] tracking-tight">
              Календарь пока пустой
            </div>
            <div className="text-[13px] text-[var(--label-secondary)] mt-0.5 leading-snug">
              Выбери, как ты будешь его использовать. Можно поменять в Настройках.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onEnablePersonal?.()}
            className="w-full h-11 rounded-[12px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold flex items-center justify-center gap-2 press-scale"
          >
            <CalendarHeart size={16} strokeWidth={2} />
            Включить личный календарь
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/teams")}
            className="w-full h-11 rounded-[12px] bg-[var(--surface-card)] border border-[var(--separator)] text-[var(--label)] text-[15px] font-semibold flex items-center justify-center gap-2 active:bg-[var(--fill-quaternary)] transition"
          >
            <Users size={16} strokeWidth={2} />
            Календарь для команды
          </button>
        </div>
      </div>
    );
  }

  // ─── Standard hint (STORY-059) ────────────────────────────────
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
