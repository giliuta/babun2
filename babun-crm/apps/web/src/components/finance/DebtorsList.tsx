"use client";

// «Долги» panel: completed-but-unpaid appointments for the active team
// in the period — each shows the client and the outstanding amount.

import { formatEUR } from "@babun/shared/common/utils/money";
import type { Appointment } from "@babun/shared/local/appointments";
import type { Client } from "@babun/shared/local/clients";

interface DebtorsListProps {
  appointments: Appointment[];
  clients: Client[];
  teamId: string | null;
  fromDate: string;
  toDate: string;
}

export default function DebtorsList({
  appointments,
  clients,
  teamId,
  fromDate,
  toDate,
}: DebtorsListProps) {
  const rows = appointments
    .filter(
      (a) =>
        a.status === "completed" &&
        a.payment_status !== "paid" &&
        a.date >= fromDate &&
        a.date <= toDate &&
        (!teamId || a.team_id === teamId),
    )
    .map((a) => ({
      id: a.id,
      name: clientName(a, clients),
      owed: Math.max(0, (a.total_amount ?? 0) - (a.paid_amount ?? 0)),
      date: a.date,
    }))
    .filter((r) => r.owed > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="px-3 pt-3">
      <div className="bg-[var(--surface-card)] rounded-[14px] overflow-hidden shadow-[var(--shadow-card)]">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12px] text-[var(--label-tertiary)]">
            Нет должников за период
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={r.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${
                i > 0 ? "border-t border-[var(--separator)]" : ""
              }`}
            >
              <span className="flex-1 min-w-0 text-[15px] font-medium truncate">
                {r.name}
              </span>
              <span className="text-[15px] font-bold tabular-nums text-[var(--system-orange)]">
                {formatEUR(r.owed)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function clientName(a: Appointment, clients: Client[]): string {
  if (a.client_id) {
    const c = clients.find((x) => x.id === a.client_id);
    if (c?.full_name) return c.full_name;
  }
  return a.comment?.trim() || "Без имени";
}
