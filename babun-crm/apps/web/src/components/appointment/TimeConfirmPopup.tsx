"use client";

/**
 * TimeConfirmPopup — centered pre-confirm popup shown between a slot
 * tap and the full AppointmentSheet. Lets the dispatcher verify or
 * adjust the time before committing to the create flow.
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
  onConfirm: () => void;
  onClose: () => void;
}

// Derive duration in minutes from two "HH:MM" strings.
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[88] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
        onClick={onClose}
      >
        {/* Card — stops propagation so tapping inside doesn't close */}
        <div
          className="w-full max-w-sm bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] p-5 relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] transition"
          >
            <X size={18} strokeWidth={2.5} />
          </button>

          {/* Date line */}
          <div className="text-[13px] text-[var(--label-secondary)] mb-1 pr-10">
            {formatDateRu(dateKey)}
          </div>

          {/* Time line */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[28px] font-bold text-[var(--label)] tracking-tight leading-none">
              {timeStart} — {timeEnd}
            </span>
          </div>

          {/* Duration hint */}
          <div className="text-[13px] text-[var(--label-secondary)] mb-5">
            {dur} мин
          </div>

          {/* Action row */}
          <div className="flex gap-3">
            {/* Изменить — opens the time editor inline */}
            <button
              type="button"
              onClick={() => setTimeEditOpen(true)}
              className="flex-1 h-11 rounded-[12px] border border-[var(--separator)] bg-[var(--surface-card)] text-[15px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition"
            >
              Изменить
            </button>

            {/* Дальше — confirm and open the full sheet */}
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 h-11 rounded-[12px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:opacity-80 transition"
            >
              Дальше →
            </button>
          </div>
        </div>
      </div>

      {/* Inner time picker — renders as its own centered popup on top */}
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
