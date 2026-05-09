"use client";

// v454 — full redesign per user feedback. Notable shifts vs v453:
//
//   • Title + notes: borderless hero block — title at 22 px / 700,
//     hairline, slim notes single-line input (textarea expands).
//   • Push «Своё»: absolute datetime picker (`event_push_at`) —
//     user dials the precise moment the notification fires, not a
//     relative offset.
//   • Repeat: extended presets (weekdays, biweekly) + «Завершить»
//     date so the rule has an end.
//   • Type tiles: compact 4-column grid, ~60 px tall, icon 22 px.
//   • iOS callout / text-selection on sheet chrome disabled
//     (`select-none` + `WebkitTouchCallout: none` on outer card),
//     inputs / textareas keep `select-text`.
//
// Sub-blocks: PersonalEventBlocks (push picker, repeat picker,
// color swatch, icon registry, Apple Maps deep-link helper).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Trash2,
  X as XIcon,
  Navigation as NavigationIcon,
  Link as LinkIcon,
  Palette,
} from "@babun/shared/icons";
import type {
  Appointment,
  PersonalEventRepeat,
} from "@babun/shared/local/appointments";
import TimeBlock from "@/components/appointment/TimeBlock";
import {
  PushOffsetPicker,
  RepeatPickerRow,
  buildMapsUrl,
} from "./PersonalEventBlocks";
import EventPresetChips from "./EventPresetChips";
import type { PersonalEventType } from "@babun/shared/local/personal-event-types";
import { PRESET_COLORS } from "@babun/shared/common/utils/colors";

export type PersonalEventSheetMode = "create" | "edit";

interface PersonalEventSheetProps {
  open: boolean;
  onClose: () => void;
  mode: PersonalEventSheetMode;
  appointment: Appointment;
  onSave: (apt: Appointment) => void;
  onDelete?: (apt: Appointment) => void;
}

const DEFAULT_COLOR = "#007AFF";
const NO_REPEAT: PersonalEventRepeat = { kind: "none" };

