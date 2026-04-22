#!/usr/bin/env node
// Sprint 033 Phase I2 — flatten all hardcoded Tailwind shadows on
// light surfaces to match Telegram's flat iOS-light aesthetic.
//
// Rules:
//   shadow-sm          → shadow-[var(--shadow-card)]
//   shadow-md          → shadow-[var(--shadow-card)]
//   shadow-lg          → shadow-[var(--shadow-sheet)]
//   shadow-xl          → shadow-[var(--shadow-sheet)]
//   shadow-2xl         → shadow-[var(--shadow-sheet)]
//   shadow-[0_1px_2px_0_rgba(...)] / shadow-[0_1px_3px_...] small lifts
//                      → shadow-[var(--shadow-card)]
//   shadow-[0px_-4px_24px_...]    big lifts on sheets
//                      → shadow-[var(--shadow-sheet)]
//
// Leaves: `shadow-none`, token-based shadows already using CSS vars.
//
// Run from repo root:   node scripts/tg-flatten.mjs

import { readFile, writeFile, readdir } from "node:fs/promises";

const SRC = "babun-crm/apps/web/src";

const RULES = [
  // Simple Tailwind preset shadows — these are all too heavy for Telegram's
  // flat aesthetic. Map "small/medium lift" to ring-only card shadow, and
  // "large lift" to sheet shadow.
  [/\bshadow-sm\b/g, "shadow-[var(--shadow-card)]"],
  [/\bshadow-md\b/g, "shadow-[var(--shadow-card)]"],
  [/\bshadow-lg\b/g, "shadow-[var(--shadow-sheet)]"],
  [/\bshadow-xl\b/g, "shadow-[var(--shadow-sheet)]"],
  [/\bshadow-2xl\b/g, "shadow-[var(--shadow-sheet)]"],
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
    const orig = await readFile(file, "utf8");
    let next = orig;
    let localCount = 0;

    for (const [re, to] of RULES) {
      const m = next.match(re);
      if (m) {
        next = next.replace(re, to);
        localCount += m.length;
      }
    }

    if (localCount > 0) {
      await writeFile(file, next, "utf8");
      changed++;
      totalReplacements += localCount;
      console.log(`  [${localCount.toString().padStart(3)}] ${rel}`);
    }
  }

  console.log(`\nChanged ${changed} files, ${totalReplacements} replacements.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
