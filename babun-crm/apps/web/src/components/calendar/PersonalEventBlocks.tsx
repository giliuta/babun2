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

// v456 — full radio-list redesign. Mirrors iOS Calendar's «Alert»
// sheet: when the toggle is on, the card expands into a vertical
// list of options (one row per offset) plus a divided «Точное
// время» row that reveals a datetime input.
const PRESET_OFFSETS: { label: string; value: number }[] = [
  { label: "За 5 минут",   value: 5 },
  { label: "За 15 минут",  value: 15 },
  { label: "За 30 минут",  value: 30 },
  { label: "За 1 час",     value: 60 },
  { label: "За 24 часа",   value: 1440 },
];

interface PushPickerValue {
  enabled: boolean;
  offsetMin: number | null;
  at: string | null;
}

export function PushOffsetPicker({
  value,
  onChange,
  eventStartIso,
}: {
  value: PushPickerValue;
  onChange: (next: PushPickerValue) => void;
  eventStartIso?: string;
}) {
  const isAbsolute = value.at !== null;
  const isPreset = !isAbsolute && value.offsetMin !== null;
  const noneSelected = !isPreset && !isAbsolute;

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-3.5 py-3 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[8px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Bell size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[var(--label)]">
              Push-уведомление
            </div>
            <div className="text-[11px] text-[var(--label-secondary)]">
              {summarizePush(value)}
            </div>
          </div>
        </div>
        <ToggleSlim
          checked={value.enabled}
          onChange={(next) => onChange({ ...value, enabled: next })}
          ariaLabel="Push-уведомление"
        />
      </div>

      {value.enabled && (
        <div className="border-t border-[var(--separator)] select-none">
          {/* Не напоминать option */}
          <RadioRow
            label="Не напоминать"
            active={noneSelected}
            onClick={() =>
              onChange({ enabled: true, offsetMin: null, at: null })
            }
          />
          {PRESET_OFFSETS.map((p) => (
            <RadioRow
              key={p.value}
              label={p.label}
              active={isPreset && value.offsetMin === p.value}
              onClick={() =>
                onChange({ enabled: true, offsetMin: p.value, at: null })
              }
            />
          ))}
          <div className="border-t border-[var(--separator)]" />
          <RadioRow
            label="В точное время"
            active={isAbsolute}
            onClick={() => {
              if (isAbsolute) {
                onChange({ enabled: true, offsetMin: null, at: null });
              } else {
                const seed = (() => {
                  const base = eventStartIso
                    ? new Date(eventStartIso)
                    : new Date(Date.now() + 60 * 60_000);
                  if (isNaN(base.getTime()))
                    return new Date(Date.now() + 60 * 60_000);
                  base.setMinutes(base.getMinutes() - 60);
                  return base;
                })();
                onChange({
                  enabled: true,
                  offsetMin: null,
                  at: isoToLocalInput(seed),
                });
              }
            }}
          />
          {isAbsolute && (
            <div
              className="px-4 py-2.5 flex items-center gap-2"
              style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
            >
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[72px] shrink-0">
                Когда
              </div>
              <input
                type="datetime-local"
                value={value.at ?? ""}
                onChange={(e) =>
                  onChange({
                    enabled: true,
                    offsetMin: null,
                    at: e.target.value || null,
                  })
                }
                className="flex-1 h-9 px-3 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// iOS-Settings-style radio row — left label, right ✓ when active.
function RadioRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-2.5 text-[14px] active:bg-[var(--fill-quaternary)] transition ${active ? "text-[var(--accent)] font-semibold" : "text-[var(--label)]"}`}
    >
      <span>{label}</span>
      {active && (
        <span className="text-[var(--accent)] text-[16px] font-semibold">✓</span>
      )}
    </button>
  );
}

function summarizePush(v: PushPickerValue): string {
  if (!v.enabled) return "Выкл";
  if (v.at) {
    const d = new Date(v.at);
    if (isNaN(d.getTime())) return "Своё время";
    return d.toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (v.offsetMin !== null) return formatOffsetLabel(v.offsetMin);
  return "Не напоминать";
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

// datetime-local input wants `YYYY-MM-DDTHH:mm` in local time.
function isoToLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  { value: "none",     label: "Не повторять" },
  { value: "daily",    label: "Ежедневно" },
  { value: "weekdays", label: "По будням (Пн–Пт)" },
  { value: "weekly",   label: "Каждую неделю" },
  { value: "biweekly", label: "Каждые 2 недели" },
  { value: "monthly",  label: "Каждый месяц" },
  { value: "yearly",   label: "Каждый год" },
];

function repeatSummary(v: PersonalEventRepeat): string {
  const opt = REPEAT_OPTIONS.find((o) => o.value === v.kind);
  const base = opt?.label ?? "Не повторять";
  if (v.kind === "none" || !("until" in v) || !v.until) return base;
  const d = new Date(v.until);
  if (isNaN(d.getTime())) return base;
  const dateStr = d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return `${base} · до ${dateStr}`;
}

export function RepeatPickerRow({
  value,
  onChange,
}: {
  value: PersonalEventRepeat;
  onChange: (next: PersonalEventRepeat) => void;
}) {
  // v456 — repeat mirrors the Push picker pattern. Header row tappable
  // → expands an iOS radio-list of options + a divided «Завершить»
  // date row at the bottom. Same visual rhythm as PushOffsetPicker.
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const setKind = (k: PersonalEventRepeat["kind"]) => {
    if (k === "none") {
      onChange({ kind: "none" });
      return;
    }
    const until =
      "until" in value && value.until ? value.until : undefined;
    onChange({ kind: k, until } as PersonalEventRepeat);
  };

  const setUntil = (next: string | undefined) => {
    if (value.kind === "none") return;
    onChange({ kind: value.kind, until: next } as PersonalEventRepeat);
  };

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3.5 py-3 active:bg-[var(--fill-quaternary)] transition select-none"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-[8px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <span className="text-[14px]">↻</span>
          </div>
          <div className="text-left min-w-0">
            <div className="text-[14px] font-semibold text-[var(--label)]">Повтор</div>
            <div className="text-[11px] text-[var(--label-secondary)] truncate">
              {repeatSummary(value)}
            </div>
          </div>
        </div>
        <div className="text-[12px] text-[var(--label-tertiary)] shrink-0 ml-2">
          {open ? "▴" : "▾"}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--separator)] select-none">
          {REPEAT_OPTIONS.map((opt) => {
            const active = value.kind === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setKind(opt.value)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-[14px] active:bg-[var(--fill-quaternary)] transition ${active ? "text-[var(--accent)] font-semibold" : "text-[var(--label)]"}`}
              >
                <span>{opt.label}</span>
                {active && (
                  <span className="text-[var(--accent)] text-[16px] font-semibold">✓</span>
                )}
              </button>
            );
          })}

          {value.kind !== "none" && (
            <>
              <div className="border-t border-[var(--separator)]" />
              <div
                className="px-4 py-2.5 flex items-center gap-2"
                style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
              >
                <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[72px] shrink-0">
                  Завершить
                </div>
                <input
                  type="date"
                  value={"until" in value && value.until ? value.until : ""}
                  onChange={(e) => setUntil(e.target.value || undefined)}
                  className="flex-1 h-9 px-3 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
                />
                {"until" in value && value.until && (
                  <button
                    type="button"
                    onClick={() => setUntil(undefined)}
                    className="text-[12px] font-semibold text-[var(--accent)] px-2 py-1 active:opacity-60"
                  >
                    Снять
                  </button>
                )}
              </div>
            </>
          )}
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
