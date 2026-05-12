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
  MapPin,
  Compass,
} from "@babun/shared/icons";
import { pushRecentPlace } from "@babun/shared/local/event-recent-places";
import type {
  Appointment,
  PersonalEventRepeat,
} from "@babun/shared/local/appointments";
import TimeBlock from "@/components/appointment/TimeBlock";
import {
  PushOffsetPicker,
  RepeatPickerRow,
  buildMapsLinks,
  type MapsLinks,
} from "./PersonalEventBlocks";
import EventPresetChips from "./EventPresetChips";
import type { PersonalEventType } from "@babun/shared/local/personal-event-types";
import { PRESET_COLORS } from "@babun/shared/common/utils/colors";
import { useCalendarSettings } from "@/components/layout/DashboardClientLayout";

// v473 — "Весь день" must fit the user's working hours, not the
// 00:00→23:59 calendar range. Falls back to a sensible default if
// the calendar settings haven't been customised.
function hourToTime(h: number): string {
  const safe = Math.max(0, Math.min(24, Math.round(h)));
  if (safe >= 24) return "23:59";
  return `${String(safe).padStart(2, "0")}:00`;
}

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
  const { calendarSettings } = useCalendarSettings();
  const workStartHr =
    calendarSettings.workStartHour ?? calendarSettings.startHour ?? 8;
  const workEndHr =
    calendarSettings.workEndHour ?? calendarSettings.endHour ?? 22;
  const allDayStart = hourToTime(workStartHr);
  const allDayEnd = hourToTime(workEndHr);

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
  // STORY-058 Sprint C — extra reminders beyond the primary offset.
  // event_push_offsets[0] drives the existing PushOffsetPicker; the
  // tail (indices 1+) is what we surface here. Cap at 3 extras so the
  // form stays short (4 total including primary).
  const [extraOffsets, setExtraOffsets] = useState<number[]>(
    appointment.event_push_offsets && appointment.event_push_offsets.length > 1
      ? appointment.event_push_offsets.slice(1)
      : [],
  );
  const [pushAt, setPushAt] = useState<string | null>(
    appointment.event_push_at ?? null,
  );
  const [repeat, setRepeat] = useState<PersonalEventRepeat>(
    appointment.event_repeat ?? NO_REPEAT,
  );

  // v470 — popup для выбора куда открыть навигацию (Google/Apple/Waze).
  // v478 dropped the GPS «Сейчас здесь» button; v480 dropped the
  // «Недавно» recent-places chip row.
  const [navOpen, setNavOpen] = useState(false);

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
    setExtraOffsets(
      appointment.event_push_offsets && appointment.event_push_offsets.length > 1
        ? appointment.event_push_offsets.slice(1)
        : [],
    );
    setPushAt(appointment.event_push_at ?? null);
    setRepeat(appointment.event_repeat ?? NO_REPEAT);
  }, [appointment.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const canSave = title.trim().length > 0;
  const eventStartIso = useMemo(() => `${dateKey}T${timeStart}`, [dateKey, timeStart]);

  // v485 — close confirmation. The X button has felt risky on create:
  // the user fills time / colour / repeat, doesn't type a title, taps
  // X out of habit and loses everything because the «Создать событие»
  // button was disabled (no title). Popup gives an escape hatch.
  const [closeConfirm, setCloseConfirm] = useState(false);
  const dirty =
    mode === "create" &&
    (title.trim().length > 0 ||
      notes.trim().length > 0 ||
      address.trim().length > 0 ||
      url.trim().length > 0 ||
      pushEnabled ||
      repeat.kind !== "none" ||
      color !== DEFAULT_COLOR ||
      allDay);
  const handleCloseRequest = () => {
    if (dirty) setCloseConfirm(true);
    else onClose();
  };

  const buildPayload = (): Appointment => ({
    ...appointment,
    date: dateKey,
    time_start: allDay ? allDayStart : timeStart,
    time_end: allDay ? allDayEnd : timeEnd,
    comment: title.trim(),
    event_notes: notes.trim(),
    color_override: color,
    address: address.trim(),
    event_url: url.trim(),
    event_all_day: allDay,
    event_push_enabled: pushEnabled,
    // Primary offset (when not absolute) goes first; extras follow,
    // de-duplicated and sorted ascending so older saves load in the
    // same visual order. Absolute mode (`pushAt`) ignores extras —
    // there's no useful semantic for «at exact time + relative offsets».
    event_push_offsets:
      pushEnabled && !pushAt
        ? Array.from(
            new Set([
              ...(pushOffset !== null ? [pushOffset] : []),
              ...extraOffsets,
            ]),
          ).sort((a, b) => a - b)
        : [],
    event_push_at: pushEnabled && pushAt ? pushAt : null,
    event_repeat: repeat,
    kind: "event",
    updated_at: new Date().toISOString(),
  });

  if (!open) return null;

  const mapsLinks = buildMapsLinks(address);

  return (
    <div
      // v485 — backdrop taps route through the same close handler so
      // a stray tap outside the sheet also surfaces the «Сохранить /
      // Не сохранять» popup when create-mode form is dirty.
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={handleCloseRequest}
    >
      <div
        // STORY-056 — cap height at 720 px on lg+ for proper desktop
        // dialog feel (mobile keeps 92 vh).
        // v484 — revert v483 whole-sheet tint. Body bg back to the
        // neutral grouped surface (looks clean). The event colour now
        // lives on the outer frame (border in tint) and the header
        // strip — that's enough to telegraph the chosen colour without
        // washing the entire sheet.
        className="w-full max-w-lg bg-[var(--surface-grouped)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col lg:max-h-[720px] overflow-hidden border-2"
        style={{
          height: "92vh",
          borderColor: frameBorder(color),
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — v484 tinted strip in the event colour. Sits inside
            the bordered frame; cards / body underneath stay white. */}
        <div
          className="flex-shrink-0 px-3.5 pt-3 pb-2 flex items-center gap-2 border-b border-[var(--separator)] transition-colors"
          style={{ background: tintCardBg(color) }}
        >
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
          {/* v483 — palette button lives in the header (next to X).
              Tapping it opens the same 14-colour modal as before. */}
          <ColorPaletteButton value={color} onChange={setColor} />
          <button
            type="button"
            onClick={handleCloseRequest}
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
                          setTimeStart(allDayStart);
                          setTimeEnd(allDayEnd);
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
                setTimeStart(allDayStart);
                setTimeEnd(allDayEnd);
              } else {
                // v468 fix — explicitly switch all-day OFF when picking
                // a non-all-day preset, otherwise the toggle stays ON
                // from the previous «Выходной» pick. Also restore a
                // sane start time if we're coming out of all-day (an
                // all-day start equal to workStart isn't what the user
                // means when they pick «Обед»).
                setAllDay(false);
                const baseStart =
                  allDay || timeStart === "00:00" || timeStart === allDayStart
                    ? "10:00"
                    : timeStart;
                setTimeStart(baseStart);
                const [h, m] = baseStart.split(":").map(Number);
                const totalMin = h * 60 + m + preset.defaultDuration;
                const eh = Math.floor(totalMin / 60) % 24;
                const em = totalMin % 60;
                setTimeEnd(
                  `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`,
                );
              }
            }}
          />

          {/* Card 2 — Hero title + notes. v483 — the in-card palette
              swatch moved to the sheet header (next to the X), and
              the tint moved to the whole sheet base. The card is now
              a clean white surface so the title / notes read cleanly
              against the coloured backdrop. */}
          <div
            className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden relative"
            style={{
              WebkitUserSelect: "text",
              userSelect: "text",
            } as React.CSSProperties}
          >
            <div className="px-4 pt-3 pb-3">
              <input
                // v476 — removed autoFocus on create. iOS popped the
                // keyboard the instant the sheet appeared, which hid
                // the time / preset rows the user wanted to tap first.
                // They tap the title field themselves when they're
                // ready to type.
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Название"
                className="w-full text-[22px] font-bold text-[var(--label)] placeholder:text-[var(--label-tertiary)] placeholder:font-semibold tracking-tight leading-tight bg-transparent border-0 focus:outline-none"
              />
              {/* v481 — hairline divider between title and notes.
                  Sits at ~10% of the event colour so it always reads
                  against the tinted card bg without looking heavy. */}
              <div
                aria-hidden
                className="mt-2 mb-2 h-px w-full"
                style={{ background: divider(color) }}
              />
              <textarea
                ref={notesRef}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Заметка"
                rows={1}
                className="block w-full text-[13px] text-[var(--label-secondary)] placeholder:text-[var(--label-tertiary)] leading-snug bg-transparent border-0 focus:outline-none resize-none overflow-hidden"
              />
            </div>
          </div>

          {/* Card 3 — Place + URL. v470 — accepts free-text address OR a
              maps URL (Google / Apple / Waze share link). Navigation
              button opens a popup with «Где открыть?» — Google Maps /
              Apple Maps / Waze. Recent places chips above input. */}
          <div
            className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden"
            style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
          >
            {/* v480 — «Недавно» recent-places chip row removed. User
                didn't want autocomplete from past addresses cluttering
                the place card. */}
            <div className="px-3.5 py-2.5 flex items-start gap-2">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] w-[52px] shrink-0 pt-1.5">
                Место
              </div>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Адрес или ссылка на карту"
                rows={1}
                className="flex-1 min-h-8 max-h-20 px-2.5 py-1.5 rounded-[8px] bg-[var(--fill-tertiary)] border border-transparent text-[14px] text-[var(--label)] resize-none leading-snug focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />
              {/* v478 — GPS «Сейчас здесь» button removed. Personal
                  events don't carry the user's geo, so the icon was
                  dead weight. */}
              {mapsLinks && (
                <button
                  type="button"
                  onClick={() => setNavOpen(true)}
                  aria-label="Открыть в картах"
                  className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[var(--accent)] bg-[var(--accent-tint)] active:scale-[0.95] shrink-0"
                >
                  <NavigationIcon size={14} strokeWidth={2} />
                </button>
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

          {/* STORY-058 Sprint C — extra reminders. Only shown when push
              is enabled AND in relative mode (absolute «В точное время»
              has no useful semantic for «+ relative offsets»). Cap at
              3 extras (4 total reminders including primary) to keep
              the form short. */}
          {pushEnabled && !pushAt && (
            <ExtraOffsetsBlock
              primary={pushOffset}
              extras={extraOffsets}
              onChange={setExtraOffsets}
            />
          )}

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
              const payload = buildPayload();
              if (payload.address) pushRecentPlace(payload.address);
              onSave(payload);
            }}
            disabled={!canSave}
            className={`w-full h-11 rounded-[10px] text-[15px] font-semibold transition ${canSave ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)] active:scale-[0.99]" : "bg-[var(--fill-primary)] text-[var(--label-tertiary)]"}`}
          >
            {mode === "edit" ? "Сохранить" : "Создать событие"}
          </button>
        </div>
      </div>
      {navOpen && mapsLinks && (
        <NavigationPopup
          links={mapsLinks}
          onClose={() => setNavOpen(false)}
        />
      )}
      {/* v485 — Сохранить / Не сохранять prompt when the user taps X
          on a dirty create-mode form. «Сохранить» bypasses the title
          requirement and saves whatever the form has (so a quick
          event with just a time / colour can be kept). */}
      {closeConfirm && (
        <CloseConfirmPopup
          onSave={() => {
            setCloseConfirm(false);
            const payload = buildPayload();
            if (payload.address) pushRecentPlace(payload.address);
            onSave(payload);
          }}
          onDiscard={() => {
            setCloseConfirm(false);
            onClose();
          }}
          onKeep={() => setCloseConfirm(false)}
        />
      )}
    </div>
  );
}

