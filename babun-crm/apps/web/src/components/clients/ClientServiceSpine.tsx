"use client";

// v813 — «Обслуживание» spine for the unified client card.
//
// Surfaces equipment that needs service (buildServiceDue → serviceDueState).
// The unit the NEXT-JOB hero already names is excluded (excludeUnitId) so
// the same fact never appears twice. Overdue rows first, then due-soon
// (amber), each with a pre-aimed «Записать ТО»; on-schedule units collapse
// to one quiet line per object. Hidden when nothing is left to show.

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
  /** Unit already shown in the hero — dropped here (de-dup). */
  excludeUnitId?: string | null;
}

export default function ClientServiceSpine({
  client,
  stats,
  serviceDue,
  excludeUnitId,
}: ClientServiceSpineProps) {
  const router = useRouter();

  const overdue = serviceDue.overdue.filter((u) => u.unitId !== excludeUnitId);
  const soon = serviceDue.soon.filter((u) => u.unitId !== excludeUnitId);
  const dueCount = overdue.length + soon.length;

  if (dueCount === 0 && serviceDue.onSchedule.length === 0) return null;

  const book = (locationId: string) => {
    haptic("tap");
    router.push(
      buildBookingHref({ clientId: client.id, locationId, teamId: stats?.lastTeamId ?? null }),
    );
  };

  const Row = ({ u, kind }: { u: UnitDue; kind: "over" | "soon" }) => (
    <div className="flex items-center gap-2.5 py-1.5">
      <span
        className="shrink-0 w-[7px] h-[7px] rounded-full"
        style={{ backgroundColor: kind === "over" ? "var(--system-red)" : "#C77A00" }}
      />
      <span className="flex-1 min-w-0 truncate text-[15px] text-[var(--label)]">{u.unitLabel}</span>
      <span
        className="shrink-0 text-[13px] tabular-nums"
        style={{ color: kind === "over" ? "var(--system-red)" : "#C77A00" }}
      >
        {kind === "over" ? `−${Math.abs(u.due.daysUntil)} дн` : `через ${u.due.daysUntil} дн`}
      </span>
      <button
        type="button"
        onClick={() => book(u.locationId)}
        className="shrink-0 text-[13px] font-medium text-[var(--accent)] active:opacity-70"
      >
        Записать ТО
      </button>
    </div>
  );

  return (
    <div className="mx-3 mb-2 bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-4 pt-2.5 pb-1 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
        Обслуживание
      </div>

      {dueCount > 0 && (
        <div className="px-4 py-1">
          {overdue.map((u) => <Row key={u.unitId} u={u} kind="over" />)}
          {soon.map((u) => <Row key={u.unitId} u={u} kind="soon" />)}
        </div>
      )}

      {serviceDue.onSchedule.length > 0 && (
        <div className="border-t border-[var(--separator)] px-4 py-2.5 space-y-1">
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
