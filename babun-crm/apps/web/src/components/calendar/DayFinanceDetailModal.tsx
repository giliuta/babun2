"use client";

import { useEffect, useMemo, useState } from "react";
import DialogModal from "@/components/appointment/DialogModal";
import type { Appointment } from "@babun/shared/local/appointments";
import { getPaidAmount } from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import type { DayExtra } from "@babun/shared/local/day-extras";
import {
  computeDayFinance,
  getDayMode,
  type DayMode,
} from "@babun/shared/local/finance/day-summary";
import { generateId } from "@babun/shared/local/masters";
import { formatEUR } from "@babun/shared/common/utils/money";

interface DayFinanceDetailModalProps {
  open: boolean;
  onClose: () => void;
  dateKey: string; // YYYY-MM-DD of the tapped day
  todayKey: string; // YYYY-MM-DD "today" in the calendar's timezone
  dateLabel: string; // e.g. "Вт, 7 апреля"
  /** ВСЕ записи дня (любой статус). */
  appointments: Appointment[];
  services: Service[];
  clientNameFor: (apt: Appointment) => string;
  extras: DayExtra[];
  /** Autosave — called on every add/remove of a manual entry. */
  onSave: (extras: DayExtra[]) => void;
}

const METHOD_LABELS: Array<{ key: "card" | "cash" | "transfer" | "other"; label: string }> = [
  { key: "card", label: "Картой" },
  { key: "cash", label: "Наличкой" },
  { key: "transfer", label: "Переводом" },
  { key: "other", label: "Прочее" },
];

