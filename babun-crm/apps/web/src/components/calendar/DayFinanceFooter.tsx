"use client";

import { memo } from "react";
import {
  formatDateKey,
  getCurrentCyprusTime,
} from "@babun/shared/common/utils/date-utils";
import { formatEUR } from "@babun/shared/common/utils/money";
import {
  getDayMode,
  type DayFinanceTotals,
} from "@babun/shared/local/finance/day-summary";

interface DayFinanceFooterProps {
  /** Same visible dates the calendar grid renders (1 / 3 / 7). */
  dates: Date[];
  summaryFor: (dateKey: string) => DayFinanceTotals;
  onDayTap: (dateKey: string) => void;
}

// Two small numbers per day: Доход (green) over Расход (red).
//
// «Доход» is contextual so it's never empty for a booked day — actual
// PAID income is €0 for upcoming/unpaid work, which made the footer
// look broken. Past days show what was actually earned; today + future
// show the day's planned revenue (what the booked work is worth). This
// mirrors the day-finance popup, which already headlines the plan for
// future days. Расход is the day's costs. Both numbers always render
// (€0 too) so every day is visibly accounted for. Tap → popup.
const NUM =
  "h-[13px] leading-[13px] text-[11px] tabular-nums truncate text-center";

function DayFinanceFooterInner({
  dates,
  summaryFor,
  onDayTap,
}: DayFinanceFooterProps) {
  const todayKey = formatDateKey(getCurrentCyprusTime());

  return (
    <div
      data-testid="day-finance-footer"
      className="flex-shrink-0 border-t border-[var(--separator)] bg-[var(--surface-card)] select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex w-full">
        {/* Empty gutter — reserves the TimeColumn width (w-12/16) so the
            day columns line up with the grid above. */}
        <div className="w-12 lg:w-16 flex-shrink-0" aria-hidden />

        {dates.map((date) => {
          const dateKey = formatDateKey(date);
          const t = summaryFor(dateKey);
          // Past → actually earned; today/future → planned revenue.
          const income =
            getDayMode(dateKey, todayKey) === "past" ? t.earned : t.planned;
          const expense = t.spent;
          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onDayTap(dateKey)}
              aria-label={`Финансы за ${dateKey}`}
              className="flex-1 min-w-0 flex flex-col justify-center gap-0 py-1 px-0.5 border-l border-[var(--separator)] first:border-l-0 active:bg-[var(--fill-quaternary)] transition-colors"
            >
              <span className={`${NUM} font-semibold text-[var(--system-green)]`}>
                {formatEUR(income)}
              </span>
              <span className={`${NUM} font-medium text-[var(--system-red)]`}>
                {formatEUR(expense)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const DayFinanceFooter = memo(DayFinanceFooterInner);
export default DayFinanceFooter;
