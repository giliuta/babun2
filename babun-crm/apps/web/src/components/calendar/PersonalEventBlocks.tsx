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
        <div className="border-t border-[var(--separator)] select-none px-3 pt-2.5 pb-3">
          {/* v481 — chip row instead of the iOS-Settings radio list.
              Same 7 options (Не напоминать + 5 presets + В точное
              время), but laid out as wrap-chips so the whole picker
              fits in two rows instead of seven stacked rows. */}
          <div className="flex flex-wrap gap-1.5">
            <ChipChoice
              label="Не напоминать"
              active={noneSelected}
              onClick={() =>
                onChange({ enabled: true, offsetMin: null, at: null })
              }
            />
            {PRESET_OFFSETS.map((p) => (
              <ChipChoice
                key={p.value}
                label={p.label}
                active={isPreset && value.offsetMin === p.value}
                onClick={() =>
                  onChange({ enabled: true, offsetMin: p.value, at: null })
                }
              />
            ))}
            <ChipChoice
              label="Точное время"
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
          </div>
          {isAbsolute && (
            <div
              className="mt-2.5 flex items-center gap-2"
              style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
            >
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[52px] shrink-0">
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
                className="flex-1 h-8 px-2.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[8px] text-[13px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// v481 — compact pill choice. Used by both PushOffsetPicker and
// RepeatPickerRow so the «Напоминание» / «Повтор» cards collapse
// from a 7-row iOS-Settings list to a 2-row chip grid.
function ChipChoice({
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
      className={`inline-flex items-center h-7 px-3 rounded-full text-[12px] font-semibold transition active:scale-[0.96] ${
        active
          ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
          : "bg-[var(--fill-tertiary)] text-[var(--label)] active:bg-[var(--fill-quaternary)]"
      }`}
    >
      {label}
    </button>
  );
}

// Legacy RadioRow removed in v481 — replaced by the inline ChipChoice
// pills used by both PushOffsetPicker and RepeatPickerRow.

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

// v470 — multi-provider navigation links. The user wants a popup with
// Google Maps / Apple Maps / Waze choices instead of a single button.
// Also accepts a pasted maps URL as input — in that case we route the
// link verbatim to «Open as-is» and skip cross-provider rewriting
// (extracting coordinates from a third-party share URL is unreliable
// and would silently lose precision).
export interface MapsLinks {
  google: string;
  apple: string;
  waze: string;
  /** True when the input was already a maps URL — UI shows a single
   *  «Открыть» button instead of the three-provider popup. */
  isUrl: boolean;
  /** True when input parses as bare lat,lng coords. Lets us drive
   *  navigation in Waze/Apple/Google with the canonical ll= form. */
  isCoords: boolean;
}

const MAPS_URL_RE = /^(https?:\/\/)?(www\.)?(maps\.google\.[a-z.]+|google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl|maps\.apple\.com|waze\.com|ul\.waze\.com)\b/i;
const SHORT_URL_RE = /^(https?:\/\/)?(www\.)?(goo\.gl\/maps|maps\.app\.goo\.gl|ul\.waze\.com\/[a-z0-9]+\b)/i;
const COORDS_RE = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

// Try to pull lat/lng or a textual query out of a long-form maps URL.
// Returns null for short links (goo.gl/maps, maps.app.goo.gl) — those
// require an HTTP redirect to expand and can't be resolved client-side.
function extractFromMapsUrl(
  rawUrl: string,
): { lat: number; lng: number } | { query: string } | null {
  let url: URL;
  try {
    url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return null;
  }

  // 1. @LAT,LNG anywhere in href (Google's canonical pin form).
  const atMatch = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url.href);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  // 2. !3dLAT!4dLNG (Google's «place» URLs sometimes embed coords this way).
  const placeMatch = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(url.href);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  // 3. Search params: ?ll=LAT,LNG | ?q=LAT,LNG | ?q=TEXT | ?address=TEXT.
  for (const key of ["ll", "q", "query", "address"]) {
    const v = url.searchParams.get(key);
    if (!v) continue;
    const m = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/.exec(v.trim());
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
    if (v.trim()) return { query: v.trim() };
  }

  // 4. Pathname segments: /search/QUERY, /place/QUERY, /dir/.../QUERY.
  for (const re of [/\/search\/([^/?@]+)/, /\/place\/([^/?@]+)/]) {
    const m = re.exec(url.pathname);
    if (m && m[1]) {
      try {
        return { query: decodeURIComponent(m[1].replace(/\+/g, " ")) };
      } catch {
        return { query: m[1] };
      }
    }
  }

  return null;
}

function linksFromCoords(lat: number, lng: number): MapsLinks {
  // Use 6-decimal precision — enough for ~10 cm accuracy, matches what
  // Google/Apple/Waze emit in their share URLs.
  const la = lat.toFixed(6);
  const ln = lng.toFixed(6);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${la},${ln}`,
    apple: `https://maps.apple.com/?ll=${la},${ln}&q=${la},${ln}`,
    waze: `https://waze.com/ul?ll=${la}%2C${ln}&navigate=yes`,
    isUrl: false,
    isCoords: true,
  };
}

function linksFromQuery(q: string): MapsLinks {
  const enc = encodeURIComponent(q);
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${enc}`,
    apple: `https://maps.apple.com/?q=${enc}`,
    waze: `https://waze.com/ul?q=${enc}&navigate=yes`,
    isUrl: false,
    isCoords: false,
  };
}

export function buildMapsLinks(address: string): MapsLinks | null {
  const raw = address.trim();
  if (!raw) return null;

  // Bare coords «35.12345, 33.45678» — straight to canonical pin URLs.
  const coordsMatch = COORDS_RE.exec(raw);
  if (coordsMatch) {
    return linksFromCoords(parseFloat(coordsMatch[1]), parseFloat(coordsMatch[2]));
  }

  // Pasted maps URL.
  if (MAPS_URL_RE.test(raw)) {
    const url = raw.startsWith("http") ? raw : `https://${raw}`;

    // Short links can't be resolved without an HTTP redirect call.
    // Keep the «open as-is» fallback so the user still has a path.
    if (SHORT_URL_RE.test(raw)) {
      return { google: url, apple: url, waze: url, isUrl: true, isCoords: false };
    }

    // Long-form URL — extract coords or a query and rebuild for each
    // provider, so the user always gets the three-app picker.
    const extracted = extractFromMapsUrl(url);
    if (extracted) {
      if ("lat" in extracted) return linksFromCoords(extracted.lat, extracted.lng);
      return linksFromQuery(extracted.query);
    }

    // Couldn't parse — fall back to «open as-is».
    return { google: url, apple: url, waze: url, isUrl: true, isCoords: false };
  }

  // Free-text address.
  return linksFromQuery(raw);
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
        <div className="border-t border-[var(--separator)] select-none px-3 pt-2.5 pb-3">
          {/* v481 — chip-wrap layout. Same 7 presets, 2 rows instead
              of 7 stacked rows. */}
          <div className="flex flex-wrap gap-1.5">
            {REPEAT_OPTIONS.map((opt) => (
              <ChipChoice
                key={opt.value}
                label={opt.label}
                active={value.kind === opt.value}
                onClick={() => setKind(opt.value)}
              />
            ))}
          </div>

          {value.kind !== "none" && (
            <div
              className="mt-2.5 flex items-center gap-2"
              style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
            >
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[60px] shrink-0">
                Завершить
              </div>
              <input
                type="date"
                value={"until" in value && value.until ? value.until : ""}
                onChange={(e) => setUntil(e.target.value || undefined)}
                className="flex-1 h-8 px-2.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[8px] text-[13px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
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