export default function PersonalEventSheet({
  open,
  onClose,
  mode,
  appointment,
  onSave,
  onDelete,
}: PersonalEventSheetProps) {
  const [dateKey, setDateKey] = useState(appointment.date);
  const [timeStart, setTimeStart] = useState(appointment.time_start);
  const [timeEnd, setTimeEnd] = useState(appointment.time_end);
  const [allDay, setAllDay] = useState(appointment.event_all_day ?? false);
  const [title, setTitle] = useState(appointment.comment ?? "");
  const [notes, setNotes] = useState(appointment.event_notes ?? "");
  const [color, setColor] = useState<string>(
    appointment.color_override ?? DEFAULT_COLOR,
  );
  const [address, setAddress] = useState(appointment.address ?? "");
  const [url, setUrl] = useState(appointment.event_url ?? "");
  const [pushEnabled, setPushEnabled] = useState(
    appointment.event_push_enabled ?? false,
  );
  const [pushOffset, setPushOffset] = useState<number | null>(
    appointment.event_push_offsets && appointment.event_push_offsets.length > 0
      ? appointment.event_push_offsets[0]
      : null,
  );
  const [pushAt, setPushAt] = useState<string | null>(
    appointment.event_push_at ?? null,
  );
  const [repeat, setRepeat] = useState<PersonalEventRepeat>(
    appointment.event_repeat ?? NO_REPEAT,
  );

  // Auto-grow notes textarea
  const notesRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [notes, open]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDateKey(appointment.date);
    setTimeStart(appointment.time_start);
    setTimeEnd(appointment.time_end);
    setAllDay(appointment.event_all_day ?? false);
    setTitle(appointment.comment ?? "");
    setNotes(appointment.event_notes ?? "");
    setColor(appointment.color_override ?? DEFAULT_COLOR);
    setAddress(appointment.address ?? "");
    setUrl(appointment.event_url ?? "");
    setPushEnabled(appointment.event_push_enabled ?? false);
    setPushOffset(
      appointment.event_push_offsets && appointment.event_push_offsets.length > 0
        ? appointment.event_push_offsets[0]
        : null,
    );
    setPushAt(appointment.event_push_at ?? null);
    setRepeat(appointment.event_repeat ?? NO_REPEAT);
  }, [appointment.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const canSave = title.trim().length > 0;
  const eventStartIso = useMemo(() => `${dateKey}T${timeStart}`, [dateKey, timeStart]);

  const buildPayload = (): Appointment => ({
    ...appointment,
    date: dateKey,
    time_start: allDay ? "00:00" : timeStart,
    time_end: allDay ? "23:59" : timeEnd,
    comment: title.trim(),
    event_notes: notes.trim(),
    color_override: color,
    address: address.trim(),
    event_url: url.trim(),
    event_all_day: allDay,
    event_push_enabled: pushEnabled,
    event_push_offsets: pushEnabled && pushOffset !== null && !pushAt ? [pushOffset] : [],
    event_push_at: pushEnabled && pushAt ? pushAt : null,
    event_repeat: repeat,
    kind: "event",
    updated_at: new Date().toISOString(),
  });

  if (!open) return null;

  const mapsHref = buildMapsUrl(address);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        // STORY-056 — cap height at 720 px on lg+ for proper desktop
        // dialog feel (mobile keeps 92 vh).
        className="w-full max-w-lg bg-[var(--surface-grouped)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col lg:max-h-[720px]"
        style={{
          height: "92vh",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-3.5 pt-3 pb-2 flex items-center gap-2 bg-[var(--surface-card)] rounded-t-[20px] border-b border-[var(--separator)]">
          <div className="flex-1 text-[16px] font-semibold text-[var(--label)] truncate tracking-tight">
            {mode === "edit" ? "Редактирование" : "Новое событие"}
          </div>
          {mode === "edit" && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(appointment)}
              aria-label="Удалить событие"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--system-red)] active:bg-[rgba(255,59,48,0.1)]"
            >
              <Trash2 size={16} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <XIcon size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-3 px-3.5 pt-3 space-y-3">
          {/* Card 1 — Time block at top (per user spec). Inline
              «Весь день» toggle slots into the header row's right
              edge via TimeBlock's `rightSlot` prop. When ON the
              wheel pickers are hidden and we render the date alone. */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            {!allDay ? (
              <TimeBlock
                date={dateKey}
                timeStart={timeStart}
                timeEnd={timeEnd}
                onChange={({ date: d, timeStart: s, timeEnd: e }) => {
                  setDateKey(d);
                  setTimeStart(s);
                  setTimeEnd(e);
                }}
                rightSlot={
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
                      Весь день
                    </span>
                    <ToggleSlim
                      checked={allDay}
                      onChange={(v) => {
                        setAllDay(v);
                        if (v) {
                          setTimeStart("00:00");
                          setTimeEnd("23:59");
                        }
                      }}
                      ariaLabel="Весь день"
                    />
                  </div>
                }
              />
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
                <span className="text-[var(--label-tertiary)]">⏰</span>
                <span className="font-semibold text-[var(--label)]">
                  {formatDateRu(dateKey)}
                </span>
                <span className="text-[var(--label-secondary)]">· весь день</span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
                    Весь день
                  </span>
                  <ToggleSlim
                    checked={allDay}
                    onChange={(v) => setAllDay(v)}
                    ariaLabel="Весь день"
                  />
                </span>
              </div>
            )}
          </div>

          {/* STORY-058 Sprint A — quick-apply chips between time and
              title. Tap a chip → fills label + color + duration + (if
              all-day preset) all-day toggle. Reuses
              `personal-event-types` (CRUD at
              /dashboard/settings/calendar/event-types). */}
          <EventPresetChips
            onPick={(preset: PersonalEventType) => {
              setTitle(preset.label);
              setColor(preset.color);
              if (preset.allDay) {
                setAllDay(true);
                setTimeStart("00:00");
                setTimeEnd("23:59");
              } else {
                const [h, m] = timeStart.split(":").map(Number);
                const totalMin = h * 60 + m + preset.defaultDuration;
                const eh = Math.floor(totalMin / 60) % 24;
                const em = totalMin % 60;
                setTimeEnd(
                  `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`,
                );
              }
            }}
          />

          {/* Card 2 — Hero title + multi-line notes. v457b — whole
              card is tinted with the event color (~14% alpha); a
              palette button in the top-right corner opens the color
              picker. Replaces the previous left-edge stripe + header
              swatch combo. */}
          <div
            className="rounded-2xl shadow-[var(--shadow-card)] overflow-hidden relative transition-colors"
            style={{
              background: tintCardBg(color),
              WebkitUserSelect: "text",
              userSelect: "text",
            } as React.CSSProperties}
          >
            <ColorPaletteButton value={color} onChange={setColor} />
            <div className="pl-4 pr-12 pt-3 pb-2.5">
              <input
                autoFocus={mode === "create"}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Название"
                className="w-full text-[24px] font-bold text-[var(--label)] placeholder:text-[var(--label-tertiary)] placeholder:font-semibold tracking-tight leading-tight bg-transparent border-0 focus:outline-none"
              />
              <textarea
                ref={notesRef}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Заметка"
                rows={2}
                className="block w-full mt-1 text-[14px] text-[var(--label-secondary)] placeholder:text-[var(--label-tertiary)] leading-snug bg-transparent border-0 focus:outline-none resize-none overflow-hidden"
              />
            </div>
          </div>

          {/* Card 3 — Place + URL */}
          <div
            className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden"
            style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
          >
            <div className="px-3.5 py-2.5 flex items-center gap-2">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[52px] shrink-0">
                Место
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Адрес"
                className="flex-1 h-8 px-2.5 rounded-[8px] bg-[var(--fill-tertiary)] border border-transparent text-[14px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />
              {mapsHref && (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Открыть в картах"
                  className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[var(--accent)] bg-[var(--accent-tint)] active:scale-[0.95] shrink-0"
                >
                  <NavigationIcon size={14} strokeWidth={2} />
                </a>
              )}
            </div>
            <div className="border-t border-[var(--separator)]" />
            <div className="px-3.5 py-2.5 flex items-center gap-2">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[52px] shrink-0">
                Ссылка
              </div>
              <input
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
                className="flex-1 h-8 px-2.5 rounded-[8px] bg-[var(--fill-tertiary)] border border-transparent text-[14px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />
              {url.trim() && /^https?:\/\//i.test(url.trim()) && (
                <a
                  href={url.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Открыть ссылку"
                  className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[var(--accent)] bg-[var(--accent-tint)] active:scale-[0.95] shrink-0"
                >
                  <LinkIcon size={14} strokeWidth={2} />
                </a>
              )}
            </div>
          </div>

          {/* Card 4 — Push */}
          <PushOffsetPicker
            value={{ enabled: pushEnabled, offsetMin: pushOffset, at: pushAt }}
            onChange={(next) => {
              setPushEnabled(next.enabled);
              setPushOffset(next.offsetMin);
              setPushAt(next.at);
            }}
            eventStartIso={eventStartIso}
          />

          {/* Card 5 — Repeat */}
          <RepeatPickerRow value={repeat} onChange={setRepeat} />
        </div>

        {/* Sticky save */}
        <div
          className="flex-shrink-0 px-3.5 pt-2 border-t border-[var(--separator)] bg-[var(--surface-card)] rounded-b-[20px]"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)" }}
        >
          <button
            type="button"
            onClick={() => {
              if (!canSave) return;
              onSave(buildPayload());
            }}
            disabled={!canSave}
            className={`w-full h-11 rounded-[10px] text-[15px] font-semibold transition ${canSave ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)] active:scale-[0.99]" : "bg-[var(--fill-primary)] text-[var(--label-tertiary)]"}`}
          >
            {mode === "edit" ? "Сохранить" : "Создать событие"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDateRu(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

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

// v457b — soft tint for the title/notes card. The user picks a hex
// from the 14-colour iOS palette; we render the card with that hex
// at ~14 % alpha so the background is clearly tinted but text stays
// fully legible. Falls back to the surface colour for invalid hex.
function tintCardBg(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "var(--surface-card)";
  // 0x24 = 36 / 255 ≈ 14 % alpha — the same value used on iOS chip
  // backgrounds throughout the app.
  return `${hex}24`;
}

// Palette icon button anchored to the top-right of the title card.
// Tapping it opens an inline popover with the 14-colour palette;
// clicking outside or pressing Escape closes it. Replaces the
// header colour swatch from earlier versions.
function ColorPaletteButton({
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
    <div ref={ref} className="absolute top-2 right-2 z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Цвет события"
        className="w-8 h-8 rounded-full bg-white/70 backdrop-blur flex items-center justify-center shadow-sm active:scale-[0.95] transition"
        style={{ color: value }}
      >
        <Palette size={16} strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 bg-[var(--surface-card)] border border-[var(--separator)] shadow-[var(--shadow-card)] rounded-2xl p-2.5 w-[252px]">
          <div className="grid grid-cols-7 gap-1.5">
            {PRESET_COLORS.map((c) => {
              const active = value.toLowerCase() === c.value.toLowerCase();
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
