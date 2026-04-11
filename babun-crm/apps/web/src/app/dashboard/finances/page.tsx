"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
  useAppointments,
  useDayExtras,
  useExpenseCategories,
  useServices,
  useTeams,
  useClients,
} from "@/app/dashboard/layout";
import {
  getPaidAmount,
  type Appointment,
} from "@/lib/appointments";
import { getServiceMaterialCost, type Service } from "@/lib/services";
import {
  createBlankExpenseCategory,
  type ExpenseCategory,
} from "@/lib/expense-categories";
import type { Client } from "@/lib/clients";
import type { DraftClient } from "@/lib/draft-clients";
import { formatDateLongRu } from "@/lib/date-utils";

// Unified Finance page — pulls numbers from real appointments + day
// extras, no more MOCK_INCOME/MOCK_EXPENSES. Income is what clients
// actually paid for completed/in-progress appointments plus manual
// day-level extras. Expenses are the per-service material costs, each
// appointment's custom expense lines, and manual day-level expense
// extras.

type Mode = "income" | "expenses" | "summary";
type PeriodKey = "7d" | "30d" | "month" | "all";

interface PeriodOption {
  key: PeriodKey;
  label: string;
}

const PERIODS: PeriodOption[] = [
  { key: "7d", label: "За последние 7 дней" },
  { key: "30d", label: "За последние 30 дней" },
  { key: "month", label: "За текущий месяц" },
  { key: "all", label: "За все время" },
];

const MODE_LABELS: Record<Mode, string> = {
  income: "Доходы",
  expenses: "Расходы",
  summary: "Итого",
};

interface IncomeLine {
  id: string;
  dateKey: string;
  description: string;
  amount: number;
  teamId: string | null;
  sourceType: "appointment" | "extra";
}

interface ExpenseLine {
  id: string;
  dateKey: string;
  description: string;
  amount: number;
  teamId: string | null;
  category: string;
  sourceType: "material" | "custom" | "extra";
}

