"use client";

// STORY-056 — Inline color-dots row for the unified EventSheet's
// compact-mode. Renders 8 hard-coded swatches + an "ещё" button that
// opens the existing ColorPickerModal for the full palette. NOT a
// bottom sheet — appears directly under the title input.

import { useState } from "react";
import ColorPickerModal from "./ColorPickerModal";

interface EventColorPickerProps {
  value: string;
  onChange: (next: string) => void;
}

// Curated 8-colour set for the compact dots row. Wider gamut is
// available behind the "ещё" button (ColorPickerModal's 10 swatches).
// Hex values match SYSTEM_PRESETS so a freshly-applied preset shows
// its dot as active.
const DOTS: string[] = [
  "#3B82F6", // sys.call — blue
  "#10B981", // sys.meeting — emerald
  "#6366F1", // sys.work — indigo
  "#F59E0B", // sys.lunch — amber
  "#EF4444", // sys.workout — red
  "#6B7280", // sys.commute — gray
  "#A855F7", // VIP / purple
  "#EC4899", // pink
];

export default function EventColorPicker({
  value,
  onChange,
}: EventColorPickerProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto snap-x snap-mandatory">
      {DOTS.map((c) => {
        const active = value.toLowerCase() === c.toLowerCase();
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Цвет ${c}`}
            className={`w-8 h-8 rounded-full shrink-0 snap-center transition active:scale-95 ${
              active
                ? "ring-2 ring-offset-2 ring-[var(--label)]"
                : ""
            }`}
            style={{ background: c }}
          />
        );
      })}
      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        aria-label="Больше цветов"
        className="h-8 px-3 rounded-full shrink-0 bg-[var(--fill-tertiary)] text-[13px] font-medium text-[var(--label)] active:bg-[var(--fill-secondary)] transition"
      >
        ещё
      </button>

      <ColorPickerModal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        value={value}
        onPick={(next) => {
          if (next !== null) onChange(next);
        }}
      />
    </div>
  );
}
