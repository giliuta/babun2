"use client";

/**
 * SlotConfirmPopup — compact slot-tap pre-confirm.
 *
 * Shown after the dispatcher taps an empty slot on the calendar. The
 * date is already known (the tapped slot's date), so there is NO week
 * carousel. ONE wheel for the start time in 5-minute steps; the end
 * time is derived from the slot's duration and is set when the user
 * picks «Клиент» or «Событие» — the form itself later adjusts the end
 * to match the selected services.
 *
 * Footer has two stacked buttons (Событие on top, Клиент on bottom)
 * so the primary action sits in the thumb-zone.
 */

import { useEffect, useMemo, useState } from "react";
import { X } from "@babun/shared/icons";
import { IOSSwitch } from "@/components/ui";
import WheelColumn from "./WheelColumn";
import { formatDateRu, pad2 } from "@/lib/time-block-utils";

interface SlotConfirmPopupProps {
  open: boolean;
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  /** Time range applied when «Весь день» is toggled on. */
  allDayRange: { start: string; end: string };
  onClose: () => void;
  onConfirm: (
    kind: "work" | "event",
    next: { dateKey: string; timeStart: string; timeEnd: string; allDay: boolean },
  ) => void;
}

// Wheel granularity — appointment-booking accuracy.
const STEP = 5;

// All "HH:MM" times for the day in 5-minute steps (00:00 … 23:55).
// Computed once at module load.
const ALL_TIMES: string[] = (() => {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += STEP) {
      out.push(`${pad2(h)}:${pad2(m)}`);
    }
  }
  return out;
})();

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fromMin(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

function snapToStep(t: string): string {
  const total = toMin(t);
  const snapped = Math.round(total / STEP) * STEP;
  return fromMin(snapped);
}

export default function SlotConfirmPopup({
  open,
  dateKey,
  timeStart,
  timeEnd,
  allDayRange,
  onClose,
  onConfirm,
}: SlotConfirmPopupProps) {
  const [draftStart, setDraftStart] = useState(snapToStep(timeStart));
  const [allDay, setAllDay] = useState(false);

  // Keep the slot's original duration so changing the start drags the
  // end with it. Default to 60 min if seed has a degenerate range.
  const initialDuration = useMemo(() => {
    const d = toMin(timeEnd) - toMin(timeStart);
    return d > 0 ? d : 60;
  }, [timeStart, timeEnd]);

  // Reseed when the popup opens for a new slot.
  useEffect(() => {
    if (!open) return;
    setDraftStart(snapToStep(timeStart));
    setAllDay(false);
  }, [open, timeStart]);

  if (!open) return null;

  const selectedIndex = Math.max(0, ALL_TIMES.indexOf(draftStart));

  const finalize = (kind: "work" | "event") => {
    if (allDay) {
      onConfirm(kind, {
        dateKey,
        timeStart: allDayRange.start,
        timeEnd: allDayRange.end,
        allDay: true,
      });
      return;
    }
    onConfirm(kind, {
      dateKey,
      timeStart: draftStart,
      timeEnd: fromMin(toMin(draftStart) + initialDuration),
      allDay: false,
    });
  };

  const titleTime = allDay ? "весь день" : draftStart;

  return (
    <div
      className="fixed inset-0 z-[88] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: live title + ✕. */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-[var(--separator)]">
          <div className="flex-1 min-w-0 text-[15px] font-semibold text-[var(--label)] tabular-nums truncate">
            {formatDateRu(dateKey)} · {titleTime}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-1 w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* All-day row. */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-[var(--separator)]">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Весь день
          </span>
          <IOSSwitch checked={allDay} onChange={setAllDay} ariaLabel="Весь день" />
        </div>

        {/* Wheel — single column with full "HH:MM" entries (5-min step). */}
        {!allDay ? (
          <div className="py-3 flex items-center justify-center">
            <WheelColumn
              items={ALL_TIMES}
              selectedIndex={selectedIndex}
              onChange={(idx) => setDraftStart(ALL_TIMES[idx]!)}
              width={140}
              itemHeight={42}
              visibleRows={5}
              fontSize={28}
              loop
            />
            <style>{`.wheel-col-scroll::-webkit-scrollbar{display:none;}`}</style>
          </div>
        ) : (
          <div className="py-10 text-center text-[14px] text-[var(--label-secondary)] tabular-nums">
            {allDayRange.start} — {allDayRange.end}
          </div>
        )}

        {/* Stacked footer — Событие (top, outline) → Клиент (bottom, accent, primary). */}
        <div className="flex flex-col gap-2 px-4 py-3 border-t border-[var(--separator)]">
          <button
            type="button"
            onClick={() => finalize("event")}
            className="w-full h-11 rounded-[12px] border border-[var(--separator)] bg-[var(--surface-card)] text-[15px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition"
          >
            Событие
          </button>
          <button
            type="button"
            onClick={() => finalize("work")}
            className="w-full h-11 rounded-[12px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:opacity-80 transition"
          >
            Клиент
          </button>
        </div>
      </div>
    </div>
  );
}