export default function FinancesPage() {
  const { appointments } = useAppointments();
  const { getExtrasFor } = useDayExtras();
  const { categories, setCategories } = useExpenseCategories();
  const { services } = useServices();
  const { teams } = useTeams();
  const { clients } = useClients();

  const [mode, setMode] = useState<Mode>("summary");
  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [activeTeam, setActiveTeam] = useState<string>("all");
  const [showCategories, setShowCategories] = useState(false);

  const teamTabs = useMemo(
    () => [
      { id: "all", name: "Все" },
      ...teams.filter((t) => t.active).map((t) => ({ id: t.id, name: t.name })),
    ],
    [teams]
  );

  const teamById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teams) map.set(t.id, t.name);
    return map;
  }, [teams]);

  const clientsById = useMemo(() => {
    const map = new Map<string, Client | DraftClient>();
    for (const c of clients) map.set(c.id, c);
    return map;
  }, [clients]);

  const servicesById = useMemo(() => {
    const map = new Map<string, Service>();
    for (const s of services) map.set(s.id, s);
    return map;
  }, [services]);

  // Date range resolution — inclusive start, inclusive end (today).
  const { rangeStart, rangeEnd } = useMemo(
    () => computeRange(period),
    [period]
  );

  const inRange = (dateKey: string) => {
    if (!rangeStart) return true; // "all"
    return dateKey >= rangeStart && dateKey <= rangeEnd;
  };

  const relevantAppointments = useMemo(
    () =>
      appointments.filter(
        (a) =>
          (a.status === "completed" || a.status === "in_progress") &&
          inRange(a.date)
      ),
    // inRange is deterministic per rangeStart/rangeEnd
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appointments, rangeStart, rangeEnd]
  );

  // Build income & expense lines from the real data model.
  const { incomeLines, expenseLines } = useMemo(() => {
    const inc: IncomeLine[] = [];
    const exp: ExpenseLine[] = [];

    for (const apt of relevantAppointments) {
      const paid = getPaidAmount(apt);
      if (paid > 0) {
        const clientName =
          (apt.client_id && clientsById.get(apt.client_id)?.full_name) ||
          apt.comment ||
          "Запись";
        const serviceSummary = apt.service_ids
          .map((sid) => servicesById.get(sid)?.name)
          .filter(Boolean)
          .join(", ");
        inc.push({
          id: `apt-${apt.id}`,
          dateKey: apt.date,
          description: serviceSummary
            ? `${serviceSummary} — ${clientName}`
            : clientName,
          amount: paid,
          teamId: apt.team_id,
          sourceType: "appointment",
        });
      }

      // Material costs from services on this appointment
      for (const sid of apt.service_ids) {
        const svc = servicesById.get(sid);
        if (!svc) continue;
        const materialCost = getServiceMaterialCost(svc);
        if (materialCost > 0) {
          exp.push({
            id: `mat-${apt.id}-${sid}`,
            dateKey: apt.date,
            description: `Материалы: ${svc.name}`,
            amount: materialCost,
            teamId: apt.team_id,
            category: "Материалы",
            sourceType: "material",
          });
        }
      }

      // Custom expenses attached to this appointment
      for (const e of apt.expenses ?? []) {
        if (e.amount > 0) {
          exp.push({
            id: `cex-${apt.id}-${e.id}`,
            dateKey: apt.date,
            description: e.name || "Расход",
            amount: e.amount,
            teamId: apt.team_id,
            category: "Прочее",
            sourceType: "custom",
          });
        }
      }
    }

    // Day-level extras — iterate every day in the range for every team
    // and pull from the context. We only look at extras whose date is
    // in range; team filter applies later so we gather all teams here.
    const dateRange = datesInRange(rangeStart, rangeEnd);
    for (const team of teams) {
      for (const dateKey of dateRange) {
        const extras = getExtrasFor(team.id, dateKey);
        for (const ex of extras) {
          const line = {
            id: `ex-${team.id}-${dateKey}-${ex.id}`,
            dateKey,
            description: ex.name || (ex.kind === "income" ? "Доход" : "Расход"),
            amount: ex.amount,
            teamId: team.id,
          };
          if (ex.kind === "income") {
            inc.push({ ...line, sourceType: "extra" });
          } else {
            exp.push({ ...line, category: "Прочее", sourceType: "extra" });
          }
        }
      }
    }

    return { incomeLines: inc, expenseLines: exp };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    relevantAppointments,
    servicesById,
    clientsById,
    teams,
    getExtrasFor,
    rangeStart,
    rangeEnd,
  ]);

  const filteredIncome = useMemo(
    () =>
      activeTeam === "all"
        ? incomeLines
        : incomeLines.filter((l) => l.teamId === activeTeam),
    [incomeLines, activeTeam]
  );

  const filteredExpenses = useMemo(
    () =>
      activeTeam === "all"
        ? expenseLines
        : expenseLines.filter((l) => l.teamId === activeTeam),
    [expenseLines, activeTeam]
  );

  const totalIncome = filteredIncome.reduce((s, e) => s + e.amount, 0);
  const totalExpense = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const profit = totalIncome - totalExpense;

  const expensesGrouped = useMemo(() => {
    const groups = new Map<string, ExpenseLine[]>();
    for (const e of filteredExpenses) {
      const key = e.category || "Прочее";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    return Array.from(groups.entries()).sort(
      (a, b) =>
        b[1].reduce((s, x) => s + x.amount, 0) -
        a[1].reduce((s, x) => s + x.amount, 0)
    );
  }, [filteredExpenses]);

  const selectedPeriodLabel =
    PERIODS.find((p) => p.key === period)?.label ?? "";

  return (
    <>
      <PageHeader
        title="Финансы"
        rightContent={
          <button
            type="button"
            onClick={() => setShowCategories(true)}
            className="px-2 py-1.5 lg:px-3 text-xs lg:text-sm font-medium text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100 rounded-lg"
          >
            ⚙ Категории
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50 relative">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 pb-8 space-y-3">
          {/* Summary cards double as mode switcher */}
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard
              label="Доход"
              value={`+${totalIncome}€`}
              color="emerald"
              active={mode === "income"}
              onClick={() => setMode("income")}
            />
            <SummaryCard
              label="Расход"
              value={`−${totalExpense}€`}
              color="red"
              active={mode === "expenses"}
              onClick={() => setMode("expenses")}
            />
            <SummaryCard
              label="Прибыль"
              value={`${profit >= 0 ? "+" : ""}${profit}€`}
              color={profit >= 0 ? "indigo" : "red"}
              active={mode === "summary"}
              onClick={() => setMode("summary")}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Period selector */}
            <div className="px-4 py-3 border-b border-gray-200 relative">
              <button
                type="button"
                onClick={() => setShowPeriodMenu((s) => !s)}
                className="flex items-center gap-1 text-sm font-semibold text-gray-900 hover:opacity-80"
              >
                {selectedPeriodLabel}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showPeriodMenu && (
                <div className="absolute top-full left-4 mt-1 bg-white rounded-lg shadow-lg py-1 z-10 min-w-[200px] border border-gray-200">
                  {PERIODS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setPeriod(p.key);
                        setShowPeriodMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                        period === p.key
                          ? "text-indigo-600 font-medium"
                          : "text-gray-700"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Team tabs */}
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

            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                {MODE_LABELS[mode]}
              </div>
              {mode === "summary" && (
                <div className="text-[11px] text-gray-500">
                  Доход − расход
                </div>
              )}
            </div>

            {mode === "income" && (
              <IncomeList
                entries={filteredIncome}
                total={totalIncome}
                teamById={teamById}
              />
            )}

            {mode === "expenses" && (
              <ExpenseGroups
                groups={expensesGrouped}
                categories={categories}
                total={totalExpense}
                teamById={teamById}
              />
            )}

            {mode === "summary" && (
              <CombinedSummary
                incomeCount={filteredIncome.length}
                expenseCount={filteredExpenses.length}
                totalIncome={totalIncome}
                totalExpense={totalExpense}
              />
            )}
          </div>
        </div>
      </div>

      {showCategories && (
        <ExpenseCategoriesSheet
          categories={categories}
          onClose={() => setShowCategories(false)}
          onSave={(next) => {
            setCategories(next);
            setShowCategories(false);
          }}
        />
      )}
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function computeRange(period: PeriodKey): {
  rangeStart: string | null;
  rangeEnd: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = toDateKey(today);
  if (period === "all") return { rangeStart: null, rangeEnd: end };
  if (period === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { rangeStart: toDateKey(first), rangeEnd: end };
  }
  const days = period === "7d" ? 7 : 30;
  const start = new Date(today);
  start.setDate(start.getDate() - days + 1);
  return { rangeStart: toDateKey(start), rangeEnd: end };
}

function datesInRange(
  rangeStart: string | null,
  rangeEnd: string
): string[] {
  if (!rangeStart) return []; // "all" — extras iteration would be unbounded
  const out: string[] = [];
  const [sy, sm, sd] = rangeStart.split("-").map(Number);
  const [ey, em, ed] = rangeEnd.split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const stop = new Date(ey, em - 1, ed);
  while (cur <= stop) {
    out.push(toDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ─── Sub-components ────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  color: "emerald" | "red" | "indigo";
  active: boolean;
  onClick: () => void;
}

function SummaryCard({ label, value, color, active, onClick }: SummaryCardProps) {
  const colorClass =
    color === "emerald"
      ? "text-emerald-600"
      : color === "red"
        ? "text-red-600"
        : "text-indigo-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-left transition active:scale-[0.98] ${
        active
          ? "bg-white border-indigo-500 ring-1 ring-indigo-500"
          : "bg-white border-gray-200"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={`text-[15px] font-bold tabular-nums mt-1 ${colorClass}`}>
        {value}
      </div>
    </button>
  );
}

function IncomeList({
  entries,
  total,
  teamById,
}: {
  entries: IncomeLine[];
  total: number;
  teamById: Map<string, string>;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center text-gray-400 py-10 text-sm">
        Нет доходных записей
      </div>
    );
  }
  return (
    <>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 truncate">
              {entry.description}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {formatDateLongRu(entry.dateKey)}
              {entry.teamId && teamById.get(entry.teamId)
                ? ` • ${teamById.get(entry.teamId)}`
                : ""}
              {entry.sourceType === "extra" ? " • вручную" : ""}
            </div>
          </div>
          <div className="text-sm font-semibold text-emerald-600">
            +{entry.amount} €
          </div>
        </div>
      ))}
      <TotalRow label="Итого доход" value={total} color="emerald" />
    </>
  );
}

