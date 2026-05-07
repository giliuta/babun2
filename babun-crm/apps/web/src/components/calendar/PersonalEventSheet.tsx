"use client";

// Personal-calendar event sheet. iOS-Reminders-inspired layout for
// the personal tab (master_id set, team_id null). Layout, top to bot:
//   • Header: ● color swatch · 🗑 delete (edit-only) · ✕ close
//   • TimeBlock (date + time-range + duration chip)         ← first
//   • Title (autofocus, single line)
//   • Notes (textarea, multi-line)
//   • Тип события: configurable tile grid (PersonalEventType[])
//   • Место: address text + Навигация button
//   • URL
//   • Push: toggle + chips (5/15/30 min, 1h, 24h) + custom min input
// Sticky footer: «Создать событие» / «Сохранить» (single full-width).
//
// CLAUDE.md notes:
//   • RU in UI, EN in code.
//   • Total file size kept under 400 lines via PersonalEventBlocks.tsx.

import { useEffect, useMemo, useState } from "react";
import {
  Trash2,
  X as XIcon,
  Navigation as NavigationIcon,
  Link as LinkIcon,
  StickyNote,
} from "@babun/shared/icons";
import type { Appointment } from "@babun/shared/local/appointments";
import { usePersonalEventTypes } from "@/hooks/usePersonalEventTypes";
import TimeBlock from "@/components/appointment/TimeBlock";
import {
  ColorSwatchPopover,
  IconBadge,
  PushOffsetPicker,
} from "./PersonalEventBlocks";
import type { PersonalEventType } from "@babun/shared/local/personal-event-types";

export type PersonalEventSheetMode = "create" | "edit";

interface PersonalEventSheetProps {
  open: boolean;
  onClose: () => void;
  mode: PersonalEventSheetMode;
  /** Seed for create mode (date + initial time slot from tap), or full
   *  record for edit. Always carries kind="event" + master_id. */
  appointment: Appointment;
  onSave: (apt: Appointment) => void;
  onDelete?: (apt: Appointment) => void;
}

const DEFAULT_COLOR = "#007AFF"; // iOS system blue

