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
        className="w-7 h-7 rounded-full ring-2 ring-[var(--surface-card)] shadow-[0_0_0_1px_var(--separator)] active:scale-[0.97] transition"
        style={{ background: value }}
      />

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

// v453 — single-select push picker. iPhone Calendar / Reminders also
// pick exactly ONE alert (with optional second). Multi-select chips
// confused the user; radio matches their mental model.
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
  // Single-select model: exactly 0 or 1 entry in `offsets`. Legacy
  // multi-select saves still load — we collapse to the first value.
  const current = offsets.length > 0 ? offsets[0] : null;
  const isPreset =
    current !== null && PRESET_OFFSETS.some((p) => p.value === current);
  const isCustom = current !== null && !isPreset;

  const [customDraft, setCustomDraft] = useState<string>(
    isCustom ? String(current) : "",
  );

  const setOne = (v: number | null) => onChange(v === null ? [] : [v]);

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
              {!enabled
                ? "Выкл"
                : current === null
                  ? "Не выбрано время"
                  : formatOffsetLabel(current)}
            </div>
          </div>
        </div>
        <ToggleSlim checked={enabled} onChange={onToggle} ariaLabel="Push-уведомление" />
      </div>

      {enabled && (
        <div className="px-4 pb-4 pt-1 border-t border-[var(--separator)] space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {PRESET_OFFSETS.map((p) => {
              const active = current === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setOne(active ? null : p.value)}
                  className={`h-8 px-3 rounded-full text-[13px] font-semibold transition ${active ? "bg-[var(--accent)] text-white" : "bg-[var(--fill-tertiary)] text-[var(--label)]"}`}
                >
                  {p.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                // Tap "Своё" — make it the active option, seed input
                // with the current minutes if any.
                if (isCustom) {
                  setOne(null);
                  setCustomDraft("");
                } else {
                  const seeded = customDraft.trim()
                    ? Number(customDraft)
                    : 10;
                  if (Number.isFinite(seeded) && seeded > 0) {
                    setOne(Math.min(10080, Math.round(seeded)));
                    setCustomDraft(String(Math.min(10080, Math.round(seeded))));
                  } else {
                    setOne(10);
                    setCustomDraft("10");
                  }
                }
              }}
              className={`h-8 px-3 rounded-full text-[13px] font-semibold transition ${isCustom ? "bg-[var(--accent)] text-white" : "bg-[var(--fill-tertiary)] text-[var(--label)]"}`}
            >
              Своё
            </button>
          </div>

          {isCustom && (
            <div className="flex items-center gap-2">
              <div className="text-[13px] text-[var(--label-secondary)] w-[88px] shrink-0">
                Минут до начала
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={10080}
                value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)}
                onBlur={() => {
                  const n = Number(customDraft);
                  if (Number.isFinite(n) && n > 0) {
                    setOne(Math.min(10080, Math.round(n)));
                  } else {
                    setCustomDraft(String(current ?? ""));
                  }
                }}
                className="flex-1 h-9 px-3 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatOffsetLabel(min: number): string {
  if (min < 60) return `За ${min} мин`;
  if (min % 60 === 0) {
    const h = min / 60;
    if (h === 24) return "За 24 часа";
    if (h % 24 === 0) return `За ${h / 24} дн`;
    return `За ${h} ч`;
  }
  return `За ${min} мин`;
}

// v453 — Apple Maps on iOS, Google Maps elsewhere. Apple's URL scheme
// `maps://?q=…` opens the system Maps app on iPhone/iPad PWAs without
// the Safari prompt. Returns null when there's nothing to navigate to.
export function buildMapsUrl(address: string): string | null {
  const a = address.trim();
  if (!a) return null;
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  const q = encodeURIComponent(a);
  return isIOS
    ? `maps://?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

// ─── Repeat picker ────────────────────────────────────────────────
// v453 — Single-tap row that opens a small action sheet of preset
// recurrence rules. Stays UI-only for now (occurrence expansion onto
// the calendar grid is a follow-up); the picked rule is persisted
// on the appointment for forward-compat.

import type { PersonalEventRepeat } from "@babun/shared/local/appointments";

const REPEAT_OPTIONS: { value: PersonalEventRepeat["kind"]; label: string }[] = [
  { value: "none",    label: "Не повторять" },
  { value: "daily",   label: "Ежедневно" },
  { value: "weekly",  label: "Каждую неделю" },
  { value: "monthly", label: "Каждый месяц" },
  { value: "yearly",  label: "Каждый год" },
];

export function RepeatPickerRow({
  value,
  onChange,
}: {
  value: PersonalEventRepeat;
  onChange: (next: PersonalEventRepeat) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current =
    REPEAT_OPTIONS.find((o) => o.value === value.kind) ?? REPEAT_OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-[var(--fill-quaternary)] transition"
      >
        <div className="w-9 h-9 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
          <span className="text-[16px]">↻</span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[15px] font-semibold text-[var(--label)]">Повтор</div>
        </div>
        <div className="text-[13px] font-medium text-[var(--label-tertiary)] shrink-0">
          {current.label}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--separator)] py-1">
          {REPEAT_OPTIONS.map((opt) => {
            const active = value.kind === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange({ kind: opt.value } as PersonalEventRepeat);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-[14px] text-[var(--label)] active:bg-[var(--fill-quaternary)]"
              >
                <span>{opt.label}</span>
                {active && (
                  <span className="text-[var(--accent)] font-semibold">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
