"use client";

import {
  Coffee,
  Briefcase,
  Navigation as NavigationIcon,
  Moon,
  Plane,
} from "@babun/shared/icons";
import {
  EVENT_PRESETS,
  type EventPreset,
} from "@babun/shared/common/utils/event-presets";

// v612 — Event-mode editable body (preset grid + название input).
// Extracted from AppointmentSheet as part of the Sprint #4 §9
// decomposition. Pure presentation: applies a preset to the parent's
// time + title state via the four handlers below.

const EVENT_ICONS: Record<EventPreset["icon"], React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  coffee: Coffee,
  briefcase: Briefcase,
  navigation: NavigationIcon,
  moon: Moon,
  plane: Plane,
};

// v616 P2 — 8 named palette colors for event accent override.
// Slate / red / orange / amber / green / cyan / blue / violet.
// Operator picks the colour after picking the preset; default
// stays the preset's intrinsic colour when no override is set.
export const EVENT_COLOR_PRESETS = [
  { id: "slate", hex: "#64748B", label: "Slate" },
  { id: "red", hex: "#EF4444", label: "Red" },
  { id: "orange", hex: "#F97316", label: "Orange" },
  { id: "amber", hex: "#F59E0B", label: "Amber" },
  { id: "green", hex: "#10B981", label: "Green" },
  { id: "cyan", hex: "#06B6D4", label: "Cyan" },
  { id: "blue", hex: "#3B82F6", label: "Blue" },
  { id: "violet", hex: "#8B5CF6", label: "Violet" },
] as const;

interface EventModeBodyProps {
  eventLabel: string;
  timeStart: string;
  colorOverride?: string | null;
  onLabelChange: (next: string) => void;
  onTimeStartChange: (next: string) => void;
  onTimeEndChange: (next: string) => void;
  onColorChange?: (next: string | null) => void;
}

export default function EventModeBody({
  eventLabel,
  timeStart,
  colorOverride = null,
  onLabelChange,
  onTimeStartChange,
  onTimeEndChange,
  onColorChange,
}: EventModeBodyProps) {
  const applyPreset = (p: EventPreset) => {
    onLabelChange(p.label);
    if (p.allDay) {
      onTimeStartChange("08:00");
      onTimeEndChange("20:00");
      return;
    }
    const [h, m] = timeStart.split(":").map(Number);
    // Clamp at 23:59 rather than wrapping past midnight.
    const endMin = Math.min(23 * 60 + 59, h * 60 + m + p.duration);
    const eh = Math.floor(endMin / 60);
    const em = endMin % 60;
    onTimeEndChange(
      `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`,
    );
  };

  return (
    <div className="px-4 pt-4 space-y-3">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
        Тип события
      </div>
      <div className="grid grid-cols-3 gap-2">
        {EVENT_PRESETS.map((p) => {
          const Icon = EVENT_ICONS[p.icon];
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p)}
              className="py-3 rounded-[14px] border border-[var(--separator)] bg-[var(--surface-card)] text-[13px] font-semibold text-[var(--label)] active:scale-[0.98] flex flex-col items-center gap-1"
              style={
                eventLabel === p.label
                  ? { borderColor: p.color, background: `${p.color}14` }
                  : undefined
              }
            >
              <Icon size={20} strokeWidth={2} />
              {p.label}
            </button>
          );
        })}
      </div>
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
          Название
        </div>
        <input
          type="text"
          value={eventLabel}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="Событие"
          className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
        />
      </div>
      {onColorChange && (
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
            Цвет
          </div>
          <div className="flex flex-wrap gap-2">
            {EVENT_COLOR_PRESETS.map((c) => {
              const active = colorOverride === c.hex;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onColorChange(active ? null : c.hex)}
                  aria-label={c.label}
                  className="w-8 h-8 rounded-full active:scale-[0.95] transition border-2"
                  style={{
                    background: c.hex,
                    borderColor: active ? "var(--label)" : "transparent",
                  }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
