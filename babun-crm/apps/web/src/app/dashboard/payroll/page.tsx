"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { loadBrigades, loadBrigadeMembers, type Brigade, type BrigadeMember } from "@/lib/brigades";
import {
  loadPayrollPeriods,
  generateWeeklyPercent,
  approvePeriod,
  markPaid,
  isoWeekRange,
  type PayrollPeriod,
  type WeekRange,
} from "@/lib/payroll";
import { loadPayments, type FinancePayment } from "@/lib/payments";
import { loadExpenses, type Expense } from "@/lib/expenses";
import { formatEUR } from "@/lib/money";

// ─── Helpers ────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function fmt(d: Date) { return d.toISOString().slice(0, 10); }

function weekLabel(range: WeekRange): string {
  const s = new Date(range.start + "T00:00:00");
  const e = new Date(range.end + "T00:00:00");
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${s.getDate()} ${months[s.getMonth()]} — ${e.getDate()} ${months[e.getMonth()]}`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  approved: "Подтверждён",
  paid: "Выплачен",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700",
};

// ─── Payroll Period Detail ───────────────────────────────────────────────────

function PeriodDetail({
  period,
  members,
  onAction,
}: {
  period: PayrollPeriod;
  members: BrigadeMember[];
  onAction: () => void;
}) {
  const canApprove = period.status === "draft";
  const canPay     = period.status === "approved";

  const handleApprove = () => {
    if (!confirm("Подтвердить период? Будут созданы записи расходов (зарплата).")) return;
    approvePeriod(period.id);
    onAction();
  };

  const handlePay = () => {
    if (!confirm("Отметить как выплачено?")) return;
    markPaid(period.id);
    onAction();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-gray-900">{weekLabel({ start: period.periodStart, end: period.periodEnd })}</div>
          <div className="text-[11px] text-gray-500">{period.type === "weekly_percent" ? "% от выручки" : "Базовая ставка"}</div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[period.status]}`}>
          {STATUS_LABELS[period.status]}
        </span>
      </div>

      {period.lines.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">Нет строк выплат</div>
      ) : (
        <div>
          {period.lines.map((line, i) => {
            const member = members.find((m) => m.masterId === line.masterId);
            return (
              <div key={line.id} className={`px-4 py-3 flex items-center gap-3 ${i < period.lines.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900">
                    {member ? `${member.masterId} (${member.role === "lead" ? "лид" : "помощник"})` : line.masterId}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">{line.description}</div>
                </div>
                <span className="text-[15px] font-bold text-violet-700 tabular-nums">
                  {formatEUR(line.amountCents)}
                </span>
              </div>
            );
          })}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between">
            <span className="text-sm font-semibold text-gray-700">Итого к выплате</span>
            <span className="text-base font-bold text-violet-700 tabular-nums">{formatEUR(period.totalCents)}</span>
          </div>
        </div>
      )}

      {(canApprove || canPay) && (
        <div className="px-4 py-3 border-t border-gray-200 flex gap-2">
          {canApprove && (
            <button
              type="button"
              onClick={handleApprove}
              className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold"
            >
              Подтвердить
            </button>
          )}
          {canPay && (
            <button
              type="button"
              onClick={handlePay}
              className="flex-1 h-10 bg-green-600 text-white rounded-xl text-sm font-semibold"
            >
              Отметить выплаченным
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Week preview (no period yet) ───────────────────────────────────────────

function WeekPreview({
  brigade,
  range,
  members,
  payments,
  expenses,
  onGenerate,
}: {
  brigade: Brigade;
  range: WeekRange;
  members: BrigadeMember[];
  payments: FinancePayment[];
  expenses: Expense[];
  onGenerate: () => void;
}) {
  const weekPayments = payments.filter(
    (p) => p.brigadeId === brigade.id && p.paidAt >= range.start && p.paidAt <= range.end + "T23:59:59"
  );
  const revenueCents = weekPayments.reduce((s, p) => s + p.amountCents, 0);

  const weekExpenses = expenses.filter(
    (e) => e.brigadeId === brigade.id && e.date >= range.start && e.date <= range.end
  );
  const expenseCents = weekExpenses.reduce((s, e) => s + e.amountCents, 0);

  const netCents = Math.max(0, revenueCents - expenseCents);

  const activeMembers = members.filter(
    (m) => m.brigadeId === brigade.id && m.joinedAt <= range.end && (m.leftAt === null || m.leftAt >= range.start)
  );

  const lines = activeMembers.map((m) => ({
    masterId: m.masterId,
    role: m.role,
    percentRate: m.percentRate,
    amountCents: Math.round((revenueCents * m.percentRate) / 100),
  }));
  const totalPayoutCents = lines.reduce((s, l) => s + l.amountCents, 0);
  const companyShareCents = netCents - totalPayoutCents;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider">Предварительный расчёт</div>
      </div>

      <div className="px-4 py-3 space-y-1.5 border-b border-gray-100">
        <div className="flex justify-between text-[13px]">
          <span className="text-gray-600">Выручка недели</span>
          <span className="font-semibold text-emerald-600 tabular-nums">+{formatEUR(revenueCents)}</span>
        </div>
        <div className="flex justify-between text-[13px]">
          <span className="text-gray-600">Расходы бригады</span>
          <span className="font-semibold text-rose-600 tabular-nums">−{formatEUR(expenseCents)}</span>
        </div>
        <div className="flex justify-between text-[13px] pt-1 border-t border-gray-100">
          <span className="font-medium text-gray-900">Чистый доход</span>
          <span className="font-bold text-indigo-600 tabular-nums">{formatEUR(netCents)}</span>
        </div>
      </div>

      {activeMembers.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">Нет участников бригады в этом периоде</div>
      ) : (
        <div>
          {lines.map((l, i) => (
            <div key={l.masterId} className={`px-4 py-2.5 flex items-center gap-2 ${i < lines.length - 1 ? "border-b border-gray-100" : ""}`}>
              <div className="flex-1 text-[13px] text-gray-900">
                {l.masterId} <span className="text-[11px] text-gray-500">({l.role === "lead" ? "лид" : "помощник"}, {l.percentRate}%)</span>
              </div>
              <span className="text-[14px] font-bold text-violet-700 tabular-nums">{formatEUR(l.amountCents)}</span>
            </div>
          ))}
          <div className="px-4 py-3 bg-violet-50 border-t border-violet-100 space-y-1.5">
            <div className="flex justify-between text-[13px]">
              <span className="font-semibold text-violet-800">Итого выплаты</span>
              <span className="font-bold text-violet-800 tabular-nums">{formatEUR(totalPayoutCents)}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-gray-500">Остаток компании</span>
              <span className={`font-semibold tabular-nums ${companyShareCents >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatEUR(companyShareCents)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-3 border-t border-gray-200">
        <button
          type="button"
          onClick={onGenerate}
          className="w-full h-10 bg-violet-600 text-white rounded-xl text-sm font-semibold"
        >
          Закрыть неделю и создать период
        </button>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PayrollPage() {
  const [brigades, setBrigades] = useState<Brigade[]>([]);
  const [members, setMembers] = useState<BrigadeMember[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [payments, setPayments] = useState<FinancePayment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeBrigadeId, setActiveBrigadeId] = useState<string>("");
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = last week

  const reload = useCallback(() => {
    const bs = loadBrigades();
    setBrigades(bs);
    setMembers(loadBrigadeMembers());
    setPeriods(loadPayrollPeriods());
    setPayments(loadPayments());
    setExpenses(loadExpenses());
    if (!activeBrigadeId && bs.length > 0) setActiveBrigadeId(bs[0].id);
  }, [activeBrigadeId]);

  useEffect(() => { reload(); }, [reload]);

  const weekRange = useMemo<WeekRange>(() => {
    const base = new Date();
    const target = addDays(base, weekOffset * 7);
    return isoWeekRange(fmt(target));
  }, [weekOffset]);

  const activeBrigade = brigades.find((b) => b.id === activeBrigadeId) ?? null;

  const existingPeriod = useMemo(() => {
    return periods.find(
      (p) => p.brigadeId === activeBrigadeId && p.periodStart === weekRange.start && p.periodEnd === weekRange.end
    ) ?? null;
  }, [periods, activeBrigadeId, weekRange]);

  const handleGenerate = () => {
    if (!activeBrigadeId) return;
    generateWeeklyPercent(activeBrigadeId, weekRange);
    reload();
  };

  if (brigades.length === 0) {
    return (
      <>
        <PageHeader title="Зарплата" />
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-400 text-sm p-8">
            Нет бригад. Добавьте их в разделе Бригады.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Зарплата" />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {/* Brigade tabs */}
        <div className="bg-white border-b border-gray-200 flex overflow-x-auto">
          {brigades.filter((b) => b.isActive).map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveBrigadeId(b.id)}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
                activeBrigadeId === b.id
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        {/* Week navigation */}
        <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setWeekOffset((v) => v - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900">{weekLabel(weekRange)}</div>
            <div className="text-[11px] text-gray-500">
              {weekOffset === 0 ? "Текущая неделя" : weekOffset === -1 ? "Прошлая неделя" : `${Math.abs(weekOffset)} нед. назад`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset((v) => Math.min(0, v + 1))}
            disabled={weekOffset === 0}
            className={`w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 ${weekOffset === 0 ? "opacity-30" : "hover:bg-gray-100"}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>

        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3">
          {activeBrigade?.type === "outsource" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              Аутсорс-бригада — зарплата рассчитывается по фиксированной стоимости за работу, а не по % от выручки.
            </div>
          )}

          {existingPeriod ? (
            <PeriodDetail
              period={existingPeriod}
              members={members}
              onAction={reload}
            />
          ) : activeBrigade ? (
            <WeekPreview
              brigade={activeBrigade}
              range={weekRange}
              members={members}
              payments={payments}
              expenses={expenses}
              onGenerate={handleGenerate}
            />
          ) : null}

          {/* Past periods for this brigade */}
          {periods.filter((p) => p.brigadeId === activeBrigadeId && p.id !== existingPeriod?.id).length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 px-1 mb-2">
                Прошлые периоды
              </div>
              <div className="space-y-2">
                {periods
                  .filter((p) => p.brigadeId === activeBrigadeId && p.id !== existingPeriod?.id)
                  .sort((a, b) => b.periodStart.localeCompare(a.periodStart))
                  .slice(0, 5)
                  .map((p) => (
                    <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between">
                      <div>
                        <div className="text-[13px] font-medium text-gray-900">{weekLabel({ start: p.periodStart, end: p.periodEnd })}</div>
                        <div className="text-[11px] text-gray-500">{STATUS_LABELS[p.status]}</div>
                      </div>
                      <span className="text-[15px] font-bold text-violet-700 tabular-nums">{formatEUR(p.totalCents)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
