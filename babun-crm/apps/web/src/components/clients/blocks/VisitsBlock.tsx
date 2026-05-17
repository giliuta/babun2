"use client";

// STORY-034 — Visits timeline.  Replaces the «Активность» tab.
// Open by default per spec — it's the most-asked piece of context.
// Tap on a row navigates to the calendar focused on that date so the
// dispatcher can see the whole day around the visit.

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Appointment } from "@babun/shared/local/appointments";
import type { Service } from "@babun/shared/local/services";
import { formatEUR } from "@babun/shared/common/utils/money";
import ClientCard from "../ClientCard";
import { haptic } from "@/lib/haptics";

interface VisitsBlockProps {
  clientId: string;
  appointments: Appointment[];
  services: Service[];
}

export default function VisitsBlock({
  clientId,
  appointments,
  services,
}: VisitsBlockProps) {
  const router = useRouter();
  const own = useMemo(
    () =>
      appointments
        .filter((a) => a.client_id === clientId)
        .sort((a, b) =>
          `${b.date}${b.time_start}`.localeCompare(`${a.date}${a.time_start}`),
        ),
    [appointments, clientId],
  );

  const servicesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services) m.set(s.id, s.name);
    return m;
  }, [services]);

  return (
    <ClientCard
      kind="visits"
      title="История визитов"
      badge={own.length || undefined}
      defaultOpen
    >
      {own.length === 0 ? (
        <div className="px-4 py-4 text-[13px] text-[var(--label-tertiary)]">
          Записей пока нет.
        </div>
      ) : (
        <div className="divide-y divide-[var(--separator)]">
          {own.slice(0, 50).map((apt) => (
            <VisitRow
              key={apt.id}
              apt={apt}
              clientId={clientId}
              servicesById={servicesById}
              onOpen={() => {
                haptic("tap");
                router.push(`/dashboard?date=${encodeURIComponent(apt.date)}`);
              }}
              onRepeat={() => {
                // Beta #46 (CRM Core brief) — «повторить заказ в один
                // клик». Builds the same /dashboard?new=1 link with
                // the original service ids serialised so the new draft
                // lands pre-filled. Date defaults to today on the
                // dashboard side.
                haptic("success");
                const serviceIds = Array.from(
                  new Set((apt.services ?? []).map((s) => s.serviceId).filter(Boolean)),
                );
                const sParam =
                  serviceIds.length > 0 ? `&services=${serviceIds.join(",")}` : "";
                router.push(
                  `/dashboard?new=1&client_id=${clientId}${sParam}`,
                );
              }}
            />
          ))}
          {own.length > 50 && (
            <div className="px-4 py-2 text-[12px] text-[var(--label-tertiary)] text-center">
              + ещё {own.length - 50} визитов
            </div>
          )}
        </div>
      )}
    </ClientCard>
  );
}

function VisitRow({
  apt,
  clientId,
  servicesById,
  onOpen,
  onRepeat,
}: {
  apt: Appointment;
  clientId: string;
  servicesById: Map<string, string>;
  onOpen: () => void;
  onRepeat: () => void;
}) {
  const status = (() => {
    if (apt.status === "completed")
      return { label: "Выполнено", cls: "bg-[rgba(52,199,89,0.15)] text-[var(--system-green)]" };
    if (apt.status === "cancelled")
      return { label: "Отменено", cls: "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]" };
    if (apt.status === "in_progress")
      return { label: "В работе", cls: "bg-[rgba(255,149,0,0.14)] text-[var(--system-orange)]" };
    return { label: "Запланировано", cls: "bg-[rgba(0,122,255,0.12)] text-[var(--system-blue)]" };
  })();

  const summary = (() => {
    // P0 #4 (CRM Core brief) — de-dupe by serviceId before counting.
    // User report: «Сплит-система 7-9 BTU» appears twice on the same
    // visit. Cause: legacy appointments occasionally carry two
    // AppointmentService rows with the same serviceId (UI quirk +
    // some import paths). Quantity lives ON each row, so the canonical
    // single-row representation is one entry per service id with the
    // quantities summed — for the activity summary string we only need
    // distinct names, so a Set is enough.
    const seenIds = new Set<string>();
    const named: string[] = [];
    for (const s of apt.services ?? []) {
      if (seenIds.has(s.serviceId)) continue;
      seenIds.add(s.serviceId);
      const name = servicesById.get(s.serviceId);
      if (name) named.push(name);
    }
    if (named.length > 0)
      return named.length === 1 ? named[0] : `${named[0]} +${named.length - 1}`;
    return apt.comment || "—";
  })();

  // P0 #14 (CRM Core brief) — payment badge derived from the
  // explicit columns when present, falling back to the legacy
  // (status === 'completed' AND payment !== null) heuristic for rows
  // older than the v577 wiring. Hidden on non-completed rows where
  // the status pill already conveys what the operator needs.
  const paymentBadge = (() => {
    if (apt.status !== "completed") return null;
    const ps = apt.payment_status;
    if (ps === "paid") {
      return { label: "Оплачено", cls: "bg-[rgba(52,199,89,0.16)] text-[var(--system-green)]" };
    }
    if (ps === "partial") {
      return { label: "Частично", cls: "bg-[rgba(255,149,0,0.14)] text-[var(--system-orange)]" };
    }
    if (ps === "refunded") {
      return { label: "Возврат", cls: "bg-[rgba(255,59,48,0.12)] text-[var(--system-red)]" };
    }
    if (ps === "unpaid") {
      return { label: "К оплате", cls: "bg-[rgba(255,149,0,0.18)] text-[var(--system-orange)]" };
    }
    // Legacy fallback — older records don't have payment_status.
    if (apt.payment) {
      return { label: "Оплачено", cls: "bg-[rgba(52,199,89,0.16)] text-[var(--system-green)]" };
    }
    return null;
  })();

  // Beta #46 — «Повторить» only makes sense for completed visits with
  // at least one service the operator can re-seed. Cancelled and
  // empty rows hide the button.
  const canRepeat =
    apt.status === "completed" &&
    Array.isArray(apt.services) &&
    apt.services.length > 0;

  return (
    <div className="flex items-stretch active:bg-[var(--fill-quaternary)]">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 flex items-center gap-2 px-4 py-2.5 text-left min-w-0"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[14px] text-[var(--label)] truncate">
            {summary}
          </div>
          <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
            {formatVisitDate(apt.date)} · {apt.time_start}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}
          >
            {status.label}
          </span>
          {paymentBadge && (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${paymentBadge.cls}`}
            >
              {paymentBadge.label}
            </span>
          )}
        </div>
        <span className="shrink-0 w-14 text-right text-[13px] font-bold text-[var(--system-green)] tabular-nums">
          {formatEUR(apt.total_amount)}
        </span>
      </button>
      {canRepeat && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRepeat();
          }}
          aria-label="Повторить заказ"
          title="Повторить заказ"
          className="shrink-0 px-3 flex items-center justify-center text-[11px] font-semibold text-[var(--accent)] border-l border-[var(--separator)] active:bg-[var(--accent-tint)]"
        >
          ↻
        </button>
      )}
    </div>
  );
}

function formatVisitDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
