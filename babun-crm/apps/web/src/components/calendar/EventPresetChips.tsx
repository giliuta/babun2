"use client";

// STORY-056 — Horizontal scroll row of preset chips for the unified
// EventSheet's compact-mode (kind='event' only). System presets first,
// then custom templates from event_templates table sorted by
// sort_order. Tap a chip → caller applies preset to form state.

import type { EventPreset } from "@/lib/eventPresets";

interface EventPresetChipsProps {
  presets: EventPreset[];
  /** Hex of the currently-selected preset color. Used to highlight
   *  the chip whose color matches the form's color. Optional. */
  activeColor?: string;
  onPick: (preset: EventPreset) => void;
}

export default function EventPresetChips({
  presets,
  activeColor,
  onPick,
}: EventPresetChipsProps) {
  if (presets.length === 0) return null;

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto snap-x snap-mandatory scrollbar-thin pb-1">
        {presets.map((p) => {
          const active =
            !!activeColor &&
            activeColor.toLowerCase() === p.color.toLowerCase();
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className={`shrink-0 snap-start h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-[13px] font-medium transition active:scale-[0.97] border ${
                active
                  ? "border-[var(--label)]"
                  : "border-transparent"
              }`}
              style={{
                background: `${p.color}1f`,
                color: p.color,
              }}
            >
              {p.emoji && (
                <span className="text-[14px] leading-none">{p.emoji}</span>
              )}
              <span>{p.name}</span>
              <span className="text-[var(--label-tertiary)] text-[11px] font-normal">
                {formatDuration(p.durationMin)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}м`;
  if (minutes % 60 === 0) return `${minutes / 60}ч`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}ч${m}м`;
}
