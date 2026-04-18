"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
  loadBrigades,
  type Brigade,
} from "@/lib/brigades";
import {
  loadExpenses,
  createExpense,
  deleteExpense,
  type Expense,
  type ExpenseCategory,
} from "@/lib/expenses";
import { formatEUR } from "@/lib/money";

// ─── Category config ────────────────────────────────────────────────────────

const CAT_CONFIG: Record<ExpenseCategory, { label: string; emoji: string; color: string }> = {
  lunch:    { label: "Питание",     emoji: "🍽",  color: "#f59e0b" },
  car_rent: { label: "Аренда авто", emoji: "🚗",  color: "#6366f1" },
  fuel:     { label: "Бензин",      emoji: "⛽",  color: "#f97316" },
  supplies: { label: "Расходники",  emoji: "🔧",  color: "#8b5cf6" },
  salary:   { label: "Зарплата",    emoji: "💰",  color: "#10b981" },
  other:    { label: "Прочее",      emoji: "📋",  color: "#6b7280" },
};

const CAT_KEYS = Object.keys(CAT_CONFIG) as ExpenseCategory[];

// ─── Period helpers ─────────────────────────────────────────────────────────

type PeriodKey =
  | "today" | "yesterday"
  | "this_week" | "last_week"
  | "this_month" | "last_month"
  | "this_year" | "all";

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today",       label: "Сегодня" },
  { key: "yesterday",   label: "Вчера" },
  { key: "this_week",   label: "Эта неделя" },
  { key: "last_week",   label: "Прошлая неделя" },
  { key: "this_month",  label: "Этот месяц" },
  { key: "last_month",  label: "Прошлый месяц" },
  { key: "this_year",   label: "Этот год" },
  { key: "all",         label: "Весь период" },
];

