"use client";

import { useMemo } from "react";
import type { Appointment } from "@/lib/appointments";
import { getDebtAmount, getPaidAmount } from "@/lib/appointments";
import { formatEUR } from "@/lib/money";

interface DaySummaryStripProps {
  appointments: Appointment[];
  teamId: string;
  dateKey: string; // YYYY-MM-DD
  /** Tap counts → filter. Caller controls navigation / scroll. */
  onUnpaidTap?: () => void;
}

// "Сегодня · 6 записей · €450 · 3 в работе · 1 без оплаты" — the
// dispatcher's morning glance. Shown only in Day view. Each number
// is derived live from the appointments list; the unpaid pill is
// tappable because that's the action the dispatcher takes most.
export default function DaySummaryStrip({
  appointments,
  teamId,
  dateKey,
  onUnpaidTap,
}: DaySummaryStripProps) {
  const stats = useMemo(() => {
    let count = 0;
    let income = 0;
    let inProgress = 0;
    let unpaid = 0;
    for (const apt of appointments) {
      if (apt.date !== dateKey) continue;
      if (teamId && apt.team_id !== teamId) continue;
      if (apt.status === "cancelled") continue;
      if (apt.kind !== "work") continue;
      count++;
      income += getPaidAmount(apt);
      if (apt.status === "in_progress") inProgress++;
      if (apt.status === "completed" && getDebtAmount(apt) > 0) unpaid++;
    }
    return { count, income, inProgress, unpaid };
  }, [appointments, dateKey, teamId]);

  if (stats.count === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-b border-slate-200 text-[11px] overflow-x-auto">
      <Chip label={`${stats.count} записей`} />
      {stats.income > 0 && <Chip label={formatEUR(stats.income)} tone="emerald" />}
      {stats.inProgress > 0 && (
        <Chip label={`${stats.inProgress} в работе`} tone="indigo" />
      )}
      {stats.unpaid > 0 && (
        <Chip
          label={`${stats.unpaid} без оплаты`}
          tone="rose"
          onClick={onUnpaidTap}
        />
      )}
    </div>
  );
}

type Tone = "slate" | "emerald" | "indigo" | "rose";

const TONE: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-700",
  emerald: "bg-emerald-50 text-emerald-700",
  indigo: "bg-indigo-50 text-indigo-700",
  rose: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

function Chip({
  label,
  tone = "slate",
  onClick,
}: {
  label: string;
  tone?: Tone;
  onClick?: () => void;
}) {
  const content = (
    <span className="tabular-nums whitespace-nowrap font-semibold">{label}</span>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`px-2 py-1 rounded-full text-[11px] active:scale-[0.97] ${TONE[tone]}`}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={`px-2 py-1 rounded-full text-[11px] ${TONE[tone]}`}>
      {content}
    </span>
  );
}
