"use client";

// v330 — Second-line for ClientCard.
//
// Shows one of three states based on what's most relevant:
//   * Upcoming visit in ≤7 days → accent-blue «📅 Завтра 14:00»
//   * Past visit  → secondary «Был N дн. назад»
//   * Never visited → tertiary «Ни разу не был»
//
// The state is computed in lib/client-stats.ts via
// getClientDisplayState() so the rendering is purely visual.

import type { getClientDisplayState } from "@/lib/client-stats";

type Display = ReturnType<typeof getClientDisplayState>;

export default function ClientCardStats({ display }: { display: Display }) {
  const colorCls =
    display.tone === "accent"
      ? "text-[var(--accent)] font-semibold"
      : display.tone === "muted"
        ? "text-[var(--label-tertiary)]"
        : "text-[var(--label-secondary)]";
  return (
    <span className={`truncate ${colorCls}`}>{display.lastLine}</span>
  );
}
