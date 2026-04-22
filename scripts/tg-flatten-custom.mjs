#!/usr/bin/env node
// Sprint 033 Phase I2b — flatten the remaining hand-tuned
// `shadow-[0_1px_2px_...]` cards and `shadow-[0_12px_28px_...]` FAB
// drops to the token shadows defined in globals.css.
//
// Keeps:
//  - Switch knob shadow (UI primitive physics; not Telegram-flat)
//  - Toast shadow (UndoToast is an opaque overlay pill, OK to lift)
//  - Hero accent glow on login / 404 icon (intentional brand lift)
//  - SuccessOverlay accent glow (celebratory)

import { readFile, writeFile, readdir } from "node:fs/promises";

const SRC = "babun-crm/apps/web/src";

// Files we intentionally leave alone.
const EXCLUDE = new Set([
  "components/ui/UndoToast.tsx",
  "components/ui/IOSSwitch.tsx",
  "app/login/page.tsx",
  "app/not-found.tsx",
  "components/appointment/SuccessOverlay.tsx",
  "components/layout/Sidebar.tsx", // drawer drop-shadow is a physics cue
]);

const RULES = [
  // Tiny 1-2 px lifts on cards → hairline ring
  [/shadow-\[0_1px_2px_0_rgba\(0,0,0,0\.08\)\]/g, "shadow-[var(--shadow-card)]"],
  [/shadow-\[0_1px_2px_0_rgba\(15,23,42,0\.04\)\]/g, "shadow-[var(--shadow-card)]"],
  [/shadow-\[0_1px_2px_0_rgba\(15,23,42,0\.04\),0_1px_3px_0_rgba\(15,23,42,0\.06\)\]/g, "shadow-[var(--shadow-card)]"],
  // FAB glow (client screen) → token fab
  [/shadow-\[0_12px_28px_-12px_rgba\(42,171,238,0\.65\)\]/g, "shadow-[var(--shadow-fab)]"],
  // Switch knob on masters sheet + settings page — token is not exposed
  // for knobs, so we use shadow-card which is a consistent, small lift.
  [/shadow-\[0_2px_4px_rgba\(0,0,0,0\.15\)\]/g, "shadow-[var(--shadow-card)]"],
];

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      out.push(...(await walk(full)));
    } else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const all = await walk(SRC);
  let changed = 0;
  let totalReplacements = 0;

  for (const file of all) {
    const rel = file.replace(SRC + "/", "");
    if (EXCLUDE.has(rel)) continue;
    const orig = await readFile(file, "utf8");
    let next = orig;
    let count = 0;

    for (const [re, to] of RULES) {
      const m = next.match(re);
      if (m) {
        next = next.replace(re, to);
        count += m.length;
      }
    }

    if (count > 0) {
      await writeFile(file, next, "utf8");
      changed++;
      totalReplacements += count;
      console.log(`  [${count.toString().padStart(3)}] ${rel}`);
    }
  }

  console.log(`\nChanged ${changed} files, ${totalReplacements} replacements.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
