#!/usr/bin/env node
// Sprint 032 Phase 1 — convert hardcoded Tailwind brand/neutral colors
// to CSS-variable tokens defined in globals.css (Old Money palette).
//
// Rules below are intentionally narrow: we only rewrite classes that
// appear inside className strings (so syntax stays valid) and only for
// the specific hex-era Tailwind tokens we know are "wrong" in the new
// palette. Opacity variants like bg-white/10 are LEFT ALONE — they
// carry meaning (hover overlays on accent buttons, glass effects).
//
// Run from repo root:   node scripts/oldmoney-cleanup.mjs

import { readFile, writeFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

const repoRoot = new URL("..", import.meta.url).pathname.replace(/^\//, "");
const SRC = "babun-crm/apps/web/src";

// Ordered replacements: FIRST PASS must not leave behind strings that
// match later passes in unexpected places. Each entry:
//   { re: /.../g, to: "..." , label: "..." }
//
// The regex keys match the class token preceded by a word boundary and
// followed by whitespace, closing quote, or backtick (so we don't eat
// bg-white/10, bg-blue-500/60, text-red-500/80 etc).
const followedBySpaceOrQuote = "(?=[\\s\"`'}])";

const RULES = [
  // Pure neutrals --------------------------------------------------
  ["bg-white", "bg-[var(--surface-card)]"],
  ["text-white", "text-[var(--label-on-accent)]"],
  ["bg-gray-50", "bg-[var(--surface-card)]"],
  ["bg-gray-100", "bg-[var(--surface-card-secondary)]"],
  ["bg-gray-200", "bg-[var(--fill-tertiary)]"],
  ["bg-gray-300", "bg-[var(--fill-secondary)]"],
  ["bg-slate-50", "bg-[var(--surface-card)]"],
  ["bg-slate-100", "bg-[var(--surface-card-secondary)]"],
  ["bg-slate-200", "bg-[var(--fill-tertiary)]"],
  ["bg-neutral-50", "bg-[var(--surface-card)]"],
  ["bg-neutral-100", "bg-[var(--surface-card-secondary)]"],
  ["text-gray-900", "text-[var(--label)]"],
  ["text-gray-800", "text-[var(--label)]"],
  ["text-gray-700", "text-[var(--label-secondary)]"],
  ["text-gray-600", "text-[var(--label-secondary)]"],
  ["text-gray-500", "text-[var(--label-secondary)]"],
  ["text-gray-400", "text-[var(--label-tertiary)]"],
  ["text-slate-900", "text-[var(--label)]"],
  ["text-slate-700", "text-[var(--label-secondary)]"],
  ["text-slate-500", "text-[var(--label-secondary)]"],
  ["text-slate-400", "text-[var(--label-tertiary)]"],
  ["border-gray-200", "border-[var(--separator)]"],
  ["border-gray-300", "border-[var(--separator-opaque)]"],
  ["border-slate-200", "border-[var(--separator)]"],

  // Blue-family → accent (forest green) ----------------------------
  ["bg-sky-500", "bg-[var(--accent)]"],
  ["bg-sky-600", "bg-[var(--accent-pressed)]"],
  ["bg-blue-500", "bg-[var(--accent)]"],
  ["bg-blue-600", "bg-[var(--accent-pressed)]"],
  ["bg-indigo-500", "bg-[var(--accent)]"],
  ["bg-indigo-600", "bg-[var(--accent-pressed)]"],
  ["bg-indigo-700", "bg-[var(--accent-pressed)]"],
  ["bg-violet-500", "bg-[var(--accent)]"],
  ["bg-violet-600", "bg-[var(--accent-pressed)]"],
  ["text-sky-500", "text-[var(--accent)]"],
  ["text-sky-600", "text-[var(--accent)]"],
  ["text-blue-500", "text-[var(--accent)]"],
  ["text-blue-600", "text-[var(--accent)]"],
  ["text-indigo-500", "text-[var(--accent)]"],
  ["text-indigo-600", "text-[var(--accent)]"],
  ["text-indigo-700", "text-[var(--accent)]"],
  ["text-violet-600", "text-[var(--accent)]"],

  // Red-family → burgundy ------------------------------------------
  ["bg-red-500", "bg-[var(--system-red)]"],
  ["bg-red-600", "bg-[var(--system-red)]"],
  ["bg-rose-400", "bg-[var(--system-red)]"],
  ["bg-rose-500", "bg-[var(--system-red)]"],
  ["bg-rose-600", "bg-[var(--system-red)]"],
  ["text-red-500", "text-[var(--system-red)]"],
  ["text-red-600", "text-[var(--system-red)]"],
  ["text-red-700", "text-[var(--system-red)]"],
  ["text-rose-500", "text-[var(--system-red)]"],
  ["text-rose-600", "text-[var(--system-red)]"],

  // Green-family → muted sage --------------------------------------
  ["bg-emerald-400", "bg-[var(--system-green)]"],
  ["bg-emerald-500", "bg-[var(--system-green)]"],
  ["bg-emerald-600", "bg-[var(--system-green)]"],
  ["bg-green-500", "bg-[var(--system-green)]"],
  ["bg-green-600", "bg-[var(--system-green)]"],
  ["text-emerald-500", "text-[var(--system-green)]"],
  ["text-emerald-600", "text-[var(--system-green)]"],
  ["text-green-600", "text-[var(--system-green)]"],

  // Amber-family → warm gold ---------------------------------------
  ["bg-amber-400", "bg-[var(--system-orange)]"],
  ["bg-amber-500", "bg-[var(--system-orange)]"],
  ["bg-amber-600", "bg-[var(--system-orange)]"],
  ["text-amber-500", "text-[var(--system-orange)]"],
  ["text-amber-600", "text-[var(--system-orange)]"],
];

const FILE_GLOBS = ["**/*.tsx", "**/*.ts"];

async function main() {
  const fg = await import("node:fs/promises");
  // Use fast-glob via dynamic import? Actually use fs walk.
  const { readdir } = fg;
  const all = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === ".next") continue;
        await walk(full);
      } else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) {
        all.push(full);
      }
    }
  }
  await walk(SRC);

  let changed = 0;
  let totalReplacements = 0;

  for (const file of all) {
    const orig = await readFile(file, "utf8");
    let next = orig;
    let replacedHere = 0;

    for (const [from, to] of RULES) {
      const re = new RegExp(`\\b${from.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}${followedBySpaceOrQuote}`, "g");
      const matches = next.match(re);
      if (matches) {
        next = next.replace(re, to);
        replacedHere += matches.length;
      }
    }

    if (replacedHere > 0) {
      await writeFile(file, next, "utf8");
      changed++;
      totalReplacements += replacedHere;
      console.log(`  [${replacedHere.toString().padStart(3)}] ${file.replace(SRC + "/", "")}`);
    }
  }

  console.log(`\nChanged ${changed} files, ${totalReplacements} replacements.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
