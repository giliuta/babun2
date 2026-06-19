"use client";

// v813 — «Обслуживание» spine for the unified client card.
//
// Surfaces equipment that needs service, computed by buildServiceDue()
// (which wires the previously-dead serviceDueState). Overdue units first
// (red), then due-soon (amber), each with a pre-aimed «Записать ТО».
// On-schedule units collapse to one quiet line per object. The whole
// section hides when the client has no equipment with a schedule.

import { useRouter } from "next/navigation";
import type { Client } from "@babun/shared/local/clients";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import type { ServiceDueSummary, UnitDue } from "@babun/shared/local/selectors/service-due";
import { buildBookingHref } from "@/lib/clients/booking-link";
import { haptic } from "@/lib/haptics";

interface ClientServiceSpineProps {
  client: Client;
  stats: ClientStats | undefined;
  serviceDue: ServiceDueSummary;
}

export default function ClientServiceSpine({
  client,
  stats,
  serviceDue,
}: ClientServiceSpineProps) {
  const router = useRouter();

  if (serviceDue.totalScheduled === 0) return null;

  const dueCount = serviceDue.overdue.length + serviceDue.soon.length;

  const book = (locationId: string) => {
    haptic("tap");
    router.push(
      buildBookingHref({
        clientId: client.id,
        locationId,
        teamId: stats?.lastTeamId ?? null,
      }),
    );
  };

  const Row = ({ u, kind }: { u: UnitDue; kind: "over" | "soon" }) => (
    <div className="flex items-center gap-2.5 py-1.5">
      <span
        className="shrink-0 w-[7px] h-[7px] rounded-full"
        style={{ backgroundColor: kind === "over" ? "var(--system-red)" : "#C77A00" }}
      />
      <span className="flex-1 min-w-0 truncate text-[14px] text-[var(--label)]">
        {u.unitLabel}
      </span>
      <span
        className="shrink-0 text-[12.5px] tabular-nums"
        style={{ color: kind === "over" ? "var(--system-red)" : "#C77A00" }}
      >
        {kind === "over" ? `−${Math.abs(u.due.daysUntil)} дн` : `через ${u.due.daysUntil} дн`}
      </span>
      <button
        type="button"
        onClick={() => book(u.locationId)}
        className="shrink-0 text-[12.5px] font-medium text-[var(--accent)] active:opacity-70"
      >
        Записать ТО
      </button>
    </div>
  );

  return (
    <div className="mx-3 mb-2 bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      <div className="flex items-center gap-2 px-3 h-11">
        <span className="flex-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          Обслуживание
        </span>
        {dueCount > 0 && (
          <span
            className="text-[12px] font-semibold tabular-nums"
            style={{ color: serviceDue.overdue.length > 0 ? "var(--system-red)" : "#C77A00" }}
          >
            {dueCount}
          </span>
        )}
      </div>

      {dueCount > 0 && (
        <div className="border-t border-[var(--separator)] px-3 py-1.5">
          {serviceDue.overdue.map((u) => (
            <Row key={u.unitId} u={u} kind="over" />
          ))}
          {serviceDue.soon.map((u) => (
            <Row key={u.unitId} u={u} kind="soon" />
          ))}
        </div>
      )}

      {serviceDue.onSchedule.length > 0 && (
        <div className="border-t border-[var(--separator)] px-3 py-2.5 space-y-1">
          {serviceDue.onSchedule.map((o) => (
            <div key={o.locationId} className="text-[13px] text-[var(--label-tertiary)] truncate">
              {o.locationLabel} · {o.count} юнит{plural(o.count)} — всё по графику
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function plural(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "а";
  return "ов";
}
