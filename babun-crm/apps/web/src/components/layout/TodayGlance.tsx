"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Appointment } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import type { Team } from "@/lib/masters";
import type { DayExtra } from "@/lib/day-extras";
import { computeFinancials } from "@/lib/finance/compute";
import { formatEUR } from "@/lib/money";

interface TodayGlanceProps {
  appointments: Appointment[];
  services: Service[];
  teams: Team[];
  dayExtrasOf: (teamId: string, dateKey: string) => DayExtra[];
  /** `"all"` shows company-wide totals. */
  teamId: string;
}

// Three-second glance at today's money. Tap jumps to /finances for the
// drill-down. Hidden when today is entirely empty. Uses the unified
// `computeFinancials` so this number never disagrees with Finances or
// Reports for the same filter.
export default function TodayGlance({
  appointments,
  services,
  teams,
  dayExtrasOf,
  teamId,
}: TodayGlanceProps) {
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const { totalIncome, cash, card } = useMemo(
    () =>
      computeFinancials({
        appointments,
        services,
        teams,
        dayExtrasOf,
        standalonePayments: [],
        standaloneExpenses: [],
        range: { from: todayKey, to: todayKey },
        teamFilter: teamId || "all",
      }),
    [appointments, services, teams, dayExtrasOf, todayKey, teamId]
  );

  if (totalIncome <= 0) return null;

  return (
    <Link
      href="/dashboard/finances"
      className="block px-3 py-1.5 bg-emerald-50 border-b border-emerald-100 active:bg-emerald-100 transition"
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 shrink-0">
          Сегодня
        </span>
        <span className="text-[17px] font-bold text-emerald-700 tabular-nums leading-none">
          +{formatEUR(totalIncome)}
        </span>
        <div className="flex-1 flex items-baseline gap-2 text-[11px] text-emerald-800/70 tabular-nums min-w-0">
          {cash > 0 && (
            <span>
              нал <span className="font-semibold">{formatEUR(cash)}</span>
            </span>
          )}
          {card > 0 && (
            <span>
              карта <span className="font-semibold">{formatEUR(card)}</span>
            </span>
          )}
        </div>
        <span className="text-emerald-700 shrink-0 text-[13px]">›</span>
      </div>
    </Link>
  );
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
