"use client";

import { memo, useEffect, useMemo, useState } from "react";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";
import type {
  DayFinanceRowsConfig,
  DayFinanceTotals,
} from "@babun/shared/local/finance/day-summary";

interface MonthViewProps {
  currentDate: Date;
  appointments: Appointment[];
  onDayClick: (date: Date) => void;
  /** Which finance rows to show in each day cell (mirrors the week
   *  footer). When omitted, no money mini-list is rendered. */
  financeRows?: DayFinanceRowsConfig;
  /** Per-day totals, same source as the week footer. */
  summaryFor?: (dateKey: string) => DayFinanceTotals;
}

type RowKey = "planned" | "earned" | "spent" | "profit";

const ROW_ORDER: RowKey[] = ["planned", "earned", "spent", "profit"];
const ROW_COLOR: Record<RowKey, string> = {
  planned: "text-[var(--label-secondary)]",
  earned: "text-[var(--system-green)]",
  spent: "text-[var(--system-red)]",
  profit: "text-[var(--accent)]",
};

const DAYS_OF_WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function MonthViewInner({
  currentDate,
  appointments,
  onDayClick,
  financeRows,
  summaryFor,
}: MonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const today = useMemo(() => new Date(), []);
  const todayKey = formatDateKey(today);
  // STORY audit (hydration flicker fix — same as DayColumn): на SSR
  // нужно показывать все дни нейтрально, weekend-red применять только
  // после hydration. Иначе SSR вы рендерит «фейковую» неделю с red
  // субботами/воскресеньями, после hydration даты сдвигаются → red
  // переезжает на другие колонки → flicker.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Build a 6-row × 7-col grid starting from the Monday of the week
  // that contains the 1st of the month.
  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const firstDow = (firstOfMonth.getDay() + 6) % 7; // Mon=0..Sun=6
    const start = new Date(year, month, 1 - firstDow);

    const grid: Date[] = [];
    const cursor = new Date(start);
    for (let i = 0; i < 42; i++) {
      grid.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return grid;
  }, [year, month]);

  // Appointment count per date for the badge.
  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const apt of appointments) {
      map[apt.date] = (map[apt.date] ?? 0) + 1;
    }
    return map;
  }, [appointments]);

  const activeRows = ROW_ORDER.filter((k) => financeRows?.[k]);

  return (
    <div className="flex-1 flex flex-col bg-[var(--surface-card)] min-h-0 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[var(--separator)] bg-[var(--surface-grouped)] flex-shrink-0">
        {DAYS_OF_WEEK.map((dow, i) => (
          <div
            key={dow}
            className={`py-2 text-center text-[12px] font-semibold uppercase tracking-wider ${
              i >= 5 ? "text-[var(--system-red)]/60" : "text-[var(--label-secondary)]"
            }`}
          >
            {dow}
          </div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 grid-rows-6 min-h-0">
        {cells.map((date, i) => {
          const key = formatDateKey(date);
          const count = countByDate[key] ?? 0;
          const totals =
            summaryFor && activeRows.length > 0 ? summaryFor(key) : null;
          const inCurrentMonth = date.getMonth() === month;
          const isToday = key === todayKey;
          // Hydration-gated: показываем red только после mount.
          const isWeekend = hydrated && (date.getDay() === 0 || date.getDay() === 6);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayClick(date)}
              className={`border-r border-b border-[var(--separator)] p-1 text-left flex flex-col items-start active:bg-[var(--accent-tint)] overflow-hidden transition-colors ${
                inCurrentMonth ? "bg-[var(--surface-card)]" : "bg-[var(--surface-grouped)]"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                {isToday ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[12px] font-bold">
                    {date.getDate()}
                  </span>
                ) : (
                  <span
                    className={`text-[13px] font-semibold ${
                      inCurrentMonth
                        ? isWeekend
                          ? "text-[var(--system-red)]"
                          : "text-[var(--label)]"
                        : "text-[var(--label-tertiary)]"
                    }`}
                  >
                    {date.getDate()}
                  </span>
                )}
                {count > 0 && (
                  <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-tint)] rounded-full px-1.5 leading-[16px]">
                    {count}
                  </span>
                )}
              </div>
              {totals && totals.hasAny && (
                <div className="mt-0.5 w-full flex flex-col gap-0 leading-[13px]">
                  {activeRows.map((k) => {
                    const v =
                      k === "planned"
                        ? totals.planned
                        : k === "earned"
                          ? totals.earned
                          : k === "spent"
                            ? totals.spent
                            : totals.profit;
                    if (k !== "profit" && v === 0) return null;
                    const negativeProfit = k === "profit" && totals.profit < 0;
                    return (
                      <span
                        key={k}
                        className={`text-[10px] font-semibold tabular-nums truncate w-full ${
                          negativeProfit ? "text-[var(--system-red)]" : ROW_COLOR[k]
                        }`}
                      >
                        {formatEUR(v)}
                      </span>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const MonthView = memo(MonthViewInner);
export default MonthView;
