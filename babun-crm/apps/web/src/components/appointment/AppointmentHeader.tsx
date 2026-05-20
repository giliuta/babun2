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

import { Check, Camera, CalendarClock } from "@babun/shared/icons";
import type { Appointment } from "@babun/shared/local/appointments";
import type { AppointmentSheetMode } from "./AppointmentSheet";

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
}: AppointmentHeaderProps) {
  return (
    <div className="flex-shrink-0 px-4 pb-2 flex items-center justify-between gap-2">
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
    </div>
  );
}
