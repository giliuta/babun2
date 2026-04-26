"use client";

import { useState, useMemo } from "react";
import { MOCK_EXPENSES } from "@babun/shared/local/mock/seed";

interface ExpensesDialogProps {
  open: boolean;
  onClose: () => void;
}

const PERIODS = [
  "За последние 7 дней",
  "За последние 30 дней",
  "За текущий месяц",
  "За все время",
] as const;

const TEAM_TABS = ["Все", "Y&D", "D&K"] as const;

export default function ExpensesDialog({ open, onClose }: ExpensesDialogProps) {
  const [period, setPeriod] = useState<string>(PERIODS[0]);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [activeTeam, setActiveTeam] = useState<string>(TEAM_TABS[0]);

  const filtered = useMemo(() => {
    if (activeTeam === "Все") return MOCK_EXPENSES;
    return MOCK_EXPENSES.filter((e) => e.team === activeTeam);
  }, [activeTeam]);

  const totalExpenses = filtered.reduce((s, e) => s + e.amount, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--surface-card)] rounded-xl shadow-[var(--shadow-sheet)] w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--accent)] text-[var(--label-on-accent)] px-4 py-3">
          <div className="relative">
            <button
              onClick={() => setShowPeriodMenu(!showPeriodMenu)}
              className="flex items-center gap-1 text-base font-semibold hover:opacity-80"
            >
              {period}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showPeriodMenu && (
              <div className="absolute top-full left-0 mt-1 bg-[var(--surface-card)] rounded-lg shadow-[var(--shadow-sheet)] py-1 z-10 min-w-[200px]">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPeriod(p);
                      setShowPeriodMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--fill-primary)] ${
                      period === p ? "text-[var(--accent)] font-medium" : "text-[var(--label)]"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team tabs */}
        <div className="flex border-b border-[var(--separator)]">
          {TEAM_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTeam(tab)}
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                activeTeam === tab
                  ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                  : "text-[var(--label-secondary)] hover:text-[var(--label)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Category header */}
        <div className="px-4 py-2 bg-[var(--fill-tertiary)] border-b border-[var(--separator)]">
          <div className="text-xs text-[var(--label-secondary)] font-medium uppercase tracking-wide">
            Расходы по категориям
          </div>
        </div>

        {/* Expenses list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="px-4 py-3 border-b border-[var(--separator)] flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--label)] truncate">
                  {entry.description}
                </div>
                <div className="text-xs text-[var(--label-secondary)]">
                  {entry.date} | {entry.category}
                </div>
              </div>
              <div className="text-sm font-semibold text-[var(--system-red)]">
                -{entry.amount} EUR
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-[var(--label-tertiary)] py-10 text-sm">
              Нет записей
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="px-4 py-3 border-t border-[var(--separator)] bg-[var(--fill-tertiary)]">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--label-secondary)]">Итого:</span>
            <span className="text-base font-bold text-[var(--system-red)]">
              -{totalExpenses} EUR
            </span>
          </div>
        </div>

        {/* Bottom */}
        <div className="px-4 py-3 border-t border-[var(--separator)] flex items-center">
          <button
            onClick={onClose}
            className="flex-1 text-center text-sm text-[var(--label-secondary)] hover:text-[var(--label)]"
          >
            Закрыть
          </button>
        </div>

        {/* FAB */}
        <button className="absolute bottom-20 right-8 w-12 h-12 bg-[var(--accent)] text-[var(--label-on-accent)] rounded-full shadow-[var(--shadow-sheet)] flex items-center justify-center text-2xl hover:bg-[var(--accent-pressed)] transition-colors">
          +
        </button>
      </div>
    </div>
  );
}
