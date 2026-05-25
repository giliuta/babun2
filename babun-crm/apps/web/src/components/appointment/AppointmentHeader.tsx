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
  /** v708 — accent colour for the WHOLE record, both work and event.
   *  Palette icon sits top-right next to ✕ in create/edit. Picking a
   *  swatch washes the whole sheet (handled in AppointmentSheet root);
   *  «Без цвета» resets to null. Shown whenever onColorChange is
   *  provided (i.e. the sheet is editable). null = no colour picked. */
  colorValue?: string | null;
  onColorChange?: (next: string | null) => void;
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
  colorValue,
  onColorChange,
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
      className="flex-shrink-0 px-4 pb-2 pt-2 transition-colors"
      // v708 — colour wash lives on the whole sheet (AppointmentSheet
      // root). v710 — single top row: compact «Клиент / Событие»
      // button-pair on the left, quick-actions + palette + ✕ on the
      // right.
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        {liveMode === "create" ? (
          // v712 — segmented-control look the user liked (grey track +
          // white active pill with shadow), stretched with flex-1 to
          // fill the top row up to the palette/✕ cluster; buttons split
          // it 50/50. personal-mode keeps «Клиент» disabled; v660
          // dirty-guard still fires in both directions.
          <div className="flex flex-1 rounded-[10px] bg-[var(--fill-tertiary)] p-1 text-[13px] font-semibold">
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
                  className={`flex-1 text-center px-3 py-2 rounded-[8px] transition ${
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


        <div className="flex items-center gap-1 flex-shrink-0">
          {showQuickActions && (
            <>
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
            </>
          )}

          {/* v708 — palette icon next to ✕, shown whenever the sheet is
              editable — both «Клиент» and «Событие». Tap opens the swatch
              grid; pick washes the whole sheet. Icon tints to the picked
              colour, neutral when nothing's chosen. */}
          {onColorChange && (
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Цвет записи"
              className="w-11 h-11 flex items-center justify-center rounded-lg active:bg-[var(--fill-quaternary)] transition"
              style={colorValue ? { color: colorValue } : undefined}
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
        </div>
      </div>

      {/* Centered palette popup (feedback_center_modals.md style). */}
      {paletteOpen && onColorChange && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[3px] p-6"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] p-5 w-full max-w-[320px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-semibold text-[var(--label)] text-center mb-4">
              Цвет записи
            </div>
            <div className="grid grid-cols-7 gap-2.5">
              {PRESET_COLORS.map((c) => {
                const active =
                  (colorValue ?? "").toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      onColorChange(c.value);
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
            {/* v708 — «Без цвета» resets the override to null so the
                record falls back to its team / service colour and the
                form wash turns off. */}
            <button
              type="button"
              onClick={() => {
                onColorChange(null);
                setPaletteOpen(false);
              }}
              className="w-full mt-4 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition"
            >
              Без цвета
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(false)}
              className="w-full mt-2 h-10 rounded-[10px] text-[14px] font-medium text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] transition"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
