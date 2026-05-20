"use client";

// EventForm — unified event editor used by BOTH the team-calendar
// event flow (AppointmentSheet event-mode, context="team") AND the
// personal-calendar (PersonalEventSheet, context="personal").
//
// Sprint #4 P0 §4 — replaces the two diverged "Новое событие" surfaces
// with one component. All features are present regardless of context;
// the `context` prop only drives:
//   • team:     saves with team_id, master_id=null
//   • personal: saves with master_id=current, team_id=null
//
// v657 — two render modes:
//   • Standalone (PersonalEventSheet path): full modal chrome with
//     overlay, header strip, sticky save bar, close-confirm popup.
//   • bodyOnly (AppointmentSheet event-mode path): just the cards.
//     The parent owns the overlay + header + save button. Save is
//     triggered via submitRef; canSave reported via onCanSaveChange.
//
// Fields: TimeBlock + all-day toggle, preset chips (EventPresetChips),
// title, place, URL (video-conf badge auto-detected), push notification
// + extra offsets, repeat, color picker, notes textarea.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Palette,
  Navigation as NavigationIcon,
  Link as LinkIcon,
  MapPin,
  Compass,
  Video,
  Trash2,
  X as XIcon,
} from "@babun/shared/icons";
import { pushRecentPlace } from "@babun/shared/local/event-recent-places";
import type {
  Appointment,
  PersonalEventRepeat,
} from "@babun/shared/local/appointments";
// v657 — EVENT_PRESETS removed: both contexts now use EventPresetChips
// (user-customizable from /settings/calendar/event-types).
import { PRESET_COLORS } from "@babun/shared/common/utils/colors";
import TimeBlock from "@/components/appointment/TimeBlock";
import {
  PushOffsetPicker,
  RepeatPickerRow,
  buildMapsLinks,
  type MapsLinks,
} from "@/components/calendar/PersonalEventBlocks";
import EventPresetChips from "@/components/calendar/EventPresetChips";
import type { PersonalEventType } from "@babun/shared/local/personal-event-types";
import { useCalendarSettings } from "@/components/layout/DashboardClientLayout";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EventFormProps {
  open: boolean;
  onClose: () => void;
  /** "create" | "edit" — "view" treated as read-only alias of "edit". */
  mode: "create" | "view" | "edit";
  /** Appointment with kind="event". */
  event: Appointment;
  /** team = brigade calendar; personal = master's private calendar. */
  context: "team" | "personal";
  onSave: (event: Appointment) => void;
  onDelete?: (event: Appointment) => void;
  /** v619 — emit dirty state changes so the parent can guard external
   *  unmount paths (e.g. AppointmentSheet's segment toggle). Optional;
   *  PersonalEventSheet doesn't need it. */
  onDirtyChange?: (dirty: boolean) => void;
  /** v657 — when true, render ONLY the cards (no overlay, no sheet
   *  container, no header, no sticky save footer). Used by
   *  AppointmentSheet to embed the event editor inline inside the
   *  scroll body, instead of stacking a second modal on top.
   *  Parent supplies its own save button and routes save via
   *  `submitRef` + `onCanSaveChange`. */
  bodyOnly?: boolean;
  /** v657 — parent grabs this ref so its own save button can trigger
   *  EventForm's internal `handleSave`. Only meaningful when
   *  `bodyOnly` is true. */
  submitRef?: React.MutableRefObject<(() => void) | null>;
  /** v657 — fires when canSave flips so the parent's save button
   *  can switch between enabled / disabled states. Only meaningful
   *  when `bodyOnly` is true. */
  onCanSaveChange?: (canSave: boolean) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_COLOR = "#007AFF";
const NO_REPEAT: PersonalEventRepeat = { kind: "none" };

// v657 — TEAM_PRESET_ICONS removed (was only used by the old 5-tile
// team grid). EventPresetChips owns its own icon rendering now.

// 8 named palette colors for the team-context colour row.
const EVENT_COLOR_PRESETS = [
  { id: "slate",  hex: "#64748B", label: "Slate"  },
  { id: "red",    hex: "#EF4444", label: "Red"    },
  { id: "orange", hex: "#F97316", label: "Orange" },
  { id: "amber",  hex: "#F59E0B", label: "Amber"  },
  { id: "green",  hex: "#10B981", label: "Green"  },
  { id: "cyan",   hex: "#06B6D4", label: "Cyan"   },
  { id: "blue",   hex: "#3B82F6", label: "Blue"   },
  { id: "violet", hex: "#8B5CF6", label: "Violet" },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hourToTime(h: number): string {
  const safe = Math.max(0, Math.min(24, Math.round(h)));
  if (safe >= 24) return "23:59";
  return `${String(safe).padStart(2, "0")}:00`;
}

function tintCardBg(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "var(--surface-card)";
  return `${hex}24`;
}

function frameBorder(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "var(--separator-opaque)";
  return `${hex}80`;
}

function dividerLine(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "rgba(60,60,67,0.12)";
  return `${hex}2E`;
}

function sameOffsets(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

function detectVideoConference(url: string): { label: string } | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "zoom.us" || host.endsWith(".zoom.us")) return { label: "Zoom" };
    if (host === "meet.google.com") return { label: "Google Meet" };
    if (host === "teams.microsoft.com" || host === "teams.live.com") return { label: "Teams" };
    if (host === "whereby.com" || host.endsWith(".whereby.com")) return { label: "Whereby" };
    if (host === "meet.jit.si") return { label: "Jitsi" };
    return null;
  } catch { return null; }
}

