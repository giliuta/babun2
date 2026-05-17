"use client";

import type { Appointment } from "@babun/shared/local/appointments";
import type { Client } from "@babun/shared/local/clients";
import type { Service } from "@babun/shared/local/services";

// v612 — Inline double-booking warning, collapsible. Surfaces a
// conflict on the active team for the picked time range but never
// blocks save (overlaps in HVAC happen by accident and the dispatcher
// needs to see them, not be stopped). Extracted from AppointmentSheet
// as part of the Sprint #4 §9 decomposition.

interface OverlapWarningProps {
  conflict: Appointment;
  summary: string;
  catalog: Service[];
  clients: Client[];
}

export default function OverlapWarning({
  conflict,
  summary,
  catalog,
  clients,
}: OverlapWarningProps) {
  const serviceNames = conflict.service_ids
    .map((sid) => catalog.find((s) => s.id === sid)?.name)
    .filter(Boolean)
    .join(", ");
  const phone = conflict.client_id
    ? clients.find((c) => c.id === conflict.client_id)?.phone ?? ""
    : "";
  const statusLabel =
    conflict.status === "completed"
      ? "выполнена"
      : conflict.status === "in_progress"
        ? "в работе"
        : "запланирована";

  return (
    <div className="px-4 pt-2">
      <details className="group rounded-[14px] bg-[rgba(255,149,0,0.08)] border border-[rgba(255,149,0,0.2)] text-[12px] text-[var(--label)]">
        <summary className="flex items-start gap-2 px-3 py-2 cursor-pointer list-none">
          <span aria-hidden className="text-[var(--system-orange)]">⚠</span>
          <div className="flex-1">
            <div className="font-semibold">Пересечение с записью</div>
            <div className="text-[var(--label-secondary)]">{summary}</div>
          </div>
          <span className="text-[var(--system-orange)] text-[12px] group-open:rotate-180 transition">
            ▾
          </span>
        </summary>
        <div className="px-3 pb-2 pt-0.5 text-[var(--label)] border-t border-[rgba(255,149,0,0.2)] space-y-0.5">
          {serviceNames && (
            <div className="truncate">Услуги: {serviceNames}</div>
          )}
          <div>Статус: {statusLabel}</div>
          {phone && (
            <a
              href={`tel:${phone.replace(/\D/g, "")}`}
              className="inline-flex items-center gap-1 font-semibold underline decoration-[var(--system-orange)] decoration-1 underline-offset-2 text-[var(--system-orange)]"
              onClick={(e) => e.stopPropagation()}
            >
              Позвонить {phone}
            </a>
          )}
        </div>
      </details>
    </div>
  );
}
