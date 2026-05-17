// Brief 1 #20 — Pure helper to detect overlapping appointments.
//
// Extracted from AppointmentSheet's inline useMemo so the same rules
// run on drag-drop, batch import, conflict-check UI, and tests.
//
// Semantics — half-open interval, per (date, team_id) bucket:
//   · An appointment is considered to overlap `candidate` when both
//     are on the same date AND same team AND their [start, end)
//     ranges intersect.
//   · Cancelled rows never count (they're ghosts).
//   · Personal events / kind="event" never collide with work
//     appointments and vice versa.

interface OverlapCandidate {
  id?: string;
  date: string;
  time_start: string;
  time_end: string;
  team_id?: string | null;
  kind?: "work" | "event" | "personal";
}

interface OverlapExisting extends OverlapCandidate {
  id: string;
  status?: string;
}

export function findOverlap(
  candidate: OverlapCandidate,
  existing: readonly OverlapExisting[],
): OverlapExisting | null {
  if (!candidate.team_id) return null;
  if (candidate.kind === "event" || candidate.kind === "personal") return null;
  if (
    !candidate.time_start ||
    !candidate.time_end ||
    candidate.time_start >= candidate.time_end
  ) {
    return null;
  }
  for (const other of existing) {
    if (other.id === candidate.id) continue;
    if (other.status === "cancelled") continue;
    if (other.date !== candidate.date) continue;
    if (other.team_id !== candidate.team_id) continue;
    if (other.kind === "event" || other.kind === "personal") continue;
    if (
      candidate.time_start < other.time_end &&
      other.time_start < candidate.time_end
    ) {
      return other;
    }
  }
  return null;
}

export function describeOverlap(
  other: OverlapExisting & { comment?: string; client_id?: string | null },
  resolveName: (clientId: string | null | undefined) => string | null,
): string {
  const who =
    (other.client_id ? resolveName(other.client_id) : null) ??
    other.comment ??
    "Запись";
  return `${other.time_start}–${other.time_end} · ${who}`;
}