function formatDateRu(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long", weekday: "long",
  });
}

// ─── Extra-offsets sub-block ──────────────────────────────────────────────────

const QUICK_ADD_OFFSETS: { min: number; label: string }[] = [
  { min: 5,       label: "5 мин"  },
  { min: 15,      label: "15 мин" },
  { min: 30,      label: "30 мин" },
  { min: 60,      label: "1 час"  },
  { min: 60 * 24, label: "1 день" },
];
const EXTRAS_CAP = 3;

function formatOffsetChip(min: number): string {
  if (min < 60) return `За ${min} мин`;
  if (min === 60) return "За 1 час";
  if (min < 60 * 24) return min % 60 === 0 ? `За ${min / 60} ч` : `За ${min} мин`;
  if (min === 60 * 24) return "За 1 день";
  if (min % (60 * 24) === 0) return `За ${min / (60 * 24)} дн`;
  return `За ${min} мин`;
}

function ExtraOffsetsBlock({
  primary, extras, onChange,
}: { primary: number | null; extras: number[]; onChange: (next: number[]) => void }) {
  const used = new Set([...(primary !== null ? [primary] : []), ...extras]);
  const canAddMore = extras.length < EXTRAS_CAP;
  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-3.5 pt-3 pb-1 flex items-baseline justify-between">
        <div className="text-[12px] uppercase tracking-wider font-semibold text-[var(--label-secondary)]">Дополнительно</div>
        <div className="text-[11px] text-[var(--label-tertiary)]">{extras.length}/{EXTRAS_CAP}</div>
      </div>
      {extras.length > 0 && (
        <div className="px-3.5 pb-2 flex flex-wrap gap-1.5">
          {extras.map((m) => (
            <button key={m} type="button"
              onClick={() => onChange(extras.filter((x) => x !== m))}
              className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full text-[12px] font-semibold bg-[var(--accent-tint)] text-[var(--accent)] active:scale-[0.96] transition">
              {formatOffsetChip(m)}
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[10px] leading-none">×</span>
            </button>
          ))}
        </div>
      )}
      <div className="px-3.5 pb-3 flex flex-wrap gap-1.5">
        {QUICK_ADD_OFFSETS.map((p) => {
          const disabled = used.has(p.min) || !canAddMore;
          return (
            <button key={p.min} type="button"
              onClick={() => { if (!disabled) onChange([...extras, p.min]); }}
              disabled={disabled}
              className={`inline-flex items-center h-7 px-2.5 rounded-full text-[12px] font-medium border transition ${disabled ? "border-transparent bg-[var(--fill-quaternary)] text-[var(--label-tertiary)]" : "border-[var(--separator)] text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"}`}>
              + {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Color palette button (centered modal) ────────────────────────────────────

function ColorPaletteButton({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    // v619 — lock body scroll while palette is open (P1 fix).
    // `overflow: hidden` on `body` alone doesn't stop iOS Safari from
    // panning the EventForm's inner overflow-y-auto container, but
    // adding it to documentElement does. Restore on close.
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Цвет события"
        className="w-11 h-11 flex items-center justify-center rounded-lg active:bg-[var(--fill-quaternary)] transition"
        style={{ color: value }}>
        <Palette size={18} strokeWidth={2} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-6" onClick={() => setOpen(false)}>
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] p-5 w-full max-w-[320px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-semibold text-[var(--label)] text-center mb-4">Цвет события</div>
            <div className="grid grid-cols-7 gap-2.5">
              {PRESET_COLORS.map((c) => {
                const active = value.toLowerCase() === c.value.toLowerCase();
                return (
                  <button key={c.value} type="button" onClick={() => { onChange(c.value); setOpen(false); }}
                    aria-label={c.name}
                    className={`w-9 h-9 rounded-full border-2 transition active:scale-[0.92] ${active ? "border-[var(--label)] ring-2 ring-offset-2 ring-[var(--label)]/20" : "border-transparent"}`}
                    style={{ background: c.value }} />
                );
              })}
            </div>
            <button type="button" onClick={() => setOpen(false)}
              className="w-full mt-5 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition">
              Закрыть
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Navigation popup (centered modal — feedback_center_modals.md) ────────────

function NavigationPopup({ links, onClose }: { links: MapsLinks; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const open = (href: string) => { window.open(href, "_blank", "noopener,noreferrer"); onClose(); };
  if (links.isUrl) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-6" onClick={onClose}>
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] p-5 w-full max-w-[300px]" onClick={(e) => e.stopPropagation()}>
          <div className="text-[15px] font-semibold text-[var(--label)] text-center mb-3">Открыть ссылку</div>
          <div className="text-[12px] text-[var(--label-secondary)] text-center mb-4">Это ссылка из карт. Откроется в исходном приложении.</div>
          <button type="button" onClick={() => open(links.google)} className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:scale-[0.98] transition">Открыть</button>
          <button type="button" onClick={onClose} className="w-full mt-2 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition">Отмена</button>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-6" onClick={onClose}>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] p-5 w-full max-w-[300px]" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-[var(--label)] text-center mb-4">Где открыть?</div>
        <div className="space-y-2">
          {[
            { label: "Google Maps", tone: "bg-[#EA4335]", Icon: MapPin,         href: links.google },
            { label: "Apple Maps",  tone: "bg-[#007AFF]", Icon: Compass,        href: links.apple  },
            { label: "Waze",        tone: "bg-[#33CCFF]", Icon: NavigationIcon, href: links.waze   },
          ].map(({ label, tone, Icon, href }) => (
            <button key={label} type="button" onClick={() => open(href)}
              className="w-full flex items-center gap-3 h-12 px-3 rounded-[12px] bg-[var(--fill-quaternary)] active:bg-[var(--fill-tertiary)] transition text-left">
              <span className={`w-8 h-8 rounded-[8px] ${tone} text-white flex items-center justify-center shrink-0`}>
                <Icon size={18} strokeWidth={2.2} />
              </span>
              <span className="text-[14px] font-semibold text-[var(--label)]">{label}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="w-full mt-4 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition">Отмена</button>
      </div>
    </div>
  );
}

// ─── Close-confirm popup (centered modal) ─────────────────────────────────────

function CloseConfirmPopup({
  mode, canSave, onSave, onDiscard, onKeep,
}: { mode: "create" | "edit"; canSave: boolean; onSave: () => void; onDiscard: () => void; onKeep: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onKeep(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onKeep]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-6" onClick={onKeep}>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] p-5 w-full max-w-[300px]" onClick={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-semibold text-[var(--label)] text-center">
          {mode === "edit" ? "Закрыть без сохранения?" : "Закрыть событие?"}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] text-center mt-1.5">
          {mode === "edit" ? "Изменения не запишутся." : "Введённые данные не сохранятся."}
        </div>
        <button type="button" onClick={onDiscard} className="w-full mt-4 h-11 rounded-[10px] bg-[var(--system-red)] text-white text-[14px] font-semibold active:scale-[0.98] transition">Не сохранять</button>
        <button type="button" onClick={onSave} disabled={!canSave}
          className="w-full mt-2 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] font-semibold text-[var(--accent)] active:bg-[var(--fill-quaternary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed transition"
          title={canSave ? "" : "Заполните название, чтобы сохранить"}>
          Сохранить
        </button>
        <button type="button" onClick={onKeep} className="w-full mt-2 h-10 rounded-[10px] text-[14px] font-medium text-[var(--label-secondary)] active:opacity-70 transition">Отмена</button>
      </div>
    </div>
  );
}

// ─── Toggle (slim iOS style) ──────────────────────────────────────────────────

function ToggleSlim({ checked, onChange, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; ariaLabel?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-[51px] h-[31px] rounded-full transition shrink-0 ${checked ? "bg-[var(--system-green)]" : "bg-[var(--fill-tertiary)]"}`}>
      <span className={`absolute top-0.5 left-0.5 w-[27px] h-[27px] rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[20px]" : "translate-x-0"}`} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EventForm({
  open, onClose, mode, event, context, onSave, onDelete, onDirtyChange,
  bodyOnly = false, submitRef, onCanSaveChange,
}: EventFormProps) {
  const { calendarSettings } = useCalendarSettings();
  const workStartHr = calendarSettings.workStartHour ?? calendarSettings.startHour ?? 8;
  const workEndHr   = calendarSettings.workEndHour   ?? calendarSettings.endHour   ?? 22;
  const allDayStart = hourToTime(workStartHr);
  const allDayEnd   = hourToTime(workEndHr);

  // STORY audit (reviewer 5): EventForm had no visualViewport guard and
  // no role="dialog" / aria-modal / aria-label. iOS keyboard occluded
  // the save button (same problem the AppointmentSheet fix solved in
  // batch 1). Clone the same approach: sheet height tracks
  // window.visualViewport.height with a 92 % multiplier so the sticky
  // bottom commit bar stays in the visible band when keyboard opens.
  const [sheetHeight, setSheetHeight] = useState<string>("92vh");
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      setSheetHeight(`${Math.max(320, Math.floor(vv.height * 0.92))}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Form state
  const [dateKey,       setDateKey]       = useState(event.date);
  const [timeStart,     setTimeStart]     = useState(event.time_start);
  const [timeEnd,       setTimeEnd]       = useState(event.time_end);
  const [allDay,        setAllDay]        = useState(event.event_all_day ?? false);
  const [title,         setTitle]         = useState(event.comment ?? "");
  const [notes,         setNotes]         = useState(event.event_notes ?? "");
  const [color,         setColor]         = useState<string>(event.color_override ?? DEFAULT_COLOR);
  const [address,       setAddress]       = useState(event.address ?? "");
  const [url,           setUrl]           = useState(event.event_url ?? "");
  const [pushEnabled,   setPushEnabled]   = useState(event.event_push_enabled ?? false);
  const [pushOffset,    setPushOffset]    = useState<number | null>(
    event.event_push_offsets && event.event_push_offsets.length > 0 ? event.event_push_offsets[0] : null,
  );
  const [extraOffsets, setExtraOffsets]   = useState<number[]>(
    event.event_push_offsets && event.event_push_offsets.length > 1 ? event.event_push_offsets.slice(1) : [],
  );
  const [pushAt,        setPushAt]        = useState<string | null>(event.event_push_at ?? null);
  const [repeat,        setRepeat]        = useState<PersonalEventRepeat>(event.event_repeat ?? NO_REPEAT);
  const [navOpen,       setNavOpen]       = useState(false);
  const [closeConfirm,  setCloseConfirm]  = useState(false);

  // Auto-grow notes textarea
  const notesRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [notes, open]);

  // Reset state when appointment id changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDateKey(event.date);
    setTimeStart(event.time_start);
    setTimeEnd(event.time_end);
    setAllDay(event.event_all_day ?? false);
    setTitle(event.comment ?? "");
    setNotes(event.event_notes ?? "");
    setColor(event.color_override ?? DEFAULT_COLOR);
    setAddress(event.address ?? "");
    setUrl(event.event_url ?? "");
    setPushEnabled(event.event_push_enabled ?? false);
    setPushOffset(
      event.event_push_offsets && event.event_push_offsets.length > 0
        ? event.event_push_offsets[0] : null,
    );
    setExtraOffsets(
      event.event_push_offsets && event.event_push_offsets.length > 1
        ? event.event_push_offsets.slice(1) : [],
    );
    setPushAt(event.event_push_at ?? null);
    setRepeat(event.event_repeat ?? NO_REPEAT);
  }, [event.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const canSave = title.trim().length > 0;
  const eventStartIso = useMemo(() => `${dateKey}T${timeStart}`, [dateKey, timeStart]);

  // Dirty-guard: edit mode checks if anything changed
  const editDirty =
    (mode === "edit") &&
    (dateKey !== event.date ||
      timeStart !== event.time_start ||
      timeEnd !== event.time_end ||
      allDay !== (event.event_all_day ?? false) ||
      title.trim() !== (event.comment ?? "").trim() ||
      notes.trim() !== (event.event_notes ?? "").trim() ||
      color !== (event.color_override ?? DEFAULT_COLOR) ||
      address.trim() !== (event.address ?? "").trim() ||
      url.trim() !== (event.event_url ?? "").trim() ||
      pushEnabled !== (event.event_push_enabled ?? false) ||
      pushAt !== (event.event_push_at ?? null) ||
      !sameOffsets(
        [...(pushOffset !== null ? [pushOffset] : []), ...extraOffsets],
        event.event_push_offsets ?? [],
      ) ||
      JSON.stringify(repeat) !== JSON.stringify(event.event_repeat ?? NO_REPEAT));

  // Create mode: only dirty if user typed something meaningful
  const createDirty =
    (mode === "create") &&
    (title.trim().length > 0 ||
      notes.trim().length > 0 ||
      address.trim().length > 0 ||
      url.trim().length > 0 ||
      pushEnabled ||
      pushAt !== null ||
      repeat.kind !== "none");

  const handleCloseRequest = () => {
    if (editDirty || createDirty) setCloseConfirm(true);
    else onClose();
  };

  // v619 — surface dirty state to parent so external unmount paths
  // (segment toggle in AppointmentSheet) can show a confirm before
  // dropping the draft.
  const isDirty = editDirty || createDirty;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // v657 — when embedded in bodyOnly mode the parent owns the save
  // button. Mirror canSave to the parent so it can switch its
  // CTA enabled/disabled appropriately.
  useEffect(() => {
    onCanSaveChange?.(canSave);
  }, [canSave, onCanSaveChange]);

  // v657 — in bodyOnly mode, the parent (AppointmentSheet) owns the
  // time chip in its caption strip; use the event prop for the
  // authoritative date/time and ignore our internal mirror, to avoid
  // a stale-state drift where the chip says 13:00 but the saved
  // event is at 14:00 because the user edited inside EventForm
  // after the chip. The all-day toggle still uses internal state
  // because there's no parent control surface for it.
  const buildPayload = (): Appointment => {
    const effectiveDate      = bodyOnly ? event.date       : dateKey;
    const effectiveTimeStart = bodyOnly ? event.time_start : timeStart;
    const effectiveTimeEnd   = bodyOnly ? event.time_end   : timeEnd;
    return {
      ...event,
      date: effectiveDate,
      time_start: allDay ? allDayStart : effectiveTimeStart,
      time_end:   allDay ? allDayEnd   : effectiveTimeEnd,
      comment: title.trim(),
      event_notes: notes.trim(),
      color_override: color,
      address: address.trim(),
      event_url: url.trim(),
      event_all_day: allDay,
      event_push_enabled: pushEnabled,
      event_push_offsets:
        pushEnabled && !pushAt
          ? Array.from(new Set([...(pushOffset !== null ? [pushOffset] : []), ...extraOffsets])).sort((a, b) => a - b)
          : [],
      event_push_at: pushEnabled && pushAt ? pushAt : null,
      event_repeat: repeat,
      kind: "event",
      updated_at: new Date().toISOString(),
    };
  };

  const handleSave = () => {
    if (!canSave) return;
    const payload = buildPayload();
    if (payload.address) pushRecentPlace(payload.address);
    onSave(payload);
  };

  // v657 — keep submitRef pointing at the latest handleSave so the
  // parent's CTA can call into it without restaling closures.
  // handleSave is recreated every render (closes over local state),
  // so we keep an internal ref-of-ref to avoid useEffect churn.
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  useEffect(() => {
    if (!submitRef) return;
    submitRef.current = () => handleSaveRef.current();
    return () => {
      if (submitRef) submitRef.current = null;
    };
  }, [submitRef]);

  if (!open) return null;

  const mapsLinks = buildMapsLinks(address);
  const readonly = mode === "view";

  // v657 — body cards are rendered identically in both standalone
  // (PersonalEventSheet wraps EventForm) and embedded (AppointmentSheet
  // event-mode) modes. The bodyContent fragment is the SAME in both
  // paths; only the surrounding chrome differs.
  const bodyContent = (
    <>
      {/* v657 — when embedded inline, the parent's header has no
          color-picker, so we surface the 8-swatch row at the very top
          of the body. */}
      {bodyOnly && !readonly && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden px-3.5 py-2.5">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] mb-2">Цвет</div>
          <div className="grid grid-cols-8 gap-2">
            {EVENT_COLOR_PRESETS.map((c) => {
              const active = color.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColor(c.hex)}
                  aria-label={c.label}
                  className={`w-full aspect-square rounded-full border-2 transition active:scale-[0.92] ${active ? "border-[var(--label)] ring-2 ring-offset-1 ring-[var(--label)]/20" : "border-transparent"}`}
                  style={{ background: c.hex }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Card 1 — Time + all-day toggle.
          v657 — in bodyOnly mode the parent (AppointmentSheet) renders
          its own date+time chip in the caption strip above the body,
          so we only show a slim all-day toggle row here instead of the
          full TimeBlock. Standalone mode keeps the full TimeBlock. */}
      {bodyOnly ? (
        !readonly && (
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden flex items-center gap-2 px-4 py-2.5 text-[13px]">
            <span className="text-[var(--label-tertiary)]">⏰</span>
            <span className="font-semibold text-[var(--label)]">
              {allDay ? "Весь день" : `${event.time_start} – ${event.time_end}`}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">Весь день</span>
              <ToggleSlim
                checked={allDay}
                onChange={(v) => {
                  setAllDay(v);
                  if (v) { setTimeStart(allDayStart); setTimeEnd(allDayEnd); }
                }}
                ariaLabel="Весь день"
              />
            </span>
          </div>
        )
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
          {!allDay ? (
            <TimeBlock
              date={dateKey}
              timeStart={timeStart}
              timeEnd={timeEnd}
              onChange={({ date: d, timeStart: s, timeEnd: e }) => {
                setDateKey(d); setTimeStart(s); setTimeEnd(e);
              }}
              rightSlot={
                !readonly ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">Весь день</span>
                    <ToggleSlim checked={allDay} onChange={(v) => {
                      setAllDay(v);
                      if (v) { setTimeStart(allDayStart); setTimeEnd(allDayEnd); }
                    }} ariaLabel="Весь день" />
                  </div>
                ) : undefined
              }
            />
          ) : (
            <div className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
              <span className="text-[var(--label-tertiary)]">⏰</span>
              <span className="font-semibold text-[var(--label)]">{formatDateRu(dateKey)}</span>
              <span className="text-[var(--label-secondary)]">· весь день</span>
              {!readonly && (
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">Весь день</span>
                  <ToggleSlim checked={allDay} onChange={(v) => setAllDay(v)} ariaLabel="Весь день" />
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Preset chips — same component for both contexts */}
      {!readonly && (
        <EventPresetChips
          onPick={(preset: PersonalEventType) => {
            setTitle(preset.label);
            setColor(preset.color);
            if (preset.allDay) {
              setAllDay(true); setTimeStart(allDayStart); setTimeEnd(allDayEnd);
            } else {
              setAllDay(false);
              const baseStart = allDay || timeStart === "00:00" || timeStart === allDayStart ? "10:00" : timeStart;
              setTimeStart(baseStart);
              const [h, m] = baseStart.split(":").map(Number);
              const totalMin = (h ?? 0) * 60 + (m ?? 0) + preset.defaultDuration;
              const eh = Math.floor(totalMin / 60) % 24;
              const em = totalMin % 60;
              setTimeEnd(`${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`);
            }
          }}
        />
      )}

      {/* Card 2 — Hero title + notes */}
      <div
        className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden relative"
        style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
      >
        <div className="px-4 pt-3 pb-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название"
            readOnly={readonly}
            className="w-full text-[22px] font-bold text-[var(--label)] placeholder:text-[var(--label-tertiary)] placeholder:font-semibold tracking-tight leading-tight bg-transparent border-0 focus:outline-none"
          />
          <div aria-hidden className="mt-2 mb-2 h-px w-full" style={{ background: dividerLine(color) }} />
          <textarea
            ref={notesRef}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Заметка"
            rows={1}
            readOnly={readonly}
            className="block w-full text-[13px] text-[var(--label-secondary)] placeholder:text-[var(--label-tertiary)] leading-snug bg-transparent border-0 focus:outline-none resize-none overflow-hidden"
          />
        </div>
      </div>

      {/* Card 4 — Place + URL */}
      <div
        className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden"
        style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
      >
        <div className="px-3.5 py-2.5 flex items-start gap-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[52px] shrink-0 pt-1.5">Место</div>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Адрес или ссылка на карту"
            rows={1}
            readOnly={readonly}
            className="flex-1 min-h-8 max-h-20 px-2.5 py-1.5 rounded-[8px] bg-[var(--fill-tertiary)] border border-transparent text-[14px] text-[var(--label)] resize-none leading-snug focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
          {mapsLinks && (
            <button type="button" onClick={() => setNavOpen(true)} aria-label="Открыть в картах"
              className="w-11 h-11 flex items-center justify-center rounded-[8px] text-[var(--accent)] bg-[var(--accent-tint)] active:scale-[0.95] shrink-0">
              <NavigationIcon size={16} strokeWidth={2} />
            </button>
          )}
        </div>
        <div className="border-t border-[var(--separator)]" />
        <div className="px-3.5 py-2.5 flex items-center gap-2">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[52px] shrink-0">Ссылка</div>
          <input
            type="url" inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            readOnly={readonly}
            className="flex-1 h-11 px-2.5 rounded-[8px] bg-[var(--fill-tertiary)] border border-transparent text-[14px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
          {url.trim() && /^https?:\/\//i.test(url.trim()) && (() => {
            const trimmed = url.trim();
            const video = detectVideoConference(trimmed);
            return (
              <a href={trimmed} target="_blank" rel="noopener noreferrer"
                aria-label={video ? `Открыть ${video.label}` : "Открыть ссылку"}
                title={video ? video.label : "Ссылка"}
                className={video
                  ? "h-11 px-2.5 inline-flex items-center gap-1 rounded-[8px] text-[var(--accent)] bg-[var(--accent-tint)] active:scale-[0.95] shrink-0 text-[12px] font-semibold"
                  : "w-11 h-11 flex items-center justify-center rounded-[8px] text-[var(--accent)] bg-[var(--accent-tint)] active:scale-[0.95] shrink-0"}>
                {video ? (<><Video size={14} strokeWidth={2} /><span>{video.label}</span></>) : <LinkIcon size={16} strokeWidth={2} />}
              </a>
            );
          })()}
        </div>
      </div>

      {/* Card 5 — Push notification */}
      {!readonly && (
        <PushOffsetPicker
          value={{ enabled: pushEnabled, offsetMin: pushOffset, at: pushAt }}
          onChange={(next) => { setPushEnabled(next.enabled); setPushOffset(next.offsetMin); setPushAt(next.at); }}
          eventStartIso={eventStartIso}
        />
      )}

      {/* Extra reminders — only when push on + relative mode */}
      {!readonly && pushEnabled && !pushAt && (
        <ExtraOffsetsBlock primary={pushOffset} extras={extraOffsets} onChange={setExtraOffsets} />
      )}

      {/* Card 6 — Repeat */}
      {!readonly && <RepeatPickerRow value={repeat} onChange={setRepeat} />}

      {/* v657 — inline delete row (only when embedded + edit + has delete handler).
          Standalone EventForm shows the trash icon in its header instead. */}
      {bodyOnly && mode === "edit" && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(event)}
          data-testid="event-form-delete-inline"
          className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-[var(--surface-card)] shadow-[var(--shadow-card)] text-[14px] font-semibold text-[var(--system-red)] active:bg-[rgba(255,59,48,0.06)] transition"
        >
          <Trash2 size={16} strokeWidth={2} />
          Удалить событие
        </button>
      )}
    </>
  );

  // ── bodyOnly: render cards inline (no overlay, no header, no save bar) ────
  if (bodyOnly) {
    return (
      <div
        data-testid="event-form-inline"
        className="px-3.5 pt-3 pb-3 space-y-3"
        style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
      >
        {bodyContent}
        {navOpen && mapsLinks && (
          <NavigationPopup links={mapsLinks} onClose={() => setNavOpen(false)} />
        )}
      </div>
    );
  }

  // ── Standalone: full modal chrome for PersonalEventSheet ─────────────────
  return (
    <div
      // STORY audit (user critical): backdrop tap больше не закрывает
      // EventForm. Закрытие только через ✕ кнопку в шапке или явный
      // Сохранить/Удалить.
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
    >
      <div
        data-testid="event-form-sheet"
        // STORY audit: добавили role/aria-modal/aria-label — раньше
        // VoiceOver/TalkBack видели generic group вместо модалки.
        role="dialog"
        aria-modal="true"
        aria-label={mode === "create" ? "Новое событие" : mode === "edit" ? "Редактирование события" : "Событие"}
        className="w-full max-w-lg bg-[var(--surface-grouped)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col lg:max-h-[720px] overflow-hidden border-2"
        style={{
          // STORY audit: height теперь reacts на visualViewport, чтобы
          // iOS keyboard не перекрывала save-bar.
          height: sheetHeight,
          borderColor: frameBorder(color),
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — tinted strip in event colour */}
        <div
          className="flex-shrink-0 px-3.5 pt-3 pb-2 flex items-center gap-2 border-b border-[var(--separator)] transition-colors"
          style={{ background: tintCardBg(color) }}
        >
          <div className="flex-1 text-[16px] font-semibold text-[var(--label)] truncate tracking-tight">
            {mode === "edit" ? "Редактирование" : mode === "view" ? "Событие" : "Новое событие"}
          </div>
          {mode === "edit" && onDelete && (
            <button type="button" onClick={() => onDelete(event)} aria-label="Удалить событие"
              data-testid="event-form-delete"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--system-red)] active:bg-[rgba(255,59,48,0.1)]">
              <Trash2 size={18} strokeWidth={2} />
            </button>
          )}
          {!readonly && <ColorPaletteButton value={color} onChange={setColor} />}
          <button type="button" onClick={handleCloseRequest} aria-label="Закрыть"
            data-testid="event-form-close"
            className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]">
            <XIcon size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-3 px-3.5 pt-3 space-y-3">
          {bodyContent}
        </div>

        {/* Sticky footer — save button (hidden in view mode) */}
        {!readonly && (
          <div
            className="flex-shrink-0 px-3.5 pt-2 border-t border-[var(--separator)] bg-[var(--surface-card)] rounded-b-[20px]"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)" }}
          >
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              data-testid="event-form-save"
              className={`w-full h-11 rounded-[10px] text-[15px] font-semibold transition ${canSave ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)] active:scale-[0.99]" : "bg-[var(--fill-primary)] text-[var(--label-tertiary)]"}`}
            >
              {mode === "edit" ? "Сохранить" : "Создать событие"}
            </button>
          </div>
        )}
      </div>

      {navOpen && mapsLinks && <NavigationPopup links={mapsLinks} onClose={() => setNavOpen(false)} />}
      {closeConfirm && (
        <CloseConfirmPopup
          mode={mode === "edit" ? "edit" : "create"}
          canSave={canSave}
          onSave={() => { setCloseConfirm(false); handleSave(); }}
          onDiscard={() => { setCloseConfirm(false); onClose(); }}
          onKeep={() => setCloseConfirm(false)}
        />
      )}
    </div>
  );
}
