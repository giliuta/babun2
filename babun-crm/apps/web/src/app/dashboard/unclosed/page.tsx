"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, XCircle } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import {
  useAppointments,
  useClients,
} from "@/components/layout/DashboardClientLayout";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";

// §4.2 — Inbox of «не закрытых» visits. Filters appointments where
// the date has passed but status is still «Запланирован» (kind="work"
// only — personal events drop out). The dispatcher works through
// the list with two quick-action buttons per row: «Выполнено» moves
// the record to its successful end state; «Отменено» records the
// no-show with `cancel_reason = "Клиент не пришёл"` so the audit
// trail stays honest.
//
// Reachable via direct URL (`/dashboard/unclosed`). The Morning-
// briefing «Не закрыто» tile can link here in a follow-up commit.

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateRu(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt
    .toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    .replace(/\.$/, "");
}

function daysSince(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const past = new Date(y, m - 1, d).getTime();
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((now.getTime() - past) / 86_400_000));
}

function countWord(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export default function UnclosedVisitsPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const { appointments, upsertAppointment } = useAppointments();
  const { clients } = useClients();

  const clientNameOf = useMemo(() => {
    const map = new Map(clients.map((c) => [c.id, c.full_name]));
    return (apt: Appointment): string => {
      if (apt.client_id && map.has(apt.client_id)) {
        return map.get(apt.client_id) ?? "—";
      }
      // Fallback to comment field — seed records carry the client name
      // there because client_id is null. AppointmentBlock applies the
      // same rule.
      return apt.comment?.trim() || "—";
    };
  }, [clients]);

  const unclosed = useMemo(() => {
    const tKey = todayKey();
    return appointments
      .filter(
        (a) =>
          (a.kind === undefined || a.kind === "work") &&
          a.status === "scheduled" &&
          a.date < tKey
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [appointments]);

  const totalAtRisk = useMemo(
    () => unclosed.reduce((sum, a) => sum + (a.total_amount ?? 0), 0),
    [unclosed]
  );

  const handleComplete = async (apt: Appointment) => {
    await upsertAppointment({ ...apt, status: "completed" });
  };

  const handleCancel = async (apt: Appointment) => {
    const ok = await confirm({
      title: "Отменить визит?",
      message: `Запись от ${formatDateRu(apt.date)} будет помечена как отменённая.`,
      confirmLabel: "Отменить визит",
      danger: true,
    });
    if (!ok) return;
    await upsertAppointment({
      ...apt,
      status: "cancelled",
      cancel_reason: apt.cancel_reason ?? "Клиент не пришёл",
    });
  };

  return (
    <>
      <PageHeader
        title={`Не закрыто${unclosed.length > 0 ? ` (${unclosed.length})` : ""}`}
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
          {unclosed.length > 0 && totalAtRisk > 0 && (
            <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--separator)] shadow-[var(--shadow-card)] px-4 py-3 flex items-center justify-between">
              <div className="text-[13px] text-[var(--label-secondary)]">
                Под вопросом на сумму
              </div>
              <div className="text-[15px] font-semibold text-[var(--label)] tabular-nums">
                {formatEUR(totalAtRisk)}
              </div>
            </div>
          )}
          {unclosed.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={24} strokeWidth={2} />}
              title="Все визиты закрыты"
              description="Здесь появляются записи прошедшим днём, у которых статус остался «Запланирован». Поставьте «Выполнено» или «Отменено», когда такая всплывёт."
            />
          ) : (
            unclosed.map((apt) => (
              <UnclosedCard
                key={apt.id}
                apt={apt}
                clientName={clientNameOf(apt)}
                onComplete={() => void handleComplete(apt)}
                onCancel={() => void handleCancel(apt)}
                onOpenClient={() => {
                  if (!apt.client_id) return;
                  router.push(`/dashboard/clients?id=${apt.client_id}`);
                }}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

function UnclosedCard({
  apt,
  clientName,
  onComplete,
  onCancel,
  onOpenClient,
}: {
  apt: Appointment;
  clientName: string;
  onComplete: () => void;
  onCancel: () => void;
  onOpenClient: () => void;
}) {
  const days = daysSince(apt.date);
  const amount = apt.total_amount ?? 0;
  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--separator)] shadow-[var(--shadow-card)] overflow-hidden">
      <button
        type="button"
        onClick={onOpenClient}
        disabled={!apt.client_id}
        className="w-full text-left px-4 pt-3 pb-2 active:bg-[var(--fill-quaternary)] disabled:active:bg-transparent"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-[var(--label)] truncate">
              {clientName}
            </div>
            <div className="text-[12px] text-[var(--label-secondary)] mt-0.5">
              {formatDateRu(apt.date)} · {apt.time_start}
              {days > 0 && (
                <span className="text-[var(--tile-orange)] font-medium">
                  {" "}
                  · {days} {countWord(days, "день", "дня", "дней")} назад
                </span>
              )}
            </div>
          </div>
          {amount > 0 && (
            <div className="text-[13px] font-semibold text-[var(--label)] tabular-nums shrink-0">
              {formatEUR(amount)}
            </div>
          )}
        </div>
      </button>

      <div className="flex border-t border-[var(--separator)]">
        <button
          type="button"
          onClick={onComplete}
          className="flex-1 h-11 flex items-center justify-center gap-1.5 text-[13px] font-medium text-[var(--accent)] active:bg-[var(--fill-quaternary)]"
        >
          <Check size={16} strokeWidth={2.2} />
          Выполнено
        </button>
        <div className="w-px bg-[var(--separator)]" />
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-11 flex items-center justify-center gap-1.5 text-[13px] font-medium text-[var(--tile-red)] active:bg-[var(--fill-quaternary)]"
        >
          <XCircle size={16} strokeWidth={2.2} />
          Отменить
        </button>
      </div>
    </div>
  );
}
