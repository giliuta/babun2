"use client";

import { useState, useMemo } from "react";
import { MOCK_REPORTS } from "@/lib/mock-data";

interface ReportsDialogProps {
  open: boolean;
  onClose: () => void;
}

const TEAM_TABS = ["Все мастера", "Y&D", "D&K"] as const;

export default function ReportsDialog({ open, onClose }: ReportsDialogProps) {
  const [activeTeam, setActiveTeam] = useState<string>(TEAM_TABS[0]);

  const reports = useMemo(() => {
    if (activeTeam === "Все мастера") return MOCK_REPORTS;
    // Simulate different numbers per team
    if (activeTeam === "Y&D") {
      return MOCK_REPORTS.map((r) => ({
        ...r,
        income: Math.round(r.income * 0.6),
        expenses: Math.round(r.expenses * 0.5),
        profit: Math.round(r.income * 0.6 - r.expenses * 0.5),
      }));
    }
    return MOCK_REPORTS.map((r) => ({
      ...r,
      income: Math.round(r.income * 0.4),
      expenses: Math.round(r.expenses * 0.5),
      profit: Math.round(r.income * 0.4 - r.expenses * 0.5),
    }));
  }, [activeTeam]);

  const totals = useMemo(() => {
    return reports.reduce(
      (acc, r) => ({
        income: acc.income + r.income,
        expenses: acc.expenses + r.expenses,
        profit: acc.profit + r.profit,
      }),
      { income: 0, expenses: 0, profit: 0 },
    );
  }, [reports]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-2">
          <h2 className="flex-1 text-base font-semibold">Отчеты</h2>
          <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-indigo-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-indigo-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>
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

        {/* Period selector */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">По месяцам</span>
          <span className="text-xs text-gray-400">Янв 2026 — Апр 2026</span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {/* Table header */}
          <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium border-b border-gray-200">
            <div>Период</div>
            <div className="text-right">Доходы</div>
            <div className="text-right">Расходы</div>
            <div className="text-right">Прибыль</div>
          </div>

          {/* Rows */}
          {reports.map((row) => (
            <div
              key={row.period}
              className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-gray-100 text-sm"
            >
              <div className="text-gray-900">{row.period}</div>
              <div className="text-right text-green-600 font-medium">
                {row.income.toLocaleString("ru-RU")}
              </div>
              <div className="text-right text-red-600 font-medium">
                {row.expenses.toLocaleString("ru-RU")}
              </div>
              <div
                className={`text-right font-medium ${
                  row.profit >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {row.profit.toLocaleString("ru-RU")}
              </div>
            </div>
          ))}

          {/* Total row */}
          <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-gray-50 text-sm font-bold border-t border-gray-300">
            <div className="text-gray-900">Итого</div>
            <div className="text-right text-green-600">
              {totals.income.toLocaleString("ru-RU")}
            </div>
            <div className="text-right text-red-600">
              {totals.expenses.toLocaleString("ru-RU")}
            </div>
            <div
              className={`text-right ${
                totals.profit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {totals.profit.toLocaleString("ru-RU")}
            </div>
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
      </div>
    </div>
  );
}
