"use client";

/**
 * TimeConfirmPopup — compact centered popup shown between a slot tap
 * and the full AppointmentSheet. Lets the dispatcher verify the time
 * AND pick the record type (Клиент / Событие) before committing.
 *
 * Popup-design rule: fixed inset-0 flex items-center justify-center,
 * rounded-[20px], no grabber pill. Never slides up from the bottom.
 */

import { useState } from "react";
import { X } from "@babun/shared/icons";
import { formatDateRu } from "@/lib/time-block-utils";
import UnifiedTimePopup from "./UnifiedTimePopup";

interface TimeConfirmPopupProps {
  open: boolean;
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  allDayRange: { start: string; end: string };
  stepMinutes?: number;
  onChange: (next: { dateKey: string; timeStart: string; timeEnd: string }) => void;
  /** Caller passes the chosen record kind. */
  onConfirm: (kind: "work" | "event") => void;
  onClose: () => void;
}

function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

export default function TimeConfirmPopup({
  open,
  dateKey,
  timeStart,
  timeEnd,
  allDayRange,
  stepMinutes,
  onChange,
  onConfirm,
  onClose,
}: TimeConfirmPopupProps) {
  const [timeEditOpen, setTimeEditOpen] = useState(false);

  if (!open) return null;

  const dur = durationMinutes(timeStart, timeEnd);

  return (
    <>
      <div
        className="fixed inset-0 z-[88] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-[320px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] p-3 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close ✕ */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-2 right-2 w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] transition"
          >
            <X size={16} strokeWidth={2.5} />
          </button>

          {/* Tappable time row — same style as the form's TimeSummaryRow.
              Tap → opens UnifiedTimePopup for inline editing. */}
          <button
            type="button"
            onClick={() => setTimeEditOpen(true)}
            className="w-full text-left rounded-[12px] border border-[var(--separator)] bg-[var(--fill-tertiary)] px-3 py-2.5 mt-1 mr-9 active:bg-[var(--fill-quaternary)] transition"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
              Время
            </div>
            <div className="text-[17px] font-bold text-[var(--label)] tabular-nums leading-tight mt-0.5">
              {timeStart} — {timeEnd}
            </div>
            <div className="text-[12px] text-[var(--label-secondary)] tabular-nums mt-0.5">
              {formatDateRu(dateKey)} · {dur} мин
            </div>
          </button>

          {/* Two record-type buttons */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              type="button"
              onClick={() => onConfirm("work")}
              className="h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:opacity-80 transition"
            >
              Клиент
            </button>
            <button
              type="button"
              onClick={() => onConfirm("event")}
              className="h-11 rounded-[10px] border border-[var(--separator)] bg-[var(--surface-card)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition"
            >
              Событие
            </button>
          </div>
        </div>
      </div>

      <UnifiedTimePopup
        open={timeEditOpen}
        onClose={() => setTimeEditOpen(false)}
        readonly={false}
        dateKey={dateKey}
        timeStart={timeStart}
        timeEnd={timeEnd}
        allDay={false}
        allDayRange={allDayRange}
        stepMinutes={stepMinutes}
        onCommit={({ date, timeStart: s, timeEnd: e }) => {
          onChange({ dateKey: date, timeStart: s, timeEnd: e });
          setTimeEditOpen(false);
        }}
      />
    </>
  );
}
