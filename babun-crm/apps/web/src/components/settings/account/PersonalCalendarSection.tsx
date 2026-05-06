"use client";

// STORY-073 — Settings → Аккаунт → personal calendar toggle.
//
// Live tap-to-toggle. Shows current state, fires the server action
// to flip the boolean, optimistically updates so the toggle feels
// instant. Tied to the same boolean the calendar empty-state reads.

import { useState, useTransition } from "react";
import { CalendarHeart } from "@babun/shared/icons";
import { setPersonalCalendarEnabled } from "@/app/dashboard/settings/account/personal-calendar-action";

interface Props {
  initialEnabled: boolean;
}

export default function PersonalCalendarSection({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    setError(null);
    setEnabled(next); // optimistic
    startTransition(async () => {
      const res = await setPersonalCalendarEnabled(next);
      if (!res.ok) {
        setError(res.error);
        setEnabled(!next); // revert
      }
    });
  };

  return (
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        Личный календарь
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <CalendarHeart size={18} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium text-[var(--label)]">
              Лично для тебя
            </div>
            <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
              Свои встречи и заметки. Видны только тебе, не команде.
            </div>
          </div>
          <label className="inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={(e) => toggle(e.target.checked)}
              disabled={isPending}
            />
            <span className="relative w-11 h-6 bg-[var(--fill-secondary)] rounded-full transition-colors peer-checked:bg-[var(--accent)] peer-disabled:opacity-50">
              <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
            </span>
          </label>
        </div>
        {error && (
          <div className="text-[12px] text-[var(--system-red)] leading-snug">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
