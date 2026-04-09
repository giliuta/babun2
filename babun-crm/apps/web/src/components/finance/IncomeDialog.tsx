"use client";

import { useState, useMemo } from "react";
import { MOCK_INCOME } from "@/lib/mock-data";

interface IncomeDialogProps {
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

export default function IncomeDialog({ open, onClose }: IncomeDialogProps) {
  const [period, setPeriod] = useState<string>(PERIODS[0]);
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [activeTeam, setActiveTeam] = useState<string>(TEAM_TABS[0]);

  const filtered = useMemo(() => {
    if (activeTeam === "Все") return MOCK_INCOME;
    return MOCK_INCOME.filter((e) => e.team === activeTeam);
  }, [activeTeam]);

  const totalIncome = filtered.reduce((s, e) => s + e.amount, 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-4 py-3">
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
              <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg py-1 z-10 min-w-[200px]">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPeriod(p);
                      setShowPeriodMenu(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                      period === p ? "text-indigo-600 font-medium" : "text-gray-700"
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
        <div className="flex border-b border-gray-200">
          {TEAM_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTeam(tab)}
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                activeTeam === tab
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Category header */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
            Услуги
          </div>
        </div>

        {/* Income list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 truncate">
                  {entry.description}
                </div>
                <div className="text-xs text-gray-500">{entry.date}</div>
              </div>
              <div className="text-sm font-semibold text-green-600">
                +{entry.amount} EUR
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-gray-400 py-10 text-sm">
              Нет записей
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Итого:</span>
            <span className="text-base font-bold text-green-600">
              +{totalIncome} EUR
            </span>
          </div>
        </div>

        {/* Bottom */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center">
          <button
            onClick={onClose}
            className="flex-1 text-center text-sm text-gray-600 hover:text-gray-900"
          >
            Закрыть
          </button>
        </div>

        {/* FAB */}
        <button className="absolute bottom-20 right-8 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-indigo-700 transition-colors">
          +
        </button>
      </div>
    </div>
  );
}
