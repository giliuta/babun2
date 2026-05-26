"use client";

import { useEffect, useMemo, useState } from "react";
import { WheelSide } from "@/components/appointment/TimeWheels";
import { pad2, parseTime, minutesToHHMM, resolveStep } from "@/lib/time-block-utils";

interface CalendarTimePopupProps {
  open: boolean;
  title: string;
  /** "range" shows Начало + Конец wheels; "single" shows one. */
  mode: "range" | "single";
  /** Current "HH:MM" value(s). For single only `start` is used. */
  start: string;
  end?: string;
  /** Wheel minute granularity. Default 30. */
  stepMinutes?: number;
  onClose: () => void;
  /** Commit the chosen value(s) on «Готово». For single, end === start. */
  onCommit: (start: string, end: string) => void;
}

// Centered drum picker — same chrome and wheels as the appointment time
// popup (UnifiedTimePopup), minus the date carousel. Buffered: edits live
// in a draft and only apply on «Готово»; «Отмена» / backdrop discard.
export default function CalendarTimePopup({
  open,
  title,
  mode,
  start,
  end,
  stepMinutes,
  onClose,
  onCommit,
}: CalendarTimePopupProps) {
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end ?? start);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setDraftStart(start);
    setDraftEnd(end ?? start);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, start, end]);

  const MIN_STEP = resolveStep(stepMinutes ?? 30);
  const MINUTES = useMemo(
    () => Array.from({ length: 60 / MIN_STEP }, (_, i) => pad2(i * MIN_STEP)),
    [MIN_STEP],
  );

  if (!open) return null;

  const [sh, sm] = parseTime(draftStart);
  const [eh, em] = parseTime(draftEnd);
  const startHourIdx = Math.max(0, Math.min(23, sh));
  const startMinIdx = Math.floor(sm / MIN_STEP);
  const endHourIdx = Math.max(0, Math.min(23, eh));
  const endMinIdx = Math.floor(em / MIN_STEP);
  const startTotal = sh * 60 + sm;

  const setStart = (hour: number, min: number) => {
    const nextStartTotal = hour * 60 + min;
    setDraftStart(`${pad2(hour)}:${pad2(min)}`);
    if (mode === "range") {
      const endTotal = eh * 60 + em;
      if (endTotal <= nextStartTotal) {
        setDraftEnd(minutesToHHMM(nextStartTotal + 60));
      }
    }
  };
  const setEnd = (hour: number, min: number) => {
    const nextEndTotal = hour * 60 + min;
    if (nextEndTotal <= startTotal) return;
    setDraftEnd(`${pad2(hour)}:${pad2(min)}`);
  };

  const summary =
    mode === "range" ? `с ${draftStart} до ${draftEnd}` : draftStart;

  return (
    <div
      className="fixed inset-0 z-[92] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-[var(--separator)]">
          <span className="flex-1 min-w-0 text-[15px] font-semibold text-[var(--label)] truncate">
            {title}
          </span>
          <span className="text-[13px] text-[var(--label-secondary)] tabular-nums flex-shrink-0">
            {summary}
          </span>
        </div>

        <div className="p-4">
          {mode === "range" ? (
            <div className="flex items-start justify-center gap-12 pt-1">
              <WheelSide
                label="Начало"
                minutes={MINUTES}
                hourIdx={startHourIdx}
                minIdx={startMinIdx}
                onHour={(h) => setStart(h, startMinIdx * MIN_STEP)}
                onMin={(m) => setStart(startHourIdx, m * MIN_STEP)}
              />
              <WheelSide
                label="Конец"
                minutes={MINUTES}
                hourIdx={endHourIdx}
                minIdx={endMinIdx}
                onHour={(h) => setEnd(h, endMinIdx * MIN_STEP)}
                onMin={(m) => setEnd(endHourIdx, m * MIN_STEP)}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center pt-1">
              <WheelSide
                minutes={MINUTES}
                hourIdx={startHourIdx}
                minIdx={startMinIdx}
                onHour={(h) => setStart(h, startMinIdx * MIN_STEP)}
                onMin={(m) => setStart(startHourIdx, m * MIN_STEP)}
              />
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex gap-2 px-4 py-3 border-t border-[var(--separator)]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-[12px] bg-[var(--fill-tertiary)] text-[15px] font-semibold text-[var(--label)] active:bg-[var(--fill-quaternary)] transition"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => {
              onCommit(draftStart, mode === "range" ? draftEnd : draftStart);
              onClose();
            }}
            className="flex-1 h-11 rounded-[12px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99] transition"
          >
            Готово
          </button>
        </div>
        <style>{`.wheel-col-scroll::-webkit-scrollbar{display:none;}`}</style>
      </div>
    </div>
  );
}
