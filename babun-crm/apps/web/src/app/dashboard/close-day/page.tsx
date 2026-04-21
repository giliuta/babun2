"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle, Wallet as WalletIcon } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import {
  useAppointments,
  useDayExtras,
  useServices,
  useTeams,
  useClients,
} from "@/app/dashboard/layout";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { computeFinancials } from "@/lib/finance/compute";
import { type Appointment, getDebtAmount } from "@/lib/appointments";
import { formatEUR } from "@/lib/money";

// "Закрыть день" flow — dispatcher's evening sign-off. Sprint 020 F2.
//
// Three sections, top to bottom:
//   1. Today's snapshot — count, cash, debt, expected total
//   2. Outstanding visits — completed-without-payment + still-scheduled
//      late visits. One-tap per row to mark paid (cash) or move to
//      tomorrow.
//   3. Cashbox confirmation — actual cash entered, compared with
//      expected cashbox. Saves a `babun:closed-day:YYYY-MM-DD` flag
//      so the EndOfDayBanner stops nagging.

const CLOSED_PREFIX = "babun:closed-day:";

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CloseDayPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const { appointments, upsertAppointment } = useAppointments();
  const { getExtrasFor } = useDayExtras();
  const { services } = useServices();
  const { teams } = useTeams();
  const { clients } = useClients();

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [actualCashStr, setActualCashStr] = useState<string>("");
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setClosed(window.localStorage.getItem(`${CLOSED_PREFIX}${todayKey}`) === "1");
  }, [todayKey]);

  const summary = useMemo(() => {
    const apts = appointments.filter((a) => a.date === todayKey);
    const completed = apts.filter((a) => a.status === "completed");
    const inProgress = apts.filter((a) => a.status === "in_progress");
    const stillScheduled = apts.filter(
      (a) => a.status === "scheduled" && a.kind === "work"
    );
    const unpaid = completed.filter((a) => getDebtAmount(a) > 0);

    const fin = computeFinancials({
      appointments,
      services,
      teams,
      dayExtrasOf: getExtrasFor,
      standalonePayments: [],
      standaloneExpenses: [],
      range: { from: todayKey, to: todayKey },
      teamFilter: "all",
    });

    return { completed, inProgress, stillScheduled, unpaid, fin };
  }, [appointments, services, teams, getExtrasFor, todayKey]);

  const expectedCash = summary.fin.cash;
  const actualCash = Math.round(Number(actualCashStr.replace(",", ".")) || 0);
  const delta = actualCash - expectedCash;

  const closeDay = async () => {
    if (summary.stillScheduled.length > 0) {
      const ok = await confirm({
        title: "Остались запланированные записи",
        message: `${summary.stillScheduled.length} записей не выполнены. Закрыть день всё равно?`,
        confirmLabel: "Закрыть",
        danger: false,
      });
      if (!ok) return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        `${CLOSED_PREFIX}${todayKey}`,
        JSON.stringify({ closedAt: new Date().toISOString(), expectedCash, actualCash, delta })
      );
    }
    setClosed(true);
  };

  const reopen = async () => {
    const ok = await confirm({
      title: "Открыть день обратно?",
      message: "Можно будет ещё что-то изменить.",
      confirmLabel: "Открыть",
      danger: false,
    });
    if (!ok) return;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(`${CLOSED_PREFIX}${todayKey}`);
    }
    setClosed(false);
  };

  const markPaidCash = (apt: Appointment) => {
    const debt = getDebtAmount(apt);
    if (debt <= 0) return;
    upsertAppointment({
      ...apt,
      payments: [
        ...apt.payments,
        {
          id: `pay-${Date.now()}`,
          method: "cash",
          amount: debt,
          paid_at: new Date().toISOString(),
        },
      ],
      updated_at: new Date().toISOString(),
    });
  };

  const moveToTomorrow = (apt: Appointment) => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    upsertAppointment({
      ...apt,
      date: toDateKey(next),
      updated_at: new Date().toISOString(),
    });
  };

  const clientName = (apt: Appointment): string =>
    (apt.client_id && clients.find((c) => c.id === apt.client_id)?.full_name) ||
    apt.comment ||
    "Запись";

  return (
    <>
      <PageHeader title="Закрыть день" backHref="/dashboard" />
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-xl mx-auto p-3 lg:p-4 space-y-3">

          {closed && (
            <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-4 flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Check size={22} strokeWidth={2.5} />
              </span>
              <div className="flex-1">
                <div className="text-[15px] font-semibold text-emerald-900">
                  День закрыт
                </div>
                <div className="text-[12px] text-emerald-700/70 mt-0.5">
                  Касса сошлась на {formatEUR(actualCash)} ·{" "}
                  {delta === 0
                    ? "без расхождений"
                    : delta > 0
                      ? `+${formatEUR(delta)} больше ожидаемого`
                      : `${formatEUR(delta)} меньше ожидаемого`}
                </div>
                <button
                  type="button"
                  onClick={reopen}
                  className="mt-2 text-[12px] font-semibold text-emerald-700 underline underline-offset-2"
                >
                  Открыть обратно
                </button>
              </div>
            </div>
          )}

          {/* 1. Today's snapshot */}
          <Section title="Сегодня">
            <Row label="Завершено" value={String(summary.completed.length)} />
            <Row label="В работе" value={String(summary.inProgress.length)} />
            <Row label="Ещё запланировано" value={String(summary.stillScheduled.length)} />
            <Row label="Доход" value={formatEUR(summary.fin.totalIncome)} tone="emerald" />
          </Section>

          {/* 2. Outstanding work */}
          {(summary.unpaid.length > 0 || summary.stillScheduled.length > 0) && !closed && (
            <Section title="Что осталось">
              {summary.unpaid.map((apt) => (
                <UnpaidRow
                  key={apt.id}
                  apt={apt}
                  name={clientName(apt)}
                  onPaidCash={() => markPaidCash(apt)}
                />
              ))}
              {summary.stillScheduled.map((apt) => (
                <ScheduledRow
                  key={apt.id}
                  apt={apt}
                  name={clientName(apt)}
                  onMoveTomorrow={() => moveToTomorrow(apt)}
                />
              ))}
            </Section>
          )}

          {/* 3. Cashbox sign-off */}
          {!closed && (
            <Section title="Касса">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-slate-600">Должно быть</span>
                <span className="font-semibold text-slate-900">
                  {formatEUR(expectedCash)}
                </span>
              </div>
              <label className="block mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Сколько в кассе фактически (€)
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={actualCashStr}
                  onChange={(e) => setActualCashStr(e.target.value)}
                  placeholder={String(expectedCash)}
                  className="w-full h-12 px-3 rounded-lg border border-slate-200 text-[16px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-violet-400"
                />
              </label>
              {actualCashStr && (
                <div
                  className={`mt-2 text-[12px] tabular-nums ${
                    delta === 0
                      ? "text-emerald-700"
                      : delta > 0
                        ? "text-emerald-700"
                        : "text-rose-700"
                  }`}
                >
                  {delta === 0
                    ? "Касса сошлась"
                    : delta > 0
                      ? `+${formatEUR(delta)} больше ожидаемого`
                      : `Не хватает ${formatEUR(Math.abs(delta))}`}
                </div>
              )}

              <button
                type="button"
                onClick={closeDay}
                disabled={!actualCashStr}
                className="w-full mt-4 h-12 rounded-xl bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.99] disabled:opacity-40"
              >
                Закрыть день
              </button>
            </Section>
          )}

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-medium active:bg-slate-200"
          >
            ← Вернуться в календарь
          </button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose";
}) {
  const valueClass =
    tone === "emerald"
      ? "text-emerald-700 font-bold"
      : tone === "rose"
        ? "text-rose-700 font-bold"
        : "text-slate-900 font-semibold";
  return (
    <div className="flex items-baseline justify-between text-[13px]">
      <span className="text-slate-600">{label}</span>
      <span className={`tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

function UnpaidRow({
  apt,
  name,
  onPaidCash,
}: {
  apt: Appointment;
  name: string;
  onPaidCash: () => void;
}) {
  const debt = getDebtAmount(apt);
  return (
    <div className="flex items-center gap-3 p-2 rounded-xl bg-rose-50/40">
      <span className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
        <AlertTriangle size={16} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-900 truncate">
          {name}
        </div>
        <div className="text-[11px] text-slate-500 tabular-nums">
          {apt.time_start} · долг {formatEUR(debt)}
        </div>
      </div>
      <button
        type="button"
        onClick={onPaidCash}
        className="shrink-0 h-9 px-3 rounded-lg bg-emerald-500 text-white text-[12px] font-semibold active:scale-[0.97]"
      >
        Оплачено
      </button>
    </div>
  );
}

function ScheduledRow({
  apt,
  name,
  onMoveTomorrow,
}: {
  apt: Appointment;
  name: string;
  onMoveTomorrow: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-xl bg-amber-50/40">
      <span className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
        <WalletIcon size={16} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-slate-900 truncate">
          {name}
        </div>
        <div className="text-[11px] text-slate-500 tabular-nums">
          {apt.time_start}–{apt.time_end} · ещё в плане
        </div>
      </div>
      <button
        type="button"
        onClick={onMoveTomorrow}
        className="shrink-0 h-9 px-3 rounded-lg bg-slate-200 text-slate-700 text-[12px] font-semibold active:scale-[0.97]"
      >
        На завтра
      </button>
    </div>
  );
}

