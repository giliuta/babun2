// Pure state-machine for calendar snap-scroll. Extracted from
// app/dashboard/page.tsx so the logic is testable without a DOM.
//
// Modelled floor levels:
//   "9"     — ceiling 09:00 (open-position, work-day start)
//   "7"     — ceiling 07:00 (one step above 09:00)
//   "0"     — ceiling 00:00 (hard top)
//   "below" — user is below 09:00 (free scroll zone)
//
// Rules (mirror the production handler):
// 1. scrollTop >= 9*hh  → floor = "below", no snap.
// 2. scrollTop < 9*hh AND floor = "below"
//      → first return from below: set floor = "9", snap to 9*hh.
// 3. scrollTop < 9*hh AND floor in {"9","7","0"}
//      3a. top < floorPx - 4  → advance floor (9→7, 7→0, 0→0), snap
//            to new floor.
//      3b. top > floorPx + 4  → bounce back to current floor.
//      3c. otherwise           → no-op.

export type SnapFloor = "9" | "7" | "0" | "below";

export interface SnapDecision {
  nextFloor: SnapFloor;
  /** Target scrollTop to snap to, or null to leave scroll alone. */
  snapTo: number | null;
}

const TOL = 4;

export function floorToPx(level: "9" | "7" | "0", hh: number): number {
  return level === "9" ? 9 * hh : level === "7" ? 7 * hh : 0;
}

export function nextFloorAfter(current: "9" | "7" | "0"): "9" | "7" | "0" {
  return current === "9" ? "7" : current === "7" ? "0" : "0";
}

export function decideSnap(
  top: number,
  hh: number,
  floor: SnapFloor
): SnapDecision {
  const workTop = 9 * hh;

  // 1. Below 9:00 — free zone.
  if (top >= workTop - 1) {
    return { nextFloor: "below", snapTo: null };
  }

  // 2. Returning from below-zone: always hit 9:00 first.
  if (floor === "below") {
    return { nextFloor: "9", snapTo: 9 * hh };
  }

  const current = floor; // "9" | "7" | "0"
  const floorPx = floorToPx(current, hh);

  // 3a. Scrolled above current floor → advance.
  if (top < floorPx - TOL) {
    const next = nextFloorAfter(current);
    // "0" → "0" — no move, no snap needed.
    if (next === current) {
      return { nextFloor: current, snapTo: null };
    }
    return { nextFloor: next, snapTo: floorToPx(next, hh) };
  }

  // 3b. Sat below current floor but still above 9:00 → bounce back.
  if (top > floorPx + TOL) {
    return { nextFloor: current, snapTo: floorPx };
  }

  // 3c. Already at floor → no-op.
  return { nextFloor: current, snapTo: null };
}
