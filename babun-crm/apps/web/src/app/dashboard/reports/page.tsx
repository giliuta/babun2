"use client";

import { useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { MOCK_REPORTS } from "@/lib/mock-data";
import { useTeams } from "@/app/dashboard/layout";

export default function ReportsPage() {
  const { teams } = useTeams();
  const teamTabs = useMemo(
    () => [{ id: "all", name: "Все" }, ...teams.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name }))],
    [teams]
  );
  const [activeTeam, setActiveTeam] = useState<string>("all");

  const reports = useMemo(() => {
    if (activeTeam === "all") return MOCK_REPORTS;
    // Demo: apportion 60/40 between first and second team
    const ratio = teamTabs.findIndex((t) => t.id === activeTeam) === 1 ? 0.6 : 0.4;
    return MOCK_REPORTS.map((r) => ({
      ...r,
      income: Math.round(r.income * ratio),
      expenses: Math.round(r.expenses * 0.5),
      profit: Math.round(r.income * ratio - r.expenses * 0.5),
    }));
  }, [activeTeam, teamTabs]);

  const totals = useMemo(() => {
    return reports.reduce(
      (acc, r) => ({
        income: acc.income + r.income,
        expenses: acc.expenses + r.expenses,
        profit: acc.profit + r.profit,
      }),
      { income: 0, expenses: 0, profit: 0 }
    );
  }, [reports]);

  // Find max for bar chart scaling
  const maxVal = Math.max(...reports.map((r) => Math.max(r.income, r.expenses)), 1);

  const handleExportCsv = () => {
    const header = "Период,Доходы,Расходы,Прибыль";
    const rows = reports.map(
      (r) => `${r.period},${r.income},${r.expenses},${r.profit}`
    );
    const total = `Итого,${totals.income},${totals.expenses},${totals.profit}`;
    const csv = [header, ...rows, total].join("\n");
    // Prepend BOM for Excel compatibility with Cyrillic
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <>
      <PageHeader
        title="Отчеты"
        rightContent={
          <>
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-2 py-1.5 lg:px-3 text-xs lg:text-sm font-medium text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100 rounded-lg"
              title="Скачать CSV"
            >
              ⬇ CSV
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100"
              title="Печать"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 pb-24 space-y-4">
          {/* Chart */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">
              Динамика P&L
            </div>
            <div className="flex items-end gap-2 lg:gap-4 h-40 border-b border-gray-200 pb-2">
              {reports.map((r) => {
                const incH = (r.income / maxVal) * 100;
                const expH = (r.expenses / maxVal) * 100;
                return (
                  <div key={r.period} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex-1 w-full flex items-end gap-1">
                      <div
                        className="flex-1 bg-emerald-500 rounded-t"
                        style={{ height: `${incH}%` }}
                        title={`Доход ${r.income}€`}
                      />
                      <div
                        className="flex-1 bg-red-400 rounded-t"
                        style={{ height: `${expH}%` }}
                        title={`Расход ${r.expenses}€`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-end gap-2 lg:gap-4 mt-1">
              {reports.map((r) => (
                <div
                  key={r.period}
                  className="flex-1 text-center text-[10px] lg:text-xs text-gray-500 truncate"
                >
                  {r.period.split(" ")[0]}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 justify-center mt-3 text-xs text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-emerald-500 rounded" />
                Доход
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-red-400 rounded" />
                Расход
              </span>
            </div>
          </section>

          {/* Summary KPI cards */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500">Доход</div>
              <div className="text-lg lg:text-xl font-bold text-emerald-600">
                {totals.income.toLocaleString("ru-RU")}€
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500">Расход</div>
              <div className="text-lg lg:text-xl font-bold text-red-600">
                {totals.expenses.toLocaleString("ru-RU")}€
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <div className="text-[10px] text-gray-500">Прибыль</div>
              <div className={`text-lg lg:text-xl font-bold ${totals.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {totals.profit.toLocaleString("ru-RU")}€
              </div>
            </div>
          </div>

          {/* Table */}
          <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {teamTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTeam(tab.id)}
                  className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTeam === tab.id
                      ? "text-indigo-600 border-b-2 border-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium border-b border-gray-200">
              <div>Период</div>
              <div className="text-right">Доходы</div>
              <div className="text-right">Расходы</div>
              <div className="text-right">Прибыль</div>
            </div>

            {reports.map((row) => (
              <div
                key={row.period}
                className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-gray-100 text-sm"
              >
                <div className="text-gray-900">{row.period}</div>
                <div className="text-right text-emerald-600 font-medium">
                  {row.income.toLocaleString("ru-RU")}
                </div>
                <div className="text-right text-red-600 font-medium">
                  {row.expenses.toLocaleString("ru-RU")}
                </div>
                <div
                  className={`text-right font-medium ${
                    row.profit >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {row.profit.toLocaleString("ru-RU")}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-gray-50 text-sm font-bold border-t border-gray-300">
              <div className="text-gray-900">Итого</div>
              <div className="text-right text-emerald-600">
                {totals.income.toLocaleString("ru-RU")}
              </div>
              <div className="text-right text-red-600">
                {totals.expenses.toLocaleString("ru-RU")}
              </div>
              <div
                className={`text-right ${
                  totals.profit >= 0 ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {totals.profit.toLocaleString("ru-RU")}
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