// v485 — close-with-unsaved-changes confirm popup. iOS-style action
// sheet: Сохранить (default accent), Не сохранять (destructive red),
// Отмена (cancel — keeps the sheet open).
function CloseConfirmPopup({
  onSave,
  onDiscard,
  onKeep,
}: {
  onSave: () => void;
  onDiscard: () => void;
  onKeep: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onKeep();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onKeep]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-6"
      onClick={onKeep}
    >
      <div
        className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] p-5 w-full max-w-[300px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15px] font-semibold text-[var(--label)] text-center">
          Сохранить событие?
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] text-center mt-1.5">
          Без названия событие сохранится пустым.
        </div>
        <button
          type="button"
          onClick={onSave}
          className="w-full mt-4 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:scale-[0.98] transition"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="w-full mt-2 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] font-semibold text-[var(--system-red)] active:bg-[var(--fill-quaternary)] transition"
        >
          Не сохранять
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="w-full mt-2 h-10 rounded-[10px] text-[14px] font-medium text-[var(--label-secondary)] active:opacity-70 transition"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

// v470 — «Где открыть?» popup with Google / Apple / Waze choices.
// Single «Открыть» if input was already a maps URL (we can't reliably
// re-route a third-party share link to a different provider).
function NavigationPopup({
  links,
  onClose,
}: {
  links: MapsLinks;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
    onClose();
  };

  if (links.isUrl) {
    return (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-6"
        onClick={onClose}
      >
        <div
          className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] p-5 w-full max-w-[300px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[15px] font-semibold text-[var(--label)] text-center mb-3">
            Открыть ссылку
          </div>
          <div className="text-[12px] text-[var(--label-secondary)] text-center mb-4">
            Это ссылка из карт. Откроется в исходном приложении.
          </div>
          <button
            type="button"
            onClick={() => open(links.google)}
            className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:scale-[0.98] transition"
          >
            Открыть
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full mt-2 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition"
          >
            Отмена
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-6"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] p-5 w-full max-w-[300px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15px] font-semibold text-[var(--label)] text-center mb-4">
          Где открыть?
        </div>
        <div className="space-y-2">
          <NavOption
            label="Google Maps"
            tone="bg-[#EA4335]"
            Icon={MapPin}
            onClick={() => open(links.google)}
          />
          <NavOption
            label="Apple Maps"
            tone="bg-[#007AFF]"
            Icon={Compass}
            onClick={() => open(links.apple)}
          />
          <NavOption
            label="Waze"
            tone="bg-[#33CCFF]"
            Icon={NavigationIcon}
            onClick={() => open(links.waze)}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function NavOption({
  label,
  tone,
  Icon,
  onClick,
}: {
  label: string;
  tone: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 h-12 px-3 rounded-[12px] bg-[var(--fill-quaternary)] active:bg-[var(--fill-tertiary)] transition text-left"
    >
      <span
        className={`w-8 h-8 rounded-[8px] ${tone} text-white flex items-center justify-center shrink-0`}
      >
        <Icon size={18} strokeWidth={2.2} />
      </span>
      <span className="text-[14px] font-semibold text-[var(--label)]">
        {label}
      </span>
    </button>
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

// v484 — solid-ish frame border around the whole sheet. ~50 % alpha
// reads as a clear colour rim against the page backdrop without
// looking neon. Falls back to a neutral border on bad hex.
function frameBorder(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "var(--separator-opaque)";
  return `${hex}80`;
}

// v481 — hairline between title and notes inside the tinted hero
// card. Same hex as the event colour but at ~18 % alpha so it reads
// against the ~14 % bg without looking heavy.
function divider(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "rgba(60,60,67,0.12)";
  return `${hex}2E`;
}

// STORY-058 Sprint C — extra-reminders block. Sits below
// PushOffsetPicker. Renders existing extras as removable chips and a
// quick-add row with the most-used relative offsets. Cap at 3 extras
// (4 reminders total counting primary) to keep the form short.
const QUICK_ADD_OFFSETS: { min: number; label: string }[] = [
  { min: 5, label: "5 мин" },
  { min: 15, label: "15 мин" },
  { min: 30, label: "30 мин" },
  { min: 60, label: "1 час" },
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
  primary,
  extras,
  onChange,
}: {
  primary: number | null;
  extras: number[];
  onChange: (next: number[]) => void;
}) {
  const used = new Set([
    ...(primary !== null ? [primary] : []),
    ...extras,
  ]);
  const canAddMore = extras.length < EXTRAS_CAP;
  const addOffset = (m: number) => {
    if (used.has(m) || !canAddMore) return;
    onChange([...extras, m]);
  };
  const removeOffset = (m: number) => {
    onChange(extras.filter((x) => x !== m));
  };

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-3.5 pt-3 pb-1 flex items-baseline justify-between">
        <div className="text-[12px] uppercase tracking-wider font-semibold text-[var(--label-secondary)]">
          Дополнительно
        </div>
        <div className="text-[11px] text-[var(--label-tertiary)]">
          {extras.length}/{EXTRAS_CAP}
        </div>
      </div>
      {extras.length > 0 && (
        <div className="px-3.5 pb-2 flex flex-wrap gap-1.5">
          {extras.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => removeOffset(m)}
              className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1.5 rounded-full text-[12px] font-semibold bg-[var(--accent-tint)] text-[var(--accent)] active:scale-[0.96] transition"
            >
              {formatOffsetChip(m)}
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[10px] leading-none">
                ×
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="px-3.5 pb-3 flex flex-wrap gap-1.5">
        {QUICK_ADD_OFFSETS.map((p) => {
          const disabled = used.has(p.min) || !canAddMore;
          return (
            <button
              key={p.min}
              type="button"
              onClick={() => addOffset(p.min)}
              disabled={disabled}
              className={`inline-flex items-center h-7 px-2.5 rounded-full text-[12px] font-medium border transition ${
                disabled
                  ? "border-transparent bg-[var(--fill-quaternary)] text-[var(--label-tertiary)]"
                  : "border-[var(--separator)] text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
              }`}
            >
              + {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Palette icon button anchored to the top-right of the title card.
// v469 — popup is a centred modal instead of an inline absolute
// popover. The hero card has `overflow-hidden` (needed for the tinted
// background corners), which clipped the second row of the 7×2 grid
// and made it look like only 7 colours existed. A fullscreen-overlay
// modal sits above the sheet's stacking context and has room for all
// 14 swatches comfortably.
// v483 — palette button moved out of the title card into the sheet
// header (next to the X close button). The whole sheet base is now
// tinted with the event colour, so the user sees their choice apply
// to the entire surface at once — the title card no longer needs its
// own swatch.
function ColorPaletteButton({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Цвет события"
        className="w-8 h-8 flex items-center justify-center rounded-lg active:bg-[var(--fill-quaternary)] transition"
        style={{ color: value }}
      >
        <Palette size={16} strokeWidth={2} />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] p-5 w-full max-w-[320px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-semibold text-[var(--label)] text-center mb-4">
              Цвет события
            </div>
            <div className="grid grid-cols-7 gap-2.5">
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
                    className={`w-9 h-9 rounded-full border-2 transition active:scale-[0.92] ${
                      active
                        ? "border-[var(--label)] ring-2 ring-offset-2 ring-[var(--label)]/20"
                        : "border-transparent"
                    }`}
                    style={{ background: c.value }}
                  />
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full mt-5 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </>
  );
}
