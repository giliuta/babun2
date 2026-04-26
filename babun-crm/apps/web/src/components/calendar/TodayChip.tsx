"use client";

import { useMemo } from "react";
import type { Appointment } from "@/lib/appointments";
import { getPaidAmount } from "@/lib/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";

interface TodayChipProps {
  appointments: Appointment[];
  teamId: string | null;
  onOpen: () => void;
}

// Single pill in the calendar header: «Сегодня €X · N ожид. →».
// Counted from appointments with date === today and matching team.
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

  // Nothing on empty days — no morning noise.
  if (stats.income === 0 && stats.pending === 0) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-[var(--fill-primary)] active:bg-[var(--fill-secondary)] text-[12px] font-semibold text-[var(--label)] tabular-nums flex-shrink-0"
    >
      <span>Сегодня</span>
      {stats.income > 0 && (
        <span className="text-[var(--system-green)]">
          {formatEUR(stats.income)}
        </span>
      )}
      {stats.pending > 0 && (
        <span className="flex items-center gap-0.5 bg-[var(--tile-orange)] text-[var(--label-on-accent)] rounded-full px-1.5 h-4">
          {stats.pending} ожид.
        </span>
      )}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="opacity-60">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}
