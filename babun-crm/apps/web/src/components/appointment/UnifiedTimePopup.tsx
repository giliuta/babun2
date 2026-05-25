"use client";

/**
 * UnifiedTimePopup — one centred modal for picking date + start/end
 * time, shared by «Клиент» (work) and «Событие». Buffered: edits live
 * in a local draft and only land on the parent when «Готово» is
 * tapped; «Отмена» discards. Layout: header shows the live summary +
 * a small «весь день» switch; below, a smooth week carousel (snaps
 * per week) and two large separated «Начало» / «Конец» wheel columns.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import WheelColumn from "./WheelColumn";
import { IOSSwitch } from "@/components/ui";
import {
  HOURS,
  pad2,
  dateToKey,
  parseTime,
  minutesToHHMM,
  mondayOf,
  sameYMD,
  formatDateRu,
  formatWeekRange,
  resolveStep,
  WEEKDAYS,
} from "@/lib/time-block-utils";

interface UnifiedTimePopupProps {
  open: boolean;
  onClose: () => void;
  readonly: boolean;
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  allDay: boolean;
  /** Time range to apply when «весь день» is switched on — work uses
   *  00:00–23:59, events use the team's working hours. */
  allDayRange: { start: string; end: string };
  /** Wheel granularity (team default_slot_minutes for work, 5 for event). */
  stepMinutes?: number;
  /** Commit the draft to the parent (called on «Готово»). */
  onCommit: (next: {
    date: string;
    timeStart: string;
    timeEnd: string;
    allDay: boolean;
  }) => void;
}

const ITEM_HEIGHT = 36;
const VISIBLE_ROWS = 3;
const COLUMN_WIDTH = 52;
const WHEEL_H = ITEM_HEIGHT * VISIBLE_ROWS;
const PAD = (WHEEL_H - ITEM_HEIGHT) / 2;
// Carousel window — how many weeks before / after the anchor week we
// render as snap pages. 26 each way ≈ a year of scroll either side.
const WEEKS_BACK = 26;
const WEEKS_FWD = 26;

interface Draft {
  date: string;
  timeStart: string;
  timeEnd: string;
  allDay: boolean;
}

