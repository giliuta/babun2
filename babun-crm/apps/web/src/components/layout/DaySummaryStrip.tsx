"use client";

import { useMemo } from "react";
import type { Appointment } from "@/lib/appointments";
import { getDebtAmount, getPaidAmount } from "@/lib/appointments";
import { formatEUR } from "@/lib/money";
import { pluralRecord } from "@/lib/pluralize";

interface DaySummaryStripProps {
  appointments: Appointment[];
  teamId: string;
  dateKey: string; // YYYY-MM-DD
  /** Tap counts → filter. Caller controls navigation / scroll. */
  onUnpaidTap?: () => void;
}

// "Сегодня · 6 записей · €450 · 3 в работе · 1 без оплаты" — the
// dispatcher's morning glance. Shown only in Day view. Telegram-style
// tinted pills under the header strip. Unpaid pill is tappable.
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
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-card)] border-b border-[var(--separator)] text-[12px] overflow-x-auto scrollbar-hide">
      <Chip label={pluralRecord(stats.count)} />
      {stats.income > 0 && <Chip label={formatEUR(stats.income)} tone="green" />}
      {stats.inProgress > 0 && (
        <Chip label={`${stats.inProgress} в работе`} tone="accent" />
      )}
      {stats.unpaid > 0 && (
        <Chip
          label={`${stats.unpaid} без оплаты`}
          tone="red"
          onClick={onUnpaidTap}
        />
      )}
    </div>
  );
}

type Tone = "neutral" | "green" | "accent" | "red";

const TONE: Record<Tone, string> = {
  neutral: "bg-[var(--fill-tertiary)] text-[var(--label)]",
  green: "bg-[rgba(52,199,89,0.12)] text-[var(--system-green)]",
  accent: "bg-[var(--accent-tint)] text-[var(--accent)]",
  red: "bg-[rgba(255,59,48,0.1)] text-[var(--system-red)]",
};

function Chip({
  label,
  tone = "neutral",
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
        className={`px-2.5 py-1 rounded-full text-[12px] active:scale-[0.97] ${TONE[tone]}`}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-[12px] ${TONE[tone]}`}>
      {content}
    </span>
  );
}
