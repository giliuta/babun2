"use client";

import { useMemo } from "react";
import type { Appointment } from "@/lib/appointments";
import { getPaidAmount } from "@/lib/appointments";
import { formatEUR } from "@/lib/money";

interface TodayChipProps {
  appointments: Appointment[];
  teamId: string | null;
  onOpen: () => void;
}

// STORY-003: заменяет убранный 7-колоночный нижний футер.
// Единая плашка в шапке календаря: «Сегодня €X · N ожид. →».
// Считается из appointments с date === сегодня и team_id совпадает.
export default function TodayChip({ appointments, teamId, onOpen }: TodayChipProps) {
  const stats = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const todayKey = `${y}-${m}-${d}`;

    let income = 0;
    let pending = 0;
    for (const a of appointments) {
      if (a.date !== todayKey) continue;
      if (teamId && a.team_id !== teamId) continue;
      if (a.status === "completed") {
        income += getPaidAmount(a);
      } else if (a.status === "scheduled") {
        pending++;
      }
    }
    return { income, pending };
  }, [appointments, teamId]);

  // Ничего не показываем если день пустой — чтобы не шуметь утром.
  if (stats.income === 0 && stats.pending === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-white/15 active:bg-white/25 lg:bg-slate-100 lg:active:bg-slate-200 text-[11px] font-semibold text-white lg:text-slate-700 tabular-nums flex-shrink-0"
    >
      <span>Сегодня</span>
      {stats.income > 0 && (
        <span className="text-emerald-200 lg:text-emerald-600">
          {formatEUR(stats.income)}
        </span>
      )}
      {stats.pending > 0 && (
        <span className="flex items-center gap-0.5 bg-amber-400/80 text-amber-950 rounded-full px-1.5 h-4">
          {stats.pending} ожид.
        </span>
      )}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-60">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