export default function UnifiedTimePopup({
  open,
  onClose,
  readonly,
  dateKey,
  timeStart,
  timeEnd,
  allDay,
  allDayRange,
  stepMinutes,
  onCommit,
}: UnifiedTimePopupProps) {
  const [draft, setDraft] = useState<Draft>({
    date: dateKey,
    timeStart,
    timeEnd,
    allDay,
  });
  // Anchor monday — fixed while the popup is open so selecting a day
  // in another week never reflows the carousel. Reset on each open.
  const [anchorKey, setAnchorKey] = useState(dateKey);
  const [visiblePage, setVisiblePage] = useState(WEEKS_BACK);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({ date: dateKey, timeStart, timeEnd, allDay });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnchorKey(dateKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisiblePage(WEEKS_BACK);
  }, [open, dateKey, timeStart, timeEnd, allDay]);

  const MIN_STEP = resolveStep(stepMinutes);
  const MINUTES = useMemo(
    () => Array.from({ length: 60 / MIN_STEP }, (_, i) => pad2(i * MIN_STEP)),
    [MIN_STEP],
  );

  const pages = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const anchorMonday = mondayOf(anchorKey);
    return Array.from({ length: WEEKS_BACK + WEEKS_FWD + 1 }, (_, i) => {
      const monday = new Date(anchorMonday);
      monday.setDate(anchorMonday.getDate() + (i - WEEKS_BACK) * 7);
      const days = Array.from({ length: 7 }, (_, j) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + j);
        return {
          key: dateToKey(d),
          weekday: WEEKDAYS[j],
          day: d.getDate(),
          isToday: sameYMD(d, today),
        };
      });
      return { monday, days };
    });
  }, [anchorKey]);

  // Land the scroll on the anchor week when the popup opens. rAF so
  // the container has its width before we set scrollLeft.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollLeft = WEEKS_BACK * el.clientWidth;
    });
    return () => cancelAnimationFrame(id);
  }, [open, anchorKey]);

  const onCarouselScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== visiblePage) setVisiblePage(idx);
  };

  if (!open) return null;

  const [sh, sm] = parseTime(draft.timeStart);
  const [eh, em] = parseTime(draft.timeEnd);
  const startHourIdx = Math.max(0, Math.min(23, sh));
  const startMinIdx = (Math.floor(sm / MIN_STEP) * MIN_STEP) / MIN_STEP;
  const endHourIdx = Math.max(0, Math.min(23, eh));
  const endMinIdx = (Math.floor(em / MIN_STEP) * MIN_STEP) / MIN_STEP;
  const startTotal = sh * 60 + sm;

  const commitStart = (hour: number, min: number) => {
    const nextStartTotal = hour * 60 + min;
    setDraft((d) => {
      const [deh, dem] = parseTime(d.timeEnd);
      const endTotal = deh * 60 + dem;
      const nextStart = `${pad2(hour)}:${pad2(min)}`;
      const nextEnd =
        endTotal <= nextStartTotal ? minutesToHHMM(nextStartTotal + 60) : d.timeEnd;
      return { ...d, timeStart: nextStart, timeEnd: nextEnd };
    });
  };
  const commitEnd = (hour: number, min: number) => {
    const nextEndTotal = hour * 60 + min;
    if (nextEndTotal <= startTotal) return;
    setDraft((d) => ({ ...d, timeEnd: `${pad2(hour)}:${pad2(min)}` }));
  };

  const setAllDay = (v: boolean) => {
    setDraft((d) =>
      v
        ? { ...d, allDay: true, timeStart: allDayRange.start, timeEnd: allDayRange.end }
        : { ...d, allDay: false, timeStart: "10:00", timeEnd: "11:00" },
    );
  };

  const rangeLabel = formatWeekRange(
    pages[Math.max(0, Math.min(pages.length - 1, visiblePage))].monday,
  );

  const summary = `${formatDateRu(draft.date)}, ${
    draft.allDay ? "весь день" : `с ${draft.timeStart} до ${draft.timeEnd}`
  }`;

  return (
    <div
      className="fixed inset-0 z-[92] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: live summary + small «весь день» switch */}
        <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3 border-b border-[var(--separator)]">
          <span className="flex-1 min-w-0 text-[15px] font-semibold text-[var(--label)] tabular-nums truncate">
            {summary}
          </span>
          {!readonly && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Весь день
              </span>
              <IOSSwitch checked={draft.allDay} onChange={setAllDay} ariaLabel="Весь день" />
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* Week carousel — smooth momentum scroll, snaps per week. */}
          <div>
            <div
              ref={scrollRef}
              onScroll={onCarouselScroll}
              className="flex overflow-x-auto"
              style={{
                scrollSnapType: "x mandatory",
                scrollbarWidth: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {pages.map((page, i) => (
                <div
                  key={i}
                  className="flex items-stretch gap-1.5"
                  style={{ flex: "0 0 100%", scrollSnapAlign: "start" }}
                >
                  {page.days.map((d) => {
                    const active = d.key === draft.date;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => setDraft((s) => ({ ...s, date: d.key }))}
                        className="flex flex-col items-center justify-center transition active:scale-[0.96]"
                        style={{
                          flex: "1 1 0",
                          minWidth: 0,
                          height: 58,
                          borderRadius: 14,
                          gap: 2,
                          background: active ? "var(--accent)" : "var(--fill-tertiary)",
                          border: active
                            ? "1px solid transparent"
                            : d.isToday
                              ? "1px solid var(--accent)"
                              : "1px solid transparent",
                          color: active ? "white" : d.isToday ? "var(--accent)" : "var(--label)",
                          boxShadow: active ? "0 4px 12px rgba(62,136,247,0.30)" : undefined,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.04em",
                            color: active
                              ? "rgba(255,255,255,0.82)"
                              : d.isToday
                                ? "var(--accent)"
                                : "var(--label-secondary)",
                            lineHeight: 1,
                          }}
                        >
                          {d.weekday}
                        </span>
                        <span
                          className="tabular-nums"
                          style={{ fontSize: 19, fontWeight: 700, lineHeight: 1 }}
                        >
                          {d.day}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="text-center text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)] mt-2">
              {rangeLabel}
            </div>
          </div>

          {/* Core — two big separated wheel columns. Hidden when all-day. */}
          {!draft.allDay && (
            <div className="flex items-start justify-center gap-7 pt-1">
              <WheelSide
                label="Начало"
                minutes={MINUTES}
                hourIdx={startHourIdx}
                minIdx={startMinIdx}
                onHour={(h) => commitStart(h, startMinIdx * MIN_STEP)}
                onMin={(m) => commitStart(startHourIdx, m * MIN_STEP)}
              />
              <WheelSide
                label="Конец"
                minutes={MINUTES}
                hourIdx={endHourIdx}
                minIdx={endMinIdx}
                onHour={(h) => commitEnd(h, endMinIdx * MIN_STEP)}
                onMin={(m) => commitEnd(endHourIdx, m * MIN_STEP)}
              />
            </div>
          )}
        </div>

        {/* Footer — Отмена / Готово */}
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
              onCommit(draft);
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

function WheelSide({
  label,
  minutes,
  hourIdx,
  minIdx,
  onHour,
  onMin,
}: {
  label: string;
  minutes: string[];
  hourIdx: number;
  minIdx: number;
  onHour: (idx: number) => void;
  onMin: (idx: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
        {label}
      </span>
      <div className="flex items-center">
        <WheelWithLines>
          <WheelColumn
            items={HOURS}
            selectedIndex={hourIdx}
            onChange={onHour}
            width={COLUMN_WIDTH}
            itemHeight={ITEM_HEIGHT}
            visibleRows={VISIBLE_ROWS}
            loop
          />
        </WheelWithLines>
        <span
          className="select-none"
          style={{
            fontSize: 22,
            fontWeight: 300,
            color: "var(--label-tertiary)",
            padding: "0 2px",
            lineHeight: `${WHEEL_H}px`,
          }}
        >
          :
        </span>
        <WheelWithLines>
          <WheelColumn
            items={minutes}
            selectedIndex={minIdx}
            onChange={onMin}
            width={COLUMN_WIDTH}
            itemHeight={ITEM_HEIGHT}
            visibleRows={VISIBLE_ROWS}
            loop
          />
        </WheelWithLines>
      </div>
    </div>
  );
}

function WheelWithLines({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <div
        className="pointer-events-none absolute z-10"
        style={{ left: 2, right: 2, top: PAD, height: 1, background: "rgba(15, 23, 42, 0.12)" }}
      />
      <div
        className="pointer-events-none absolute z-10"
        style={{ left: 2, right: 2, top: PAD + ITEM_HEIGHT - 1, height: 1, background: "rgba(15, 23, 42, 0.12)" }}
      />
    </div>
  );
}