function ExpenseGroups({
  groups,
  categories,
  total,
  teamById,
}: {
  groups: [string, ExpenseLine[]][];
  categories: ExpenseCategory[];
  total: number;
  teamById: Map<string, string>;
}) {
  if (groups.length === 0) {
    return (
      <div className="text-center text-gray-400 py-10 text-sm">
        Нет расходных записей
      </div>
    );
  }
  return (
    <>
      {groups.map(([catName, entries]) => {
        const cat = categories.find(
          (c) => c.name.toLowerCase() === catName.toLowerCase()
        );
        const catTotal = entries.reduce((s, e) => s + e.amount, 0);
        return (
          <div key={catName}>
            <div
              className="px-4 py-2 bg-gray-50 border-y border-gray-200 flex items-center justify-between"
              style={{ backgroundColor: cat ? `${cat.color}12` : undefined }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat?.icon ?? "📋"}</span>
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  {catName}
                </span>
              </div>
              <span className="text-sm font-bold text-red-600">
                −{catTotal}€
              </span>
            </div>
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {entry.description}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {formatDateLongRu(entry.dateKey)}
                    {entry.teamId && teamById.get(entry.teamId)
                      ? ` • ${teamById.get(entry.teamId)}`
                      : ""}
                  </div>
                </div>
                <div className="text-sm font-semibold text-red-600">
                  −{entry.amount} €
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <TotalRow label="Итого расход" value={-total} color="red" />
    </>
  );
}

function CombinedSummary({
  incomeCount,
  expenseCount,
  totalIncome,
  totalExpense,
}: {
  incomeCount: number;
  expenseCount: number;
  totalIncome: number;
  totalExpense: number;
}) {
  const profit = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? Math.round((profit / totalIncome) * 100) : 0;

  return (
    <div>
      <div className="px-4 py-4 space-y-3 border-b border-gray-200">
        <Row label="Доход" value={`+${totalIncome}€`} color="emerald" />
        <Row label="Расход" value={`−${totalExpense}€`} color="red" />
        <div className="h-px bg-gray-200" />
        <Row
          label="Прибыль"
          value={`${profit >= 0 ? "+" : ""}${profit}€`}
          color={profit >= 0 ? "indigo" : "red"}
          bold
        />
        <Row label="Маржа" value={`${margin}%`} color="gray" />
      </div>

      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Счёт записей
        </div>
        <div className="mt-1 grid grid-cols-2 gap-2 text-[12px]">
          <div className="text-gray-700">
            Доходных строк: <span className="font-semibold">{incomeCount}</span>
          </div>
          <div className="text-gray-700">
            Расходных строк: <span className="font-semibold">{expenseCount}</span>
          </div>
        </div>
      </div>

      {profit < 0 && (
        <div className="px-4 py-3 text-[12px] text-red-600 bg-red-50 border-b border-red-100">
          ⚠ За выбранный период расходы превышают доходы.
        </div>
      )}

      {incomeCount === 0 && expenseCount === 0 && (
        <div className="px-4 py-6 text-center text-[12px] text-gray-400">
          Нет данных за выбранный период.
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  color,
  bold = false,
}: {
  label: string;
  value: string;
  color: "emerald" | "red" | "indigo" | "gray";
  bold?: boolean;
}) {
  const colorClass =
    color === "emerald"
      ? "text-emerald-600"
      : color === "red"
        ? "text-red-600"
        : color === "indigo"
          ? "text-indigo-600"
          : "text-gray-600";
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-gray-600">{label}</span>
      <span
        className={`tabular-nums ${colorClass} ${bold ? "text-[16px] font-bold" : "text-[14px] font-semibold"}`}
      >
        {value}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "red";
}) {
  const colorClass = color === "emerald" ? "text-emerald-600" : "text-red-600";
  return (
    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{label}:</span>
        <span className={`text-base font-bold tabular-nums ${colorClass}`}>
          {value >= 0 ? "+" : ""}
          {value} €
        </span>
      </div>
    </div>
  );
}

// ─── Categories management sheet (unchanged) ───────────────────────────

function ExpenseCategoriesSheet({
  categories,
  onClose,
  onSave,
}: {
  categories: ExpenseCategory[];
  onClose: () => void;
  onSave: (next: ExpenseCategory[]) => void;
}) {
  const [draft, setDraft] = useState<ExpenseCategory[]>(categories);

  const update = (id: string, patch: Partial<ExpenseCategory>) => {
    setDraft((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const remove = (id: string) =>
    setDraft((prev) => prev.filter((c) => c.id !== id));
  const add = () => setDraft((prev) => [...prev, createBlankExpenseCategory()]);

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40">
      <div className="w-full lg:max-w-lg bg-white rounded-t-2xl lg:rounded-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            Категории расходов
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {draft.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 bg-gray-50 rounded-lg p-2"
            >
              <input
                type="text"
                value={c.icon}
                onChange={(e) => update(c.id, { icon: e.target.value.slice(0, 2) })}
                className="w-10 text-center text-xl bg-white border border-gray-300 rounded"
                placeholder="📋"
              />
              <input
                type="color"
                value={c.color}
                onChange={(e) => update(c.id, { color: e.target.value })}
                className="w-10 h-10 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={c.name}
                onChange={(e) => update(c.id, { name: e.target.value })}
                placeholder="Название"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm text-gray-900"
              />
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="w-8 h-8 text-red-500 hover:bg-red-50 rounded"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={add}
            className="w-full py-2 text-sm font-medium text-indigo-600 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50"
          >
            + Новая категория
          </button>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
