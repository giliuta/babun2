"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Appointment } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import type { Team } from "@/lib/masters";
import type { DayExtra } from "@/lib/day-extras";
import { computeFinancials } from "@/lib/finance/compute";
import { pluralRecord } from "@/lib/pluralize";
import { formatEUR } from "@/lib/money";

interface TodayGlanceProps {
  appointments: Appointment[];
  services: Service[];
  teams: Team[];
  dayExtrasOf: (teamId: string, dateKey: string) => DayExtra[];
  /** `"all"` shows company-wide totals. */
  teamId: string;
}

// Three-second glance at today. Two flavours:
//   * Money mode (emerald) — at least €1 came in today; show totals.
//   * Plan mode (violet)   — no money yet but visits exist; show count
//                            and first-visit time.
// Hidden only when today has zero records and zero income — empty days
// keep the dashboard empty (Sprint 019 U1). Uses `computeFinancials`
// so the number never disagrees with /finances for the same filter.
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

  // Today's plan: count + first time. Cheap, no extra deps.
  const plan = useMemo(() => {
    const todayApts = appointments.filter(
      (a) =>
        a.date === todayKey &&
        a.status !== "cancelled" &&
        (teamId === "all" || !teamId || a.team_id === teamId)
    );
    if (todayApts.length === 0) return null;
    const sorted = [...todayApts].sort((a, b) =>
      a.time_start.localeCompare(b.time_start)
    );
    return { count: todayApts.length, first: sorted[0].time_start };
  }, [appointments, teamId, todayKey]);

  if (totalIncome <= 0 && !plan) return null;

  if (totalIncome <= 0 && plan) {
    return (
      <Link
        href="/dashboard"
        className="block px-3 py-1.5 bg-violet-50 border-b border-violet-100 active:bg-violet-100 transition"
      >
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 shrink-0">
            Сегодня
          </span>
          <span className="text-[14px] font-bold text-violet-800">
            {pluralRecord(plan.count)}
          </span>
          <span className="flex-1 text-[11px] text-violet-800/70">
            первая в{" "}
            <span className="font-semibold tabular-nums">{plan.first}</span>
          </span>
          <span className="text-violet-700 shrink-0 text-[13px]">›</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard/finances"
      className="block px-3 py-1.5 bg-emerald-50 border-b border-emerald-100 active:bg-emerald-100 transition"
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 shrink-0">
          Сегодня
        </span>
        <span className="text-[17px] font-bold text-emerald-700 leading-none">
          +{formatEUR(totalIncome)}
        </span>
        <div className="flex-1 flex items-baseline gap-2 text-[11px] text-emerald-800/70 min-w-0">
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