export default function PersonalEventSheet({
  open,
  onClose,
  mode,
  appointment,
  onSave,
  onDelete,
}: PersonalEventSheetProps) {
  const { types } = usePersonalEventTypes();

  // ─── State ───────────────────────────────────────────────────────
  const [dateKey, setDateKey] = useState(appointment.date);
  const [timeStart, setTimeStart] = useState(appointment.time_start);
  const [timeEnd, setTimeEnd] = useState(appointment.time_end);
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
  const [pushOffsets, setPushOffsets] = useState<number[]>(
    appointment.event_push_offsets ?? [],
  );

  // Re-seed local state when a different appointment is opened
  // (parent reuses the sheet across multiple events). The setState
  // burst inside this effect is intentional — seeding form state from
  // an identifying prop is the canonical use case for which the lint
  // rule is overly strict.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDateKey(appointment.date);
    setTimeStart(appointment.time_start);
    setTimeEnd(appointment.time_end);
    setTitle(appointment.comment ?? "");
    setNotes(appointment.event_notes ?? "");
    setEventTypeId(appointment.event_type_id ?? null);
    setColor(appointment.color_override ?? DEFAULT_COLOR);
    setAddress(appointment.address ?? "");
    setUrl(appointment.event_url ?? "");
    setPushEnabled(appointment.event_push_enabled ?? false);
    setPushOffsets(appointment.event_push_offsets ?? []);
  }, [appointment.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // Picking a type seeds the title (if blank), color (if untouched),
  // and end-of-time (clamping to the day). Preserve the user's
  // intent: don't blow away a non-empty title or a colour they
  // already deliberately chose.
  const onPickType = (t: PersonalEventType) => {
    setEventTypeId(t.id);
    if (!title.trim()) setTitle(t.label);
    if (color === DEFAULT_COLOR) setColor(t.color);
    if (t.allDay) {
      setTimeStart("00:00");
      setTimeEnd("23:59");
    } else {
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

  const buildPayload = (): Appointment => ({
    ...appointment,
    date: dateKey,
    time_start: timeStart,
    time_end: timeEnd,
    comment: title.trim(),
    event_notes: notes.trim(),
    event_type_id: eventTypeId,
    color_override: color,
    address: address.trim(),
    event_url: url.trim(),
    event_push_enabled: pushEnabled,
    event_push_offsets: pushEnabled ? pushOffsets : [],
    kind: "event",
    updated_at: new Date().toISOString(),
  });

  if (!open) return null;

  const navigationHref = (() => {
    const a = address.trim();
    if (!a) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
  })();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col"
        style={{ height: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — color + delete + close (top-right per spec) */}
        <div className="flex-shrink-0 px-4 pt-3 pb-2 flex items-center gap-2">
          <div className="flex-1 text-[15px] font-semibold text-[var(--label)] truncate">
            {mode === "edit" ? "Редактирование" : "Новое событие"}
          </div>
          <ColorSwatchPopover value={color} onChange={setColor} />
          {mode === "edit" && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(appointment)}
              aria-label="Удалить событие"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--system-red)] active:bg-[rgba(255,59,48,0.1)]"
            >
              <Trash2 size={18} strokeWidth={2} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <XIcon size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-4 space-y-3">
          {/* 1. Time first */}
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

          {/* 2. Title */}
          <div className="px-4">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
              Название
            </div>
            <input
              autoFocus={mode === "create"}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Событие"
              className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
            />
          </div>

          {/* 3. Notes */}
          <div className="px-4">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5 flex items-center gap-1.5">
              <StickyNote size={12} strokeWidth={2} />
              Заметка
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Подробности, ссылки, пожелания…"
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] resize-none"
            />
          </div>

          {/* 4. Event type tiles (configurable in settings) */}
          <div className="px-4">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5 flex items-center justify-between">
              <span>Тип события</span>
              <a
                href="/dashboard/settings/calendar/event-types"
                className="text-[var(--accent)] text-[11px] font-semibold normal-case tracking-normal"
              >
                Настроить
              </a>
            </div>
            {types.length === 0 ? (
              <div className="text-[13px] text-[var(--label-tertiary)] py-2">
                Нет типов. Добавьте в настройках.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {types.map((t) => {
                  const active = eventTypeId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onPickType(t)}
                      className="py-3 rounded-[14px] border bg-[var(--surface-card)] text-[13px] font-semibold text-[var(--label)] active:scale-[0.98] flex flex-col items-center gap-1.5 transition"
                      style={{
                        borderColor: active ? t.color : "var(--separator)",
                        background: active ? `${t.color}14` : undefined,
                      }}
                    >
                      <IconBadge
                        icon={t.icon}
                        color={t.color}
                        size={16}
                        className="w-7 h-7 rounded-full"
                      />
                      <span className="px-1 truncate max-w-full">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Place + Navigation */}
          <div className="px-4">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
              Место
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Адрес или название места"
                className="flex-1 h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />
              <a
                href={navigationHref ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Открыть в картах"
                onClick={(e) => {
                  if (!navigationHref) e.preventDefault();
                }}
                className={`h-11 px-3 rounded-[10px] flex items-center gap-1.5 text-[14px] font-semibold transition ${navigationHref ? "bg-[var(--accent-tint)] text-[var(--accent)] active:scale-[0.97]" : "bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] pointer-events-none"}`}
              >
                <NavigationIcon size={16} strokeWidth={2} />
                Карты
              </a>
            </div>
          </div>

          {/* 6. URL */}
          <div className="px-4">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5 flex items-center gap-1.5">
              <LinkIcon size={12} strokeWidth={2} />
              Ссылка
            </div>
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
            />
          </div>

          {/* 7. Push toggle + offsets */}
          <div className="px-4">
            <PushOffsetPicker
              enabled={pushEnabled}
              offsets={pushOffsets}
              onToggle={setPushEnabled}
              onChange={setPushOffsets}
            />
          </div>

          {/* Selected type chip — small confirmation visual */}
          {selectedType && (
            <div className="px-4 text-[11px] text-[var(--label-tertiary)] text-center">
              Выбрано: {selectedType.label}
            </div>
          )}
        </div>

        {/* Sticky save */}
        <div
          className="flex-shrink-0 px-4 pt-2 border-t border-[var(--separator)]"
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
