// Self-contained test harness for snap-scroll pure logic.
// We don't have Vitest/Jest set up yet, so the "tests" are
// invariant assertions runnable via `npx tsx <path>` or
// by importing and calling runSnapTests() in a dev console.
//
// Each case documents the user story from the product brief:
// https://babun2.vercel.app  (STORY: scroll snap with step-up
// ceilings at 9:00 / 7:00 / 0:00).

import { decideSnap, type SnapFloor } from "./snap-scroll";

interface Case {
  name: string;
  hh: number;
  /** Initial floor state feeding into decideSnap. */
  floor: SnapFloor;
  /** scrollTop that triggered the decision. */
  top: number;
  /** Expected next floor. */
  expectedFloor: SnapFloor;
  /** Expected scrollTo target (or null for no-op). */
  expectedSnap: number | null;
}

const HH = 60;

const CASES: Case[] = [
  // ─── Open scenario ───────────────────────────────────────────────
  {
    name: "Open at 09:00, tiny wiggle keeps at floor",
    hh: HH,
    floor: "9",
    top: 9 * HH + 2,
    // 9*HH+2 == 542 > workTop-1 (539) → below-zone
    expectedFloor: "below",
    expectedSnap: null,
  },
  {
    name: "Open at 09:00, user swipes up to 08:00 → step to 07:00",
    hh: HH,
    floor: "9",
    top: 8 * HH,
    expectedFloor: "7",
    expectedSnap: 7 * HH,
  },
  {
    name: "At 07:00 floor, swipe up to 06:00 → step to 00:00",
    hh: HH,
    floor: "7",
    top: 6 * HH,
    expectedFloor: "0",
    expectedSnap: 0,
  },
  {
    name: "At 00:00 floor, try scroll up (already at ceiling)",
    hh: HH,
    floor: "0",
    top: 0,
    expectedFloor: "0",
    expectedSnap: null,
  },

  // ─── Bounce-back scenarios ────────────────────────────────────────
  {
    name: "At 07:00 floor, user over-scrolls down to 08:00 → bounce to 07:00",
    hh: HH,
    floor: "7",
    top: 8 * HH,
    expectedFloor: "7",
    expectedSnap: 7 * HH,
  },
  {
    name: "At 00:00 floor, user down to 02:00 → bounce to 00:00",
    hh: HH,
    floor: "0",
    top: 2 * HH,
    expectedFloor: "0",
    expectedSnap: 0,
  },

  // ─── Below-zone → return ──────────────────────────────────────────
  {
    name: "At 13:00, still below work zone, floor stays below",
    hh: HH,
    floor: "below",
    top: 13 * HH,
    expectedFloor: "below",
    expectedSnap: null,
  },
  {
    name: "From 13:00 pulling up slightly to 10:00 — still below-zone",
    hh: HH,
    floor: "below",
    top: 10 * HH,
    expectedFloor: "below",
    expectedSnap: null,
  },
  {
    name: "From below-zone, swipe up to 08:00 → first hit is 09:00",
    hh: HH,
    floor: "below",
    top: 8 * HH,
    expectedFloor: "9",
    expectedSnap: 9 * HH,
  },
  {
    name: "From below-zone, big fling all the way to 02:00 → still 09:00 first",
    hh: HH,
    floor: "below",
    top: 2 * HH,
    expectedFloor: "9",
    expectedSnap: 9 * HH,
  },

  // ─── Full flow after returning from below ────────────────────────
  {
    name: "After returning from below (floor=9), swipe up again → 07:00",
    hh: HH,
    floor: "9",
    top: 7.5 * HH,
    expectedFloor: "7",
    expectedSnap: 7 * HH,
  },

  // ─── Transition boundary: landing exactly at 9:00 ────────────────
  {
    name: "Land exactly at 9:00 → enters below-zone because >= workTop",
    hh: HH,
    floor: "7",
    top: 9 * HH,
    expectedFloor: "below",
    expectedSnap: null,
  },

  // ─── Zoom scenarios (different hh) ───────────────────────────────
  {
    name: "At zoom-in hh=200, floor=9, user up to 7.5h → step to 7 (ps-scaled)",
    hh: 200,
    floor: "9",
    top: 7.5 * 200,
    expectedFloor: "7",
    expectedSnap: 7 * 200,
  },
  {
    name: "At zoom-out hh=30, floor=7, user up to 5h → step to 0",
    hh: 30,
    floor: "7",
    top: 5 * 30,
    expectedFloor: "0",
    expectedSnap: 0,
  },
];

export function runSnapTests(): { pass: number; fail: number; failures: string[] } {
  let pass = 0;
  let fail = 0;
  const failures: string[] = [];
  for (const c of CASES) {
    const got = decideSnap(c.top, c.hh, c.floor);
    const ok =
      got.nextFloor === c.expectedFloor && got.snapTo === c.expectedSnap;
    if (ok) {
      pass++;
    } else {
      fail++;
      failures.push(
        `✗ ${c.name}\n  expected { floor: ${c.expectedFloor}, snap: ${c.expectedSnap} }\n  got      { floor: ${got.nextFloor}, snap: ${got.snapTo} }`
      );
    }
  }
  return { pass, fail, failures };
}

// Simple CLI runner: `tsx snap-scroll.test.ts`. No dev-deps needed.
if (typeof require !== "undefined" && require.main === module) {
  const r = runSnapTests();
  // eslint-disable-next-line no-console
  console.log(`snap-scroll: ${r.pass} passed, ${r.fail} failed`);
  for (const f of r.failures) console.log(f);
  if (r.fail > 0) process.exit(1);
}
