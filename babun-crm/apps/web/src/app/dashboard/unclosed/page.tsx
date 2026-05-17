"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, XCircle } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import {
  useAppointments,
  useClients,
} from "@/components/layout/DashboardClientLayout";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";
import { logAudit } from "@/lib/audit/audit-log";

// v593 — typical cancel reasons surfaced as chips on the sheet.
// "Другое" lets the dispatcher type a free-text reason for the
// rare case (returned for credit-card, courier broke item, etc).
const CANCEL_REASON_PRESETS = [
  "Клиент не пришёл",
  "Клиент отменил",
  "Перенесли на другой день",
  "Не смогли дозвониться",
  "Адрес недоступен",
] as const;

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
  const { appointments, upsertAppointment } = useAppointments();
  const { clients } = useClients();
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);

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
    logAudit({
      entity: "appointment",
      action: "status_change",
      summary: `${clientNameOf(apt)} · ${formatDateRu(apt.date)} — закрыто как «Выполнено»`,
      entityId: apt.id,
    });
  };

  const handleConfirmCancel = async (apt: Appointment, reason: string) => {
    const final = reason.trim() || "Не указана";
    await upsertAppointment({
      ...apt,
      status: "cancelled",
      cancel_reason: final,
    });
    logAudit({
      entity: "appointment",
      action: "status_change",
      summary: `${clientNameOf(apt)} · ${formatDateRu(apt.date)} — отменено (${final})`,
      entityId: apt.id,
    });
    setCancelTarget(null);
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
                onCancel={() => setCancelTarget(apt)}
                onOpenClient={() => {
                  if (!apt.client_id) return;
                  router.push(`/dashboard/clients?id=${apt.client_id}`);
                }}
              />
            ))
          )}
        </div>
      </div>

      {cancelTarget && (
        <CancelReasonSheet
          apt={cancelTarget}
          clientName={clientNameOf(cancelTarget)}
          onClose={() => setCancelTarget(null)}
          onConfirm={(reason) =>
            void handleConfirmCancel(cancelTarget, reason)
          }
        />
      )}
    </>
  );
}

// v593 — centered sheet with chip picker + free-text fallback.
// Replaces the v573 hard-coded «Клиент не пришёл» default so the
// dispatcher records the real reason — useful both for the audit
// trail and for the per-master cancellation stats screen later.
function CancelReasonSheet({
  apt,
  clientName,
  onClose,
  onConfirm,
}: {
  apt: Appointment;
  clientName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const isCustom = picked === "__custom__";
  const reasonToSubmit = isCustom ? customText.trim() : picked ?? "";
  const canSubmit = reasonToSubmit.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] bg-black/30 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-1">
          <div className="text-[17px] font-semibold text-[var(--label)]">
            Отменить визит
          </div>
          <div className="text-[13px] text-[var(--label-secondary)] mt-1">
            {clientName} · {formatDateRu(apt.date)} · {apt.time_start}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-2">
            Причина
          </div>
          <div className="flex flex-wrap gap-2">
            {CANCEL_REASON_PRESETS.map((r) => {
              const active = picked === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setPicked(r)}
                  className={`h-9 px-3.5 rounded-full text-[13px] font-medium transition ${
                    active
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "bg-[var(--fill-quaternary)] text-[var(--label)] active:bg-[var(--fill-tertiary)]"
                  }`}
                >
                  {r}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setPicked("__custom__")}
              className={`h-9 px-3.5 rounded-full text-[13px] font-medium transition ${
                isCustom
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--fill-quaternary)] text-[var(--label)] active:bg-[var(--fill-tertiary)]"
              }`}
            >
              Другое…
            </button>
          </div>
          {isCustom && (
            <input
              type="text"
              autoFocus
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Опишите причину"
              className="mt-3 w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
            />
          )}
        </div>

        <div className="border-t border-[var(--separator)] flex">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 text-[15px] font-medium text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            Назад
          </button>
          <div className="w-px bg-[var(--separator)]" />
          <button
            type="button"
            onClick={() => onConfirm(reasonToSubmit)}
            disabled={!canSubmit}
            className="flex-1 h-12 text-[15px] font-semibold text-[var(--tile-red)] active:bg-[var(--fill-quaternary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed"
          >
            Отменить визит
          </button>
        </div>
      </div>
    </div>
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
