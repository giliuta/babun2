"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Appointment } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import type { Team } from "@/lib/masters";
import type { DayExtra } from "@/lib/day-extras";
import { computeFinancials } from "@/lib/finance/compute";
import { pluralRecord } from "@babun/shared/common/utils/pluralize";
import { formatEUR } from "@babun/shared/common/utils/money";

interface TodayGlanceProps {
  appointments: Appointment[];
  services: Service[];
  teams: Team[];
  dayExtrasOf: (teamId: string, dateKey: string) => DayExtra[];
  /** `"all"` shows company-wide totals. */
  teamId: string;
}

// Three-second glance at today. Two flavours:
//   * Money mode (green tint) — at least €1 came in today; show totals.
//   * Plan mode (accent tint) — no money yet but visits exist; show count
//                               and first-visit time.
// Hidden only when today has zero records and zero income — empty days
// keep the dashboard empty. Uses `computeFinancials` so the number never
// disagrees with /finances for the same filter.
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
        className="block px-3 py-1.5 bg-[var(--accent-tint)] active:opacity-80 transition"
      >
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--accent)] shrink-0">
            Сегодня
          </span>
          <span className="text-[14px] font-bold text-[var(--accent)]">
            {pluralRecord(plan.count)}
          </span>
          <span className="flex-1 text-[12px] text-[var(--accent)] opacity-70">
            первая в{" "}
            <span className="font-semibold tabular-nums">{plan.first}</span>
          </span>
          <span className="text-[var(--accent)] shrink-0 text-[13px]">›</span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/dashboard/finances"
      className="block px-3 py-1.5 bg-[rgba(52,199,89,0.12)] active:opacity-80 transition"
    >
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--system-green)] shrink-0">
          Сегодня
        </span>
        <span className="text-[17px] font-bold text-[var(--system-green)] leading-none">
          +{formatEUR(totalIncome)}
        </span>
        <div className="flex-1 flex items-baseline gap-2 text-[12px] text-[var(--system-green)] opacity-80 min-w-0">
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
        <span className="text-[var(--system-green)] shrink-0 text-[13px]">›</span>
      </div>
    </Link>
  );
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