function fmt(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function getDateRange(period: PeriodKey): { from: string; to: string } | null {
  const today = new Date();
  if (period === "all") return null;
  if (period === "today") { const t = fmt(today); return { from: t, to: t }; }
  if (period === "yesterday") { const y = fmt(addDays(today, -1)); return { from: y, to: y }; }
  const dow = today.getDay();
  const diffMon = dow === 0 ? -6 : 1 - dow;
  if (period === "this_week") {
    const mon = addDays(today, diffMon);
    return { from: fmt(mon), to: fmt(addDays(mon, 6)) };
  }
  if (period === "last_week") {
    const mon = addDays(today, diffMon - 7);
    return { from: fmt(mon), to: fmt(addDays(mon, 6)) };
  }
  if (period === "this_month") {
    return {
      from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
      to:   fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
  }
  if (period === "last_month") {
    return {
      from: fmt(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to:   fmt(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  if (period === "this_year") {
    return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
  }
  return null;
}

// ─── Demo seed ──────────────────────────────────────────────────────────────

function seedDemoExpenses(): void {
  const today = fmt(new Date());
  const demos: Omit<Expense, "id" | "createdAt">[] = [
    { scope: "brigade", brigadeId: "br_yd", appointmentId: null, category: "fuel",     description: "Бензин Y&D",        amountCents: 4000, date: today },
    { scope: "brigade", brigadeId: "br_yd", appointmentId: null, category: "lunch",    description: "Обед бригады Y&D",   amountCents: 2000, date: today },
    { scope: "brigade", brigadeId: "br_dk", appointmentId: null, category: "fuel",     description: "Бензин D&K",        amountCents: 3500, date: today },
    { scope: "company", brigadeId: null,    appointmentId: null, category: "car_rent", description: "Аренда авто май",    amountCents: 40000, date: today },
    { scope: "brigade", brigadeId: "br_yd", appointmentId: null, category: "supplies", description: "Расходники монтаж", amountCents: 1500, date: today },
    { scope: "company", brigadeId: null,    appointmentId: null, category: "other",    description: "Офисные расходы",   amountCents: 5000, date: today },
  ];
  demos.forEach((d) => createExpense(d));
}

// ─── Pie chart (CSS conic-gradient) ─────────────────────────────────────────

function PieChart({ data }: { data: { color: string; pct: number }[] }) {
  const stops = data.reduce<string[]>((acc, { color, pct }) => {
    const prev = acc.length === 0 ? 0 : Number(acc[acc.length - 1].match(/[\d.]+%/g)?.[1] ?? "0");
    const end = prev + pct;
    acc.push(`${color} ${prev.toFixed(1)}% ${end.toFixed(1)}%`);
    return acc;
  }, []);
  const gradient = `conic-gradient(${stops.join(", ")})`;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <div className="w-28 h-28 rounded-full" style={{ background: gradient }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-white" />
      </div>
    </div>
  );
}

// ─── Add Expense Form ────────────────────────────────────────────────────────

function AddExpenseForm({
  brigades,
  defaultBrigadeId,
  onAdd,
  onCancel,
}: {
  brigades: Brigade[];
  defaultBrigadeId: string | null;
  onAdd: () => void;
  onCancel: () => void;
}) {
  const today = fmt(new Date());
  const [category, setCategory] = useState<ExpenseCategory>("fuel");
  const [amountEur, setAmountEur] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today);
  const [scope, setScope] = useState<"brigade" | "company">(defaultBrigadeId ? "brigade" : "company");
  const [brigadeId, setBrigadeId] = useState<string | null>(defaultBrigadeId ?? brigades[0]?.id ?? null);

  const submit = () => {
    const cents = Math.round(parseFloat(amountEur.replace(",", ".")) * 100);
    if (!cents || cents <= 0) { alert("Введите сумму"); return; }
    if (!date) { alert("Укажите дату"); return; }
    createExpense({
      scope,
      brigadeId: scope === "brigade" ? brigadeId : null,
      appointmentId: null,
      category,
      description: description.trim() || CAT_CONFIG[category].label,
      amountCents: cents,
      date,
    });
    onAdd();
  };

  return (
    <div className="border-t border-indigo-100 bg-indigo-50/40 px-4 py-4 space-y-3">
      <div className="text-xs font-semibold text-indigo-700">Новый расход</div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Категория</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {CAT_KEYS.map((k) => (
              <option key={k} value={k}>
                {CAT_CONFIG[k].emoji} {CAT_CONFIG[k].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Сумма (€)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amountEur}
            onChange={(e) => setAmountEur(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Дата</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Тип</label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as "brigade" | "company")}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="brigade">Бригада</option>
            <option value="company">Компания</option>
          </select>
        </div>
      </div>

      {scope === "brigade" && (
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Бригада</label>
          <select
            value={brigadeId ?? ""}
            onChange={(e) => setBrigadeId(e.target.value || null)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {brigades.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-[11px] text-gray-500 mb-1">Комментарий</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={CAT_CONFIG[category].label}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-9 border border-gray-300 rounded-lg text-sm text-gray-700"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={submit}
          className="flex-1 h-9 bg-indigo-600 text-white rounded-lg text-sm font-semibold"
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [activeBrigade, setActiveBrigade] = useState<string>("all");
  const [showPeriodMenu, setShowPeriodMenu] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const reload = useCallback(() => {
    setExpenses(loadExpenses());
    setBrigades(loadBrigades());
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const range = useMemo(() => getDateRange(period), [period]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (activeBrigade !== "all" && e.brigadeId !== activeBrigade) return false;
      if (range) {
        if (e.date < range.from || e.date > range.to) return false;
      }
      return true;
    });
  }, [expenses, activeBrigade, range]);

  const total = useMemo(() => filtered.reduce((s, e) => s + e.amountCents, 0), [filtered]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => { map[e.category] = (map[e.category] ?? 0) + e.amountCents; });
    return map;
  }, [filtered]);

  const pieData = useMemo(() => {
    if (total === 0) return [];
    return CAT_KEYS
      .filter((k) => byCategory[k])
      .map((k) => ({ color: CAT_CONFIG[k].color, pct: (byCategory[k] / total) * 100 }));
  }, [byCategory, total]);

  const handleDelete = (id: string) => {
    if (!confirm("Удалить этот расход?")) return;
    deleteExpense(id);
    reload();
  };

  const selectedLabel = PERIODS.find((p) => p.key === period)?.label ?? "";

  const brigadeForForm = activeBrigade !== "all" ? activeBrigade : brigades[0]?.id ?? null;

  return (
    <>
      <PageHeader
        title="Расходы"
        rightContent={
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white hover:bg-indigo-600 lg:text-gray-700 lg:hover:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {/* Period selector */}
        <div className="relative bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowPeriodMenu((v) => !v)}
            className="flex items-center gap-1 text-sm font-semibold text-gray-900"
          >
            {selectedLabel}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          <span className="text-sm font-bold text-rose-600 tabular-nums">{total > 0 ? `−${formatEUR(total)}` : "€0"}</span>
          {showPeriodMenu && (
            <div className="absolute top-full left-0 mt-0 bg-white shadow-lg rounded-b-xl z-20 w-56 border border-gray-200 border-t-0">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => { setPeriod(p.key); setShowPeriodMenu(false); }}
                  className={`w-full text-left px-4 py-2.5 text-sm ${period === p.key ? "text-indigo-600 font-semibold bg-indigo-50" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Brigade tabs */}
        <div className="bg-white border-b border-gray-200 flex overflow-x-auto">
          {[{ id: "all", name: "Все" }, ...brigades].map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBrigade(b.id)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeBrigade === b.id
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="bg-white border-b border-gray-200">
            <AddExpenseForm
              brigades={brigades}
              defaultBrigadeId={brigadeForForm}
              onAdd={() => { reload(); setShowAddForm(false); }}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        )}

        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3">
          {/* Pie + breakdown */}
          {filtered.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex gap-4 items-start">
                {pieData.length > 1 ? <PieChart data={pieData} /> : null}
                <div className="flex-1 space-y-1.5">
                  {CAT_KEYS.filter((k) => byCategory[k]).map((k) => {
                    const amt = byCategory[k];
                    const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
                    return (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-base">{CAT_CONFIG[k].emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <span className="text-[12px] text-gray-700">{CAT_CONFIG[k].label}</span>
                            <span className="text-[12px] font-semibold text-rose-600 tabular-nums">
                              {formatEUR(amt)}
                            </span>
                          </div>
                          <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CAT_CONFIG[k].color }} />
                          </div>
                        </div>
                        <span className="text-[11px] text-gray-400 w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Expense list */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="text-3xl mb-2">📊</div>
              <div className="text-sm text-gray-500 mb-4">Расходов за этот период нет</div>
              {expenses.length === 0 && (
                <button
                  type="button"
                  onClick={() => { seedDemoExpenses(); reload(); }}
                  className="text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg px-4 py-2"
                >
                  Засеять демо-данные
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {[...filtered].sort((a, b) => b.date.localeCompare(a.date)).map((e, i, arr) => {
                const cfg = CAT_CONFIG[e.category];
                const brigade = brigades.find((b) => b.id === e.brigadeId);
                return (
                  <div
                    key={e.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i < arr.length - 1 ? "border-b border-gray-100" : ""}`}
                  >
                    <span className="text-xl w-7 text-center shrink-0">{cfg.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-gray-900 truncate">{e.description}</div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {e.date} · {cfg.label}{brigade ? ` · ${brigade.name}` : ""}
                      </div>
                    </div>
                    <span className="text-[14px] font-semibold text-rose-600 tabular-nums shrink-0">
                      −{formatEUR(e.amountCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(e.id)}
                      aria-label="Удалить"
                      className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 rounded shrink-0"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                );
              })}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between">
                <span className="text-sm text-gray-500">Итого</span>
                <span className="text-sm font-bold text-rose-600 tabular-nums">−{formatEUR(total)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
