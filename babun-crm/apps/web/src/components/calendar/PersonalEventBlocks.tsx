"use client";

// Sub-blocks for PersonalEventSheet. Kept separate so the parent
// stays under the 400-line component budget mandated by CLAUDE.md.
//
// Exports:
//   IconBadge        — circular icon tile coloured by event type
//   ColorSwatchPopover — palette popover anchored to the header swatch
//   PushOffsetPicker — chips for 15min / 24h / custom + custom HH:MM input
//   ICON_MAP         — single source of truth for PersonalEventTypeIcon

import { useEffect, useRef, useState } from "react";
import {
  Coffee,
  Briefcase,
  Navigation as NavigationIcon,
  Moon,
  Plane,
  Bell,
  Heart,
  Star,
  Dumbbell,
  Book,
  Music,
  GraduationCap,
  Stethoscope,
  Car,
  Home,
  Users,
  Phone,
  ShoppingBag,
  Gift,
  Calendar as CalendarIcon,
  Tag,
} from "@babun/shared/icons";
import { PRESET_COLORS } from "@babun/shared/common/utils/colors";
import type { PersonalEventTypeIcon } from "@babun/shared/local/personal-event-types";

export const ICON_MAP: Record<
  PersonalEventTypeIcon,
  React.ComponentType<{ size?: number; strokeWidth?: number }>
> = {
  coffee: Coffee,
  briefcase: Briefcase,
  navigation: NavigationIcon,
  moon: Moon,
  plane: Plane,
  bell: Bell,
  heart: Heart,
  star: Star,
  dumbbell: Dumbbell,
  book: Book,
  music: Music,
  "graduation-cap": GraduationCap,
  stethoscope: Stethoscope,
  car: Car,
  home: Home,
  users: Users,
  phone: Phone,
  "shopping-bag": ShoppingBag,
  gift: Gift,
  calendar: CalendarIcon,
  tag: Tag,
};

export function IconBadge({
  icon,
  color,
  size = 16,
  className = "w-9 h-9 rounded-[10px]",
}: {
  icon: PersonalEventTypeIcon;
  color: string;
  size?: number;
  className?: string;
}) {
  const Icon = ICON_MAP[icon] ?? Tag;
  return (
    <div
      className={`${className} flex items-center justify-center shrink-0`}
      style={{ background: `${color}1f`, color }}
    >
      <Icon size={size} strokeWidth={2} />
    </div>
  );
}

// Tiny anchored popover that pops above-or-below the trigger.
// Closed by clicking outside or pressing Escape.
export function ColorSwatchPopover({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Цвет события"
        className="w-9 h-9 rounded-full border border-[var(--separator)] flex items-center justify-center active:scale-[0.97] transition"
        style={{ background: value }}
      >
        <span className="w-4 h-4 rounded-full bg-white/30" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-[80] bg-[var(--surface-card)] border border-[var(--separator)] shadow-[var(--shadow-card)] rounded-2xl p-2.5 w-[252px]">
          <div className="grid grid-cols-7 gap-1.5">
            {PRESET_COLORS.map((c) => {
              const active =
                value.toLowerCase() === c.value.toLowerCase();
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    onChange(c.value);
                    setOpen(false);
                  }}
                  aria-label={c.name}
                  className={`h-8 rounded-full border-2 transition ${active ? "border-[var(--label)]" : "border-transparent"}`}
                  style={{ background: c.value }}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Chip control for "за 15 минут / за 24 часа / своё".
// Stored as `offsets: number[]` so a future "Add second alert" feature
// can extend this to multiple chips. For now the picker is single-pick:
// tapping a chip replaces the array.
const PRESET_OFFSETS: { label: string; value: number }[] = [
  { label: "За 5 мин", value: 5 },
  { label: "За 15 мин", value: 15 },
  { label: "За 30 мин", value: 30 },
  { label: "За 1 час", value: 60 },
  { label: "За 24 часа", value: 1440 },
];

export function PushOffsetPicker({
  enabled,
  offsets,
  onToggle,
  onChange,
}: {
  enabled: boolean;
  offsets: number[];
  onToggle: (next: boolean) => void;
  onChange: (next: number[]) => void;
}) {
  // "Custom" lives outside the preset list and exposes a text input so
  // the user can type any minute count.
  const customValue = (() => {
    const v = offsets.find((o) => !PRESET_OFFSETS.some((p) => p.value === o));
    return v ?? null;
  })();
  const [customDraft, setCustomDraft] = useState<string>(
    customValue !== null ? String(customValue) : "",
  );

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Bell size={18} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-[var(--label)]">
              Push-уведомление
            </div>
            <div className="text-[12px] text-[var(--label-secondary)]">
              {enabled
                ? offsets.length
                  ? offsets
                      .slice()
                      .sort((a, b) => a - b)
                      .map(formatOffsetLabel)
                      .join(", ")
                  : "Выберите время"
                : "Выкл"}
            </div>
          </div>
        </div>
        <ToggleSlim checked={enabled} onChange={onToggle} ariaLabel="Push-уведомление" />
      </div>

      {enabled && (
        <div className="px-4 pb-4 pt-1 border-t border-[var(--separator)] space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_OFFSETS.map((p) => {
              const active = offsets.includes(p.value);
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => {
                    if (active) {
                      onChange(offsets.filter((o) => o !== p.value));
                    } else {
                      onChange([...offsets, p.value]);
                    }
                  }}
                  className={`h-8 px-3 rounded-full text-[13px] font-semibold transition ${active ? "bg-[var(--accent)] text-white" : "bg-[var(--fill-tertiary)] text-[var(--label)]"}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom HH:MM (typed as "minutes before") */}
          <div className="flex items-center gap-2">
            <div className="text-[13px] text-[var(--label-secondary)] w-[64px] shrink-0">Своё</div>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={10080}
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onBlur={() => {
                const n = Number(customDraft);
                const cleaned = offsets.filter((o) =>
                  PRESET_OFFSETS.some((p) => p.value === o),
                );
                if (Number.isFinite(n) && n > 0) {
                  onChange([...cleaned, Math.min(10080, Math.round(n))]);
                } else {
                  onChange(cleaned);
                  setCustomDraft("");
                }
              }}
              placeholder="мин до начала"
              className="flex-1 h-9 px-3 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
            />
            <span className="text-[12px] text-[var(--label-tertiary)]">мин</span>
          </div>
        </div>
      )}
    </div>
  );
}

function formatOffsetLabel(min: number): string {
  if (min < 60) return `${min} мин`;
  if (min % 60 === 0) {
    const h = min / 60;
    if (h === 24) return "24 ч";
    if (h % 24 === 0) return `${h / 24} дн`;
    return `${h} ч`;
  }
  return `${min} мин`;
}

// Slim iOS toggle wrapper to dodge the heavier IOSSwitch barrel here.
function ToggleSlim({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-[51px] h-[31px] rounded-full transition shrink-0 ${checked ? "bg-[var(--system-green)]" : "bg-[var(--fill-tertiary)]"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-[27px] h-[27px] rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[20px]" : "translate-x-0"}`}
      />
    </button>
  );
}
