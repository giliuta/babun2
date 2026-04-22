#!/usr/bin/env node
// Sprint 032 Phase 4 — raise the typography floor to 12 px across the
// app. The April UX audit flagged ~140 occurrences of text-[9px] /
// text-[10px] / text-[11px] as the single biggest readability issue
// (sunlight, 40-year-old dispatcher, one-handed thumb, bumpy scooter).
//
// Rules:
//   text-[9px]  -> text-[12px]   (major uplift, 9px is near unreadable)
//   text-[10px] -> text-[12px]   (same, except 16×16 counter badges)
//   text-[11px] -> text-[12px]   (one notch bump; tabular time columns
//                                 stay legible but gain a bit of air)
//
// Exclusions: we intentionally LEAVE text-[10px] in place on:
//   - BottomTabBar labels — iOS HIG uses 10-11 px here
//   - Counter badges inside 16×16 circles (the red "2" in the Chats tab)
// These are matched by file path so a blanket sed isn't possible.

import { readFile, writeFile, readdir } from "node:fs/promises";

const SRC = "babun-crm/apps/web/src";

// File paths where small text is intentional and should be preserved.
// The script walks the remaining files and applies the full rules.
const PRESERVE = new Set([
  // BottomTabBar labels + counter badges (iOS native feel)
  "components/layout/BottomTabBar.tsx",
  // iOS status-bar-like chips in the tab bar
]);

// Per-line preservers: skip lines matching these patterns because the
// small size is part of a 16 px badge / counter.
const LINE_SKIPS = [
  /badge/i,
  /w-\[16/, /h-\[16/,
  /w-4 h-4/, /w-5 h-5/,
  /rounded-full bg-\[var\(--system-(red|orange)\)\]/,  // red unread dot
  /leading-\[16px\]/,  // counter badge line height hint
];

const RULES = [
  [/text-\[9px\]/g, "text-[12px]"],
  [/text-\[10px\]/g, "text-[12px]"],
  [/text-\[11px\]/g, "text-[12px]"],
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
    if (PRESERVE.has(rel)) continue;

    const orig = await readFile(file, "utf8");
    const lines = orig.split(/\r?\n/);
    let replacedHere = 0;

    const nextLines = lines.map((line) => {
      if (LINE_SKIPS.some((re) => re.test(line))) return line;
      let nextLine = line;
      for (const [re, to] of RULES) {
        const matches = nextLine.match(re);
        if (matches) {
          nextLine = nextLine.replace(re, to);
          replacedHere += matches.length;
        }
      }
      return nextLine;
    });

    if (replacedHere > 0) {
      const joiner = orig.includes("\r\n") ? "\r\n" : "\n";
      await writeFile(file, nextLines.join(joiner), "utf8");
      changed++;
      totalReplacements += replacedHere;
      console.log(`  [${replacedHere.toString().padStart(3)}] ${rel}`);
    }
  }

  console.log(`\nChanged ${changed} files, ${totalReplacements} replacements.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
