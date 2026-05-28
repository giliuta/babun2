"use client";

// «По бригадам» — Доход / Расход / Прибыль per brigade for the active
// period. Tap a brigade row → selects it as the chip filter on the
// header. («По меткам» variant lands in Phase D.)

import { formatEUR } from "@babun/shared/common/utils/money";
import type { Team } from "@babun/shared/local/masters";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import { breakdownByBrigade } from "@/lib/finance/ledger-compute";

interface BrigadeBreakdownBlockProps {
  teams: Team[];
  transactions: FinanceTransaction[];
  /** Tap on row → set this brigade as the only chip on the header. */
  onBrigadeTap: (brigadeId: string) => void;
}

export default function BrigadeBreakdownBlock({
  teams,
  transactions,
  onBrigadeTap,
}: BrigadeBreakdownBlockProps) {
  if (teams.length === 0) return null;
  const rows = breakdownByBrigade(
    transactions,
    teams.map((t) => t.id),
  );

  return (
    <div className="px-3 pt-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)] mb-1.5">
        По бригадам
      </div>
      <div className="bg-[var(--surface-card)] rounded-[12px] overflow-hidden">
        {rows.map((r, idx) => {
          const team = teams.find((t) => t.id === r.brigade_id);
          if (!team) return null;
          return (
            <button
              key={r.brigade_id}
              type="button"
              onClick={() => onBrigadeTap(r.brigade_id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-[var(--fill-quaternary)] transition-colors ${
                idx > 0 ? "border-t border-[var(--separator)]" : ""
              }`}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: team.color }}
              />
              <span className="flex-1 text-[13px] text-[var(--label)] truncate">
                {team.name}
              </span>
              <span className="text-[12px] font-semibold tabular-nums text-[var(--system-green)] w-[60px] text-right">
                {formatEUR(r.income)}
              </span>
              <span className="text-[12px] font-semibold tabular-nums text-[var(--system-red)] w-[60px] text-right">
                {r.expense > 0 ? "−" : ""}
                {formatEUR(r.expense)}
              </span>
              <span
                className={`text-[13px] font-bold tabular-nums w-[70px] text-right ${
                  r.profit < 0 ? "text-[var(--system-red)]" : "text-[var(--label)]"
                }`}
              >
                {formatEUR(r.profit)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
