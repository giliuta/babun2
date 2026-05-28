"use client";

/**
 * SlotConfirmPopup — compact slot-tap pre-confirm.
 *
 * Shown after the dispatcher taps an empty slot on the calendar. The
 * date is already known from the tap, so there is NO week carousel.
 * Two wheels — hours + minutes (5-min step) — for the start time. The
 * end time is derived from the slot's duration; the form later adjusts
 * it to match the selected services.
 *
 * Footer has two stacked buttons (Событие on top, Клиент on bottom) so
 * the primary action sits in the thumb-zone.
 */

import { useEffect, useMemo, useState } from "react";
import { X } from "@babun/shared/icons";
import WheelColumn from "./WheelColumn";
import { formatDateRu, pad2 } from "@/lib/time-block-utils";

interface SlotConfirmPopupProps {
  open: boolean;
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  /** Reserved for future use; currently allDay is always false. */
  allDayRange?: { start: string; end: string };
  onClose: () => void;
  onConfirm: (
    kind: "work" | "event",
    next: { dateKey: string; timeStart: string; timeEnd: string; allDay: boolean },
  ) => void;
}

// Wheel granularity — appointment-booking accuracy.
const STEP = 5;

// "00".."23" for the hour wheel.
const HOURS: string[] = Array.from({ length: 24 }, (_, i) => pad2(i));
// "00", "05", ... "55" for the minute wheel (5-min step).
const MINUTES: string[] = Array.from(
  { length: 60 / STEP },
  (_, i) => pad2(i * STEP),
);

function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fromMin(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  return `${pad2(Math.floor(clamped / 60))}:${pad2(clamped % 60)}`;
}

function snapMinuteIdx(m: number): number {
  return Math.max(0, Math.min(MINUTES.length - 1, Math.round(m / STEP)));
}

export default function SlotConfirmPopup({
  open,
  dateKey,
  timeStart,
  timeEnd,
  onClose,
  onConfirm,
}: SlotConfirmPopupProps) {
  const [seedH, seedM] = useMemo(() => {
    const [h, m] = timeStart.split(":").map(Number);
    return [
      Math.max(0, Math.min(23, h ?? 0)),
      Math.max(0, Math.min(59, m ?? 0)),
    ];
  }, [timeStart]);

  const [draftHour, setDraftHour] = useState(seedH);
  const [draftMinIdx, setDraftMinIdx] = useState(snapMinuteIdx(seedM));

  // Keep the slot's original duration so changing the start drags the
  // end with it. Default to 60 min if seed has a degenerate range.
  const initialDuration = useMemo(() => {
    const d = toMin(timeEnd) - toMin(timeStart);
    return d > 0 ? d : 60;
  }, [timeStart, timeEnd]);

  // Reseed when the popup opens for a new slot.
  useEffect(() => {
    if (!open) return;
    setDraftHour(seedH);
    setDraftMinIdx(snapMinuteIdx(seedM));
  }, [open, seedH, seedM]);

  if (!open) return null;

  const draftStart = `${pad2(draftHour)}:${MINUTES[draftMinIdx]!}`;

  const finalize = (kind: "work" | "event") => {
    onConfirm(kind, {
      dateKey,
      timeStart: draftStart,
      timeEnd: fromMin(toMin(draftStart) + initialDuration),
      allDay: false,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[88] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[320px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: live title + ✕. */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-[var(--separator)]">
          <div className="flex-1 min-w-0 text-[15px] font-semibold text-[var(--label)] tabular-nums truncate">
            {formatDateRu(dateKey)} · {draftStart}
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

        {/* Two wheels — hours : minutes. */}
        <div className="py-2 flex items-center justify-center">
          <WheelColumn
            items={HOURS}
            selectedIndex={draftHour}
            onChange={setDraftHour}
            width={70}
            itemHeight={38}
            visibleRows={3}
            fontSize={24}
            loop
          />
          <span
            className="select-none text-[var(--label-tertiary)]"
            style={{ fontSize: 22, padding: "0 4px", lineHeight: `${38 * 3}px` }}
          >
            :
          </span>
          <WheelColumn
            items={MINUTES}
            selectedIndex={draftMinIdx}
            onChange={setDraftMinIdx}
            width={70}
            itemHeight={38}
            visibleRows={3}
            fontSize={24}
            loop
          />
          <style>{`.wheel-col-scroll::-webkit-scrollbar{display:none;}`}</style>
        </div>

        {/* Stacked footer — Событие on top (outline), Клиент on bottom (accent, primary thumb-zone). */}
        <div className="flex flex-col gap-2 px-3 py-3 border-t border-[var(--separator)]">
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
