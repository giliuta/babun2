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

import { useEffect, useMemo, useState } from "react";
import {
  Trash2,
  X as XIcon,
  Navigation as NavigationIcon,
  Link as LinkIcon,
  Plus as PlusIcon,
} from "@babun/shared/icons";
import type {
  Appointment,
  PersonalEventRepeat,
} from "@babun/shared/local/appointments";
import { usePersonalEventTypes } from "@/hooks/usePersonalEventTypes";
import TimeBlock from "@/components/appointment/TimeBlock";
import {
  ColorSwatchPopover,
  IconBadge,
  PushOffsetPicker,
  RepeatPickerRow,
  buildMapsUrl,
} from "./PersonalEventBlocks";
import type { PersonalEventType } from "@babun/shared/local/personal-event-types";

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
  const { types } = usePersonalEventTypes();

  const [dateKey, setDateKey] = useState(appointment.date);
  const [timeStart, setTimeStart] = useState(appointment.time_start);
  const [timeEnd, setTimeEnd] = useState(appointment.time_end);
  const [allDay, setAllDay] = useState(appointment.event_all_day ?? false);
  const [title, setTitle] = useState(appointment.comment ?? "");
  const [notes, setNotes] = useState(appointment.event_notes ?? "");
  const [eventTypeId, setEventTypeId] = useState<string | null>(
    appointment.event_type_id ?? null,
  );
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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDateKey(appointment.date);
    setTimeStart(appointment.time_start);
    setTimeEnd(appointment.time_end);
    setAllDay(appointment.event_all_day ?? false);
    setTitle(appointment.comment ?? "");
    setNotes(appointment.event_notes ?? "");
    setEventTypeId(appointment.event_type_id ?? null);
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

  const onPickType = (t: PersonalEventType) => {
    setEventTypeId(t.id);
    if (!title.trim()) setTitle(t.label);
    if (color === DEFAULT_COLOR) setColor(t.color);
    if (t.allDay) {
      setAllDay(true);
      setTimeStart("00:00");
      setTimeEnd("23:59");
    } else {
      setAllDay(false);
      const [h, m] = timeStart.split(":").map(Number);
      const endMin = Math.min(23 * 60 + 59, h * 60 + m + t.defaultDuration);
      const eh = Math.floor(endMin / 60);
      const em = endMin % 60;
      setTimeEnd(
        `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`,
      );
    }
  };

  const selectedType = useMemo(
    () => types.find((t) => t.id === eventTypeId) ?? null,
    [types, eventTypeId],
  );

  const canSave = title.trim().length > 0;
  const eventStartIso = useMemo(() => `${dateKey}T${timeStart}`, [dateKey, timeStart]);

  const buildPayload = (): Appointment => ({
    ...appointment,
    date: dateKey,
    time_start: allDay ? "00:00" : timeStart,
    time_end: allDay ? "23:59" : timeEnd,
    comment: title.trim(),
    event_notes: notes.trim(),
    event_type_id: eventTypeId,
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
        className="w-full max-w-lg bg-[var(--surface-grouped)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col"
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
          <ColorSwatchPopover value={color} onChange={setColor} />
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
          {/* Card 1 — Hero title + slim notes */}
          <div
            className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden"
            style={{ WebkitUserSelect: "text", userSelect: "text" } as React.CSSProperties}
          >
            <input
              autoFocus={mode === "create"}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название"
              className="w-full px-4 py-3 text-[22px] font-bold text-[var(--label)] placeholder:text-[var(--label-tertiary)] placeholder:font-semibold tracking-tight bg-transparent border-0 focus:outline-none"
            />
            <div className="border-t border-[var(--separator)]" />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Заметка"
              className="w-full px-4 py-2.5 text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] bg-transparent border-0 focus:outline-none"
            />
          </div>

          {/* Card 2 — Time + All-day */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <div className="text-[14px] font-semibold text-[var(--label)]">
                Весь день
              </div>
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
            {!allDay && (
              <div className="border-t border-[var(--separator)]">
                <TimeBlock
                  date={dateKey}
                  timeStart={timeStart}
                  timeEnd={timeEnd}
                  onChange={({ date: d, timeStart: s, timeEnd: e }) => {
                    setDateKey(d);
                    setTimeStart(s);
                    setTimeEnd(e);
                  }}
                />
              </div>
            )}
            {allDay && (
              <div className="border-t border-[var(--separator)] px-3.5 py-2 text-[12px] text-[var(--label-secondary)]">
                {formatDateRu(dateKey)}
              </div>
            )}
          </div>

          {/* Type tiles — compact 4-column grid */}
          <div>
            <div className="px-1 mb-1.5 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Тип события
              </div>
              <a
                href="/dashboard/settings/calendar/event-types"
                className="text-[var(--accent)] text-[12px] font-semibold"
              >
                Настроить
              </a>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {types.map((t) => {
                const active = eventTypeId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onPickType(t)}
                    className="h-[68px] rounded-[12px] border bg-[var(--surface-card)] text-[11px] font-semibold text-[var(--label)] active:scale-[0.97] flex flex-col items-center justify-center gap-1 transition px-1"
                    style={{
                      borderColor: active ? t.color : "var(--separator)",
                      background: active ? `${t.color}14` : undefined,
                    }}
                  >
                    <IconBadge
                      icon={t.icon}
                      color={t.color}
                      size={14}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="truncate max-w-full leading-tight">{t.label}</span>
                  </button>
                );
              })}
              <a
                href="/dashboard/settings/calendar/event-types"
                aria-label="Добавить тип"
                className="h-[68px] rounded-[12px] border border-dashed border-[var(--separator)] bg-[var(--surface-card)] text-[11px] font-semibold text-[var(--label-secondary)] active:scale-[0.97] flex flex-col items-center justify-center gap-1 transition"
              >
                <div className="w-6 h-6 rounded-full bg-[var(--fill-tertiary)] flex items-center justify-center text-[var(--label-secondary)]">
                  <PlusIcon size={12} strokeWidth={2.5} />
                </div>
                <span>Новый</span>
              </a>
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

          {selectedType && (
            <div className="px-1 text-[10px] text-[var(--label-tertiary)] text-center">
              Тип: {selectedType.label}
            </div>
          )}
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
