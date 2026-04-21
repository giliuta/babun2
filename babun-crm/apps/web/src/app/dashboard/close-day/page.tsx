"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  AlertTriangle,
  Wallet as WalletIcon,
  ArrowLeft,
} from "lucide-react";
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
import { Button } from "@/components/ui";

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
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto p-3 lg:p-4 space-y-3">

          {closed && (
            <div className="rounded-2xl bg-[rgba(52,199,89,0.12)] p-4 flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-[var(--system-green)] text-white flex items-center justify-center shrink-0">
                <Check size={22} strokeWidth={2.5} />
              </span>
              <div className="flex-1">
                <div className="text-[17px] font-semibold text-[var(--label)]">
                  День закрыт
                </div>
                <div className="text-[13px] text-[var(--label-secondary)] mt-0.5">
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
                  className="mt-2 text-[13px] font-semibold text-[var(--system-green)] underline underline-offset-2"
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
            <Row label="Доход" value={formatEUR(summary.fin.totalIncome)} tone="green" />
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
              <div className="flex items-baseline justify-between text-[15px]">
                <span className="text-[var(--label-secondary)]">Должно быть</span>
                <span className="font-semibold text-[var(--label)] tabular-nums">
                  {formatEUR(expectedCash)}
                </span>
              </div>
              <label className="block mt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
                  Сколько в кассе фактически (€)
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={actualCashStr}
                  onChange={(e) => setActualCashStr(e.target.value)}
                  placeholder={String(expectedCash)}
                  className="w-full h-12 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[17px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] tabular-nums focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
                />
              </label>
              {actualCashStr && (
                <div
                  className={`mt-2 text-[13px] tabular-nums font-medium ${
                    delta === 0 || delta > 0
                      ? "text-[var(--system-green)]"
                      : "text-[var(--system-red)]"
                  }`}
                >
                  {delta === 0
                    ? "Касса сошлась"
                    : delta > 0
                      ? `+${formatEUR(delta)} больше ожидаемого`
                      : `Не хватает ${formatEUR(Math.abs(delta))}`}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={closeDay}
                disabled={!actualCashStr}
                className="mt-4"
              >
                Закрыть день
              </Button>
            </Section>
          )}

          <Button
            variant="secondary"
            fullWidth
            onClick={() => router.push("/dashboard")}
            leadingIcon={<ArrowLeft size={16} strokeWidth={2} />}
          >
            Вернуться в календарь
          </Button>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-3">
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
  tone?: "green" | "red";
}) {
  const valueClass =
    tone === "green"
      ? "text-[var(--system-green)] font-bold"
      : tone === "red"
        ? "text-[var(--system-red)] font-bold"
        : "text-[var(--label)] font-semibold";
  return (
    <div className="flex items-baseline justify-between text-[15px]">
      <span className="text-[var(--label-secondary)]">{label}</span>
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
    <div className="flex items-center gap-3 p-2 rounded-xl bg-[rgba(255,59,48,0.06)]">
      <span className="w-9 h-9 rounded-lg bg-[rgba(255,59,48,0.12)] text-[var(--system-red)] flex items-center justify-center shrink-0">
        <AlertTriangle size={16} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-[var(--label)] truncate">
          {name}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
          {apt.time_start} · долг {formatEUR(debt)}
        </div>
      </div>
      <button
        type="button"
        onClick={onPaidCash}
        className="shrink-0 h-9 px-3 rounded-lg bg-[var(--system-green)] text-white text-[13px] font-semibold active:scale-[0.97]"
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
        <div className="text-[15px] font-semibold text-[var(--label)] truncate">
          {name}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
          {apt.time_start}–{apt.time_end} · ещё в плане
        </div>
      </div>
      <button
        type="button"
        onClick={onMoveTomorrow}
        className="shrink-0 h-9 px-3 rounded-lg bg-[var(--fill-primary)] text-[var(--label)] text-[13px] font-semibold active:scale-[0.97] active:bg-[var(--fill-secondary)]"
      >
        На завтра
      </button>
    </div>
  );
}

