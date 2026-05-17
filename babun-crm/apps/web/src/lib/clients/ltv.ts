// Client lifetime-value metrics — Sprint clients-99 (F3.7).
//
// Computes LTV, average check, and visit frequency entirely on the
// client from the existing `appointments` array — no extra DB view,
// no extra fetch. Numbers are intentionally rounded for header display.

import type { Appointment } from "@babun/shared/local/appointments";

export interface ClientLtvStats {
  /** Sum of `total_amount` across completed appointments. */
  ltv: number;
  /** Average per-completed-appointment revenue. */
  avgCheck: number;
  /** Total count of completed appointments. */
  visits: number;
  /** Average days between consecutive completed visits, or null if <2 visits. */
  avgGapDays: number | null;
  /** ISO date of the most recent completed visit, or null. */
  lastVisitDate: string | null;
}

const EMPTY: ClientLtvStats = {
  ltv: 0,
  avgCheck: 0,
  visits: 0,
  avgGapDays: null,
  lastVisitDate: null,
};

function dateKey(a: Appointment): number {
  return new Date(`${a.date}T${a.time_start || "00:00"}:00`).getTime();
}

/** Compute stats for one client across the full appointments list. */
export function computeClientLtv(
  clientId: string,
  appointments: Appointment[],
): ClientLtvStats {
  const completed = appointments
    .filter((a) => a.client_id === clientId && a.status === "completed")
    .sort((a, b) => dateKey(a) - dateKey(b));

  if (!completed.length) return EMPTY;

  let ltv = 0;
  for (const a of completed) ltv += Number(a.total_amount ?? 0);

  const visits = completed.length;
  const avgCheck = visits > 0 ? Math.round(ltv / visits) : 0;

  let avgGapDays: number | null = null;
  if (visits >= 2) {
    let totalGap = 0;
    for (let i = 1; i < completed.length; i++) {
      totalGap += dateKey(completed[i]) - dateKey(completed[i - 1]);
    }
    avgGapDays = Math.round(totalGap / (visits - 1) / 86_400_000);
  }

  const last = completed[completed.length - 1];
  return {
    ltv: Math.round(ltv),
    avgCheck,
    visits,
    avgGapDays,
    lastVisitDate: last.date,
  };
}

/** Convenience: build a `clientId → stats` map in one pass. */
export function buildLtvMap(appointments: Appointment[]): Map<string, ClientLtvStats> {
  const map = new Map<string, ClientLtvStats>();
  const byClient = new Map<string, Appointment[]>();
  for (const a of appointments) {
    if (!a.client_id) continue;
    if (a.status !== "completed") continue;
    const arr = byClient.get(a.client_id) ?? [];
    arr.push(a);
    byClient.set(a.client_id, arr);
  }
  for (const [id] of byClient) {
    map.set(id, computeClientLtv(id, appointments));
  }
  return map;
}

/** RU-formatted gap label. Returns empty string when not enough data. */
export function formatGapDays(days: number | null): string {
  if (days === null) return "";
  if (days < 7) return `каждые ${days} дн.`;
  if (days < 35) {
    const weeks = Math.round(days / 7);
    return `каждые ${weeks} нед.`;
  }
  const months = Math.round(days / 30);
  return `каждые ${months} мес.`;
}
