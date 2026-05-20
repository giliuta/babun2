"use client";

/**
 * AppointmentHeader — top bar of the AppointmentSheet modal:
 *   - create mode: [Клиент / Событие] segment toggle (or "Личное событие"
 *     pill in personalMode)
 *   - edit mode: «Редактирование» heading
 *   - done mode: «✅ Выполнено · …» status badge
 *   - quick actions (✓ complete / 📷 photo / ↻ reschedule) on actionable
 *     view-mode work records
 *   - close ✕
 *
 * Extracted from AppointmentSheet (Sprint #4 §9 step 4, v626).
 */

import { useEffect, useState } from "react";
import { Check, Camera, CalendarClock, Palette } from "@babun/shared/icons";
import type { Appointment } from "@babun/shared/local/appointments";
import type { AppointmentSheetMode } from "./AppointmentSheet";
import { PRESET_COLORS } from "@babun/shared/common/utils/colors";

type Kind = "work" | "event";

interface AppointmentHeaderProps {
  liveMode: AppointmentSheetMode;
  personalMode: boolean;
  kind: Kind;
  eventFormDirty: boolean;
  /** v660 — dirty signal for the WORK side so the segment-toggle
   *  guard fires in BOTH directions. Previously only event→work was
   *  protected; tapping «Событие» after typing into the work form
   *  silently nuked all work fields. */
  workDirty: boolean;
  doneBadge: string | null;
  showQuickActions: boolean;
  onCompleteQuick?: (appointment: Appointment) => void;
  onReschedule?: (appointment: Appointment) => void;
  appointment: Appointment;
  scrollToPhotos: () => void;
  setKind: (k: Kind) => void;
  setSegmentSwitchConfirm: (v: boolean) => void;
  attemptClose: () => void;
  /** v667 — event mode shows a small palette icon top-right (between
   *  quick-actions and ✕). Tap opens a centered swatch popup; pick
   *  tints the sheet header band. Standalone work mode hides the
   *  button entirely. */
  isEventMode?: boolean;
  eventColor?: string;
  onEventColorChange?: (next: string) => void;
}

export default function AppointmentHeader({
  liveMode,
  personalMode,
  kind,
  eventFormDirty,
  workDirty,
  doneBadge,
  showQuickActions,
  onCompleteQuick,
  onReschedule,
  appointment,
  scrollToPhotos,
  setKind,
  setSegmentSwitchConfirm,
  attemptClose,
  isEventMode,
  eventColor,
  onEventColorChange,
}: AppointmentHeaderProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    if (!paletteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPaletteOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paletteOpen]);
  return (
    <div
      className="flex-shrink-0 px-4 pb-2 pt-2 flex items-center justify-between gap-2 transition-colors"
      // v667 — header band tints with the event colour when in event
      // mode, matching the «mini icon palette → paint the top» request.
      // Uses a 14 %-alpha tint (hex + '24') so the colour reads as a
      // soft accent, not solid fill — keeps text legible.
      style={
        isEventMode && eventColor && /^#[0-9a-fA-F]{6}$/.test(eventColor)
          ? { background: `${eventColor}24` }
          : undefined
      }
    >
      {liveMode === "create" ? (
        // STORY audit (design-keeper #4): раньше personal-mode имел
        // статическую pill «Личное событие», а team-mode — segment
        // toggle Клиент/Событие. Два разных visual language. Теперь
        // unified: всегда segment, но в personal-mode «Клиент»
        // disabled с tooltip-объяснением. Один компонент, одна сетка.
        <div className="inline-flex rounded-[10px] bg-[var(--fill-tertiary)] p-1 text-[13px] font-semibold">
          {(["work", "event"] as Kind[]).map((k) => {
            const disabled = personalMode && k === "work";
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                disabled={disabled}
                title={
                  disabled
                    ? "Клиентов записывайте на бригаду — на личном календаре только события"
                    : undefined
                }
                onClick={() => {
                  if (disabled) return;
                  if (k === kind) return;
                  // v619 / v660 — guard the kind swap in BOTH directions.
                  //   • event → work : protect if EventForm is dirty
                  //   • work  → event: protect if Work fields are dirty
                  // Otherwise an accidental segment tap nukes whatever
                  // the dispatcher was filling in on the other side.
                  if (kind === "event" && eventFormDirty) {
                    setSegmentSwitchConfirm(true);
                    return;
                  }
                  if (kind === "work" && workDirty) {
                    setSegmentSwitchConfirm(true);
                    return;
                  }
                  setKind(k);
                }}
                className={`px-4 py-1.5 rounded-[8px] transition ${
                  active
                    ? "bg-[var(--surface-card)] text-[var(--label)] shadow-[var(--shadow-card)]"
                    : disabled
                      ? "text-[var(--label-tertiary)] cursor-not-allowed"
                      : "text-[var(--label-secondary)]"
                }`}
              >
                {k === "work" ? "Клиент" : "Событие"}
              </button>
            );
          })}
        </div>
      ) : liveMode === "edit" ? (
        <div className="flex-1 text-[15px] font-semibold text-[var(--accent)]">
          Редактирование
        </div>
      ) : liveMode === "done" ? (
        <div className="flex-1 text-[13px] font-semibold text-[var(--system-green)] truncate">
          {doneBadge}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {showQuickActions && (
        <div className="flex items-center gap-1 flex-shrink-0">
          {onCompleteQuick && (
            <button
              type="button"
              onClick={() => onCompleteQuick(appointment)}
              aria-label="Отметить выполненной"
              title="Выполнено"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--system-green)] active:bg-[rgba(52,199,89,0.1)]"
            >
              <Check size={22} strokeWidth={2.5} />
            </button>
          )}
          <button
            type="button"
            onClick={scrollToPhotos}
            aria-label="Перейти к фото"
            title="Фото"
            className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--accent)] active:bg-[var(--accent-tint)]"
          >
            <Camera size={20} strokeWidth={2} />
          </button>
          {onReschedule && (
            <button
              type="button"
              onClick={() => onReschedule(appointment)}
              aria-label="Перенести запись"
              title="Перенести"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--system-orange)] active:bg-[rgba(255,149,0,0.1)]"
            >
              <CalendarClock size={20} strokeWidth={2} />
            </button>
          )}
        </div>
      )}

      {/* v667 — palette icon top-right (just before ✕) when in event
          mode. User explicit ask: «Цвет сделай справа верху мини
          иконка палитры и вылазит поп ап, окрашивает верхушку самой
          заявки». Tap opens centered swatch grid; pick paints this
          header band via the inline style on the wrapper div above. */}
      {isEventMode && eventColor && onEventColorChange && (
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Цвет события"
          className="w-11 h-11 flex items-center justify-center rounded-lg active:bg-[var(--fill-quaternary)] transition"
          style={{ color: eventColor }}
        >
          <Palette size={18} strokeWidth={2} />
        </button>
      )}

      <button
        type="button"
        onClick={attemptClose}
        aria-label="Закрыть"
        className="w-11 h-11 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Centered palette popup (feedback_center_modals.md style). */}
      {paletteOpen && eventColor && onEventColorChange && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-6"
          onClick={() => setPaletteOpen(false)}
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
                const active = eventColor.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      onEventColorChange(c.value);
                      setPaletteOpen(false);
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
              onClick={() => setPaletteOpen(false)}
              className="w-full mt-5 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