function relativeLabel(mode: DayMode, dateKey: string, todayKey: string): string {
  if (mode === "today") return "сегодня";
  const a = new Date(`${dateKey}T00:00:00`);
  const b = new Date(`${todayKey}T00:00:00`);
  const days = Math.round((a.getTime() - b.getTime()) / 86400000);
  if (mode === "future") {
    if (days === 1) return "завтра";
    return `через ${days} ${plural(days, "день", "дня", "дней")}`;
  }
  const n = Math.abs(days);
  if (n === 1) return "вчера";
  return `${n} ${plural(n, "день", "дня", "дней")} назад`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export default function DayFinanceDetailModal({
  open,
  onClose,
  dateKey,
  todayKey,
  dateLabel,
  appointments,
  services,
  clientNameFor,
  extras,
  onSave,
}: DayFinanceDetailModalProps) {
  const [localExtras, setLocalExtras] = useState<DayExtra[]>(extras);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState<number | "">("");
  const [newKind, setNewKind] = useState<"income" | "expense">("expense");
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (open) {
      setLocalExtras(extras);
      setNewName("");
      setNewAmount("");
      setNewKind("expense");
      setShowAdd(false);
    }
  }, [open, extras]);

  const mode = getDayMode(dateKey, todayKey);

  const totals = useMemo(
    () => computeDayFinance(appointments, services, localExtras),
    [appointments, services, localExtras],
  );

  const serviceById = useMemo(
    () => new Map(services.map((s) => [s.id, s] as const)),
    [services],
  );

  const completed = useMemo(
    () =>
      appointments
        .filter((a) => a.status === "completed" || a.status === "in_progress")
        .sort((a, b) => a.time_start.localeCompare(b.time_start)),
    [appointments],
  );

  // Plan-mode counts (exclude cancelled).
  const active = useMemo(
    () => appointments.filter((a) => a.status !== "cancelled"),
    [appointments],
  );
  const clientCount = useMemo(
    () => new Set(active.map((a) => a.client_id).filter(Boolean)).size,
    [active],
  );

  const hasPayments = METHOD_LABELS.some((m) => totals.byMethod[m.key] > 0);

  const commit = (next: DayExtra[]) => {
    setLocalExtras(next);
    onSave(next);
  };

  const handleAddExtra = () => {
    const name = newName.trim();
    const amount = typeof newAmount === "number" ? newAmount : 0;
    if (!name || amount <= 0) return;
    commit([...localExtras, { id: generateId("dx"), name, amount, kind: newKind }]);
    setNewName("");
    setNewAmount("");
    setShowAdd(false);
  };

  const handleRemoveExtra = (id: string) => {
    commit(localExtras.filter((e) => e.id !== id));
  };

  const serviceNames = (apt: Appointment): string => {
    const names = apt.services
      .map((s) => serviceById.get(s.serviceId)?.name)
      .filter(Boolean) as string[];
    if (names.length > 0) return names.join(", ");
    return apt.comment?.trim() || "Услуга";
  };

  const titleSuffix =
    mode === "past" ? "" : ` (${relativeLabel(mode, dateKey, todayKey)})`;

  const progressPct =
    totals.planned > 0
      ? Math.min(100, Math.round((totals.earned / totals.planned) * 100))
      : 0;

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title={`Финансы · ${dateLabel}${titleSuffix}`}
    >
      <div className="pb-3">
        {/* ─── Headline block (per mode) ─── */}
        {mode === "future" && (
          <Headline
            label="Запланировано"
            value={totals.planned}
            tone="muted"
            sub={`${active.length} ${plural(active.length, "запись", "записи", "записей")}${
              clientCount > 0
                ? ` · ${clientCount} ${plural(clientCount, "клиент", "клиента", "клиентов")}`
                : ""
            }`}
          />
        )}

        {mode === "today" && (
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-[var(--label-secondary)]">
                Прогресс дня
              </span>
              <span className="text-[15px] font-bold tabular-nums text-[var(--label)]">
                {formatEUR(totals.earned)}
                <span className="text-[13px] font-medium text-[var(--label-tertiary)]">
                  {" "}
                  / {formatEUR(totals.planned)}
                </span>
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[var(--fill-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--system-green)] transition-[width] duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-1.5 text-[12px] text-[var(--label-tertiary)]">
              {completed.length} из {active.length} выполнено
            </div>
          </div>
        )}

        {mode === "past" && (
          <Headline
            label="Прибыль"
            value={totals.profit}
            tone={totals.profit < 0 ? "red" : "accent"}
            big
            sub={`Доход ${formatEUR(totals.earned)} − Расход ${formatEUR(totals.spent)}`}
          />
        )}

        {/* ─── Completed services (today + past) ─── */}
        {mode !== "future" && completed.length > 0 && (
          <>
            <SectionTitle>
              {mode === "past" ? `Выполнено · ${formatEUR(totals.earned)}` : "Выполнено"}
            </SectionTitle>
            {completed.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center gap-2 px-4 py-1.5 border-t border-[var(--separator)]"
              >
                <span className="text-[12px] text-[var(--label-tertiary)] tabular-nums w-[38px] flex-shrink-0">
                  {apt.time_start}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[var(--label)] truncate">
                    {clientNameFor(apt)}
                  </div>
                  <div className="text-[11px] text-[var(--label-tertiary)] truncate">
                    {serviceNames(apt)}
                  </div>
                </div>
                <span className="text-[13px] font-semibold text-[var(--system-green)] tabular-nums flex-shrink-0">
                  {formatEUR(getPaidAmount(apt))}
                </span>
              </div>
            ))}
          </>
        )}

        {/* ─── Payment methods (today + past, only if any) ─── */}
        {mode !== "future" && hasPayments && (
          <>
            <SectionTitle>Оплаты</SectionTitle>
            {METHOD_LABELS.filter((m) => totals.byMethod[m.key] > 0).map((m) => (
              <div
                key={m.key}
                className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--separator)]"
              >
                <span className="text-[13px] text-[var(--label)]">{m.label}</span>
                <span className="text-[13px] font-semibold text-[var(--label)] tabular-nums">
                  {formatEUR(totals.byMethod[m.key])}
                </span>
              </div>
            ))}
          </>
        )}

        {/* ─── Expenses / manual entries (all modes) ─── */}
        <SectionTitle>{mode === "future" ? "Плановые расходы" : "Расходы"}</SectionTitle>
        {localExtras.map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-2 px-4 py-1.5 border-t border-[var(--separator)]"
          >
            <div
              className={`w-1 h-5 rounded-full flex-shrink-0 ${
                e.kind === "income"
                  ? "bg-[var(--system-green)]"
                  : "bg-[var(--system-red)]"
              }`}
            />
            <span className="flex-1 text-[13px] text-[var(--label)] truncate">
              {e.name}
            </span>
            <span
              className={`text-[13px] font-semibold tabular-nums ${
                e.kind === "income"
                  ? "text-[var(--system-green)]"
                  : "text-[var(--system-red)]"
              }`}
            >
              {e.kind === "income" ? "+" : "−"}
              {formatEUR(e.amount)}
            </span>
            <button
              type="button"
              onClick={() => handleRemoveExtra(e.id)}
              aria-label="Удалить"
              className="w-6 h-6 flex items-center justify-center text-[var(--label-tertiary)] active:text-[var(--system-red)]"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ))}

        <div className="px-3 pt-2 pb-1">
          {!showAdd ? (
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="w-full h-9 flex items-center justify-center gap-1.5 bg-[var(--accent-tint)] text-[var(--accent)] rounded-[var(--radius-pill)] text-[13px] font-semibold active:scale-[0.98]"
            >
              <span className="text-[15px] leading-none">+</span>
              {mode === "future" ? "Добавить плановый расход" : "Добавить расход"}
            </button>
          ) : (
            <div className="bg-[var(--fill-tertiary)] rounded-[10px] p-2 space-y-2">
              <div className="flex gap-1 bg-[var(--surface-card)] rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setNewKind("expense")}
                  className={`flex-1 h-8 rounded text-[12px] font-semibold transition ${
                    newKind === "expense"
                      ? "bg-[var(--system-red)] text-[var(--label-on-accent)]"
                      : "text-[var(--label-secondary)]"
                  }`}
                >
                  Расход
                </button>
                <button
                  type="button"
                  onClick={() => setNewKind("income")}
                  className={`flex-1 h-8 rounded text-[12px] font-semibold transition ${
                    newKind === "income"
                      ? "bg-[var(--system-green)] text-[var(--label-on-accent)]"
                      : "text-[var(--label-secondary)]"
                  }`}
                >
                  Доход
                </button>
              </div>
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название (например, Бензин)"
                className="w-full h-10 px-3 bg-[var(--surface-card)] rounded-[10px] text-[13px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={newAmount}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNewAmount(v === "" ? "" : Number(v) || 0);
                  }}
                  placeholder="Сумма"
                  className="flex-1 h-10 px-3 bg-[var(--surface-card)] rounded-[10px] text-[13px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
                <span className="text-[13px] text-[var(--label-secondary)]">€</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdd(false);
                    setNewName("");
                    setNewAmount("");
                  }}
                  className="flex-1 h-9 text-[13px] text-[var(--label-secondary)] font-medium"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleAddExtra}
                  disabled={
                    !newName.trim() ||
                    typeof newAmount !== "number" ||
                    newAmount <= 0
                  }
                  className="flex-1 h-9 bg-[var(--accent)] text-[var(--label-on-accent)] rounded-[var(--radius-pill)] text-[13px] font-semibold disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Today: soft profit-so-far line ─── */}
        {mode === "today" && (
          <div className="flex items-baseline justify-between px-4 pt-2 mt-1 border-t border-[var(--separator)]">
            <span className="text-[12px] text-[var(--label-tertiary)]">
              Прибыль пока
            </span>
            <span
              className={`text-[13px] font-semibold tabular-nums ${
                totals.profit < 0
                  ? "text-[var(--system-red)]"
                  : "text-[var(--label-secondary)]"
              }`}
            >
              {formatEUR(totals.profit)}
            </span>
          </div>
        )}
      </div>
    </DialogModal>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pt-3 pb-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
      {children}
    </div>
  );
}

function Headline({
  label,
  value,
  sub,
  tone,
  big,
}: {
  label: string;
  value: number;
  sub?: string;
  tone: "muted" | "accent" | "red";
  big?: boolean;
}) {
  const color =
    tone === "red"
      ? "text-[var(--system-red)]"
      : tone === "accent"
        ? "text-[var(--accent)]"
        : "text-[var(--label)]";
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="text-[13px] text-[var(--label-secondary)]">{label}</div>
      <div
        className={`${big ? "text-[28px]" : "text-[24px]"} font-bold tabular-nums leading-tight ${color}`}
      >
        {formatEUR(value)}
      </div>
      {sub && (
        <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5">{sub}</div>
      )}
    </div>
  );
}
