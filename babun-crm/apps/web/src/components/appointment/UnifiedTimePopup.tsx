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

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 3;
const COLUMN_WIDTH = 58;
const DIGIT_FONT = 26;
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
  // Controlled week pager — pageIndex selects the week, dragDx is the
  // live finger offset (px) while swiping. Deterministic snap on
  // release; no reliance on flaky native scroll-snap.
  const [pageIndex, setPageIndex] = useState(WEEKS_BACK);
  const [dragDx, setDragDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Measured viewport width — drives fixed cell width (vw/7) so every
  // day square is identical including across week seams (uniform gap).
  const [vw, setVw] = useState(0);
  const dragStartXRef = useRef<number | null>(null);
  const movedRef = useRef(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  // Time set before «весь день» was switched on — restored on toggle off.
  const preAllDayRef = useRef<{ start: string; end: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({ date: dateKey, timeStart, timeEnd, allDay });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnchorKey(dateKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageIndex(WEEKS_BACK);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDragDx(0);
    // Seed the pre-all-day memory: if opening already in all-day we
    // have no earlier time, so toggling off falls back to a default;
    // otherwise remember the incoming time.
    preAllDayRef.current = allDay ? null : { start: timeStart, end: timeEnd };
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

  const flatDays = useMemo(() => pages.flatMap((p) => p.days), [pages]);

  // Measure the viewport width (and keep it fresh on resize) so cells
  // get a fixed px width = vw/7.
  useEffect(() => {
    if (!open) return;
    const measure = () => setVw(viewportRef.current?.clientWidth ?? 0);
    measure();
    const id = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  const onPagerTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    dragStartXRef.current = e.touches[0].clientX;
    movedRef.current = false;
    setDragging(true);
  };
  const onPagerTouchMove = (e: React.TouchEvent) => {
    if (dragStartXRef.current === null) return;
    const dx = e.touches[0].clientX - dragStartXRef.current;
    if (Math.abs(dx) > 8) movedRef.current = true;
    setDragDx(dx);
  };
  const onPagerTouchEnd = () => {
    const w = vw || viewportRef.current?.clientWidth || 1;
    const dx = dragDx;
    dragStartXRef.current = null;
    setDragging(false);
    setDragDx(0);
    // Snap: a drag past ~22% of the width advances one week; otherwise
    // spring back to the current page.
    if (Math.abs(dx) > w * 0.22) {
      setPageIndex((p) =>
        Math.max(0, Math.min(pages.length - 1, p + (dx < 0 ? 1 : -1))),
      );
    }
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
    setDraft((d) => {
      if (v) {
        if (!d.allDay) preAllDayRef.current = { start: d.timeStart, end: d.timeEnd };
        return { ...d, allDay: true, timeStart: allDayRange.start, timeEnd: allDayRange.end };
      }
      const prev = preAllDayRef.current;
      return {
        ...d,
        allDay: false,
        timeStart: prev?.start ?? "10:00",
        timeEnd: prev?.end ?? "11:00",
      };
    });
  };

  const rangeLabel = formatWeekRange(
    pages[Math.max(0, Math.min(pages.length - 1, pageIndex))].monday,
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
          {/* Week pager — controlled transform; drag to swipe, snaps
              cleanly to one week on release. */}
          <div>
            <div
              ref={viewportRef}
              className="overflow-hidden"
              onTouchStart={onPagerTouchStart}
              onTouchMove={onPagerTouchMove}
              onTouchEnd={onPagerTouchEnd}
            >
              {/* One continuous strip of day cells, each a fixed vw/7
                  wide with equal side padding → uniform gap everywhere,
                  including across week seams. Translate by whole weeks
                  (pageIndex * vw px). */}
              <div
                className="flex"
                style={{
                  transform: `translateX(${-pageIndex * vw + dragDx}px)`,
                  transition: dragging ? "none" : "transform 280ms cubic-bezier(0.22,0.61,0.36,1)",
                }}
              >
                {flatDays.map((d) => {
                  const active = d.key === draft.date;
                  return (
                    <div
                      key={d.key}
                      style={{ width: vw / 7, flexShrink: 0, padding: "0 3px" }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (movedRef.current) return;
                          setDraft((s) => ({ ...s, date: d.key }));
                        }}
                        className="w-full flex flex-col items-center justify-center transition active:scale-[0.96]"
                        style={{
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
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="text-center text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)] mt-2">
              {rangeLabel}
            </div>
          </div>

          {/* Core — two big separated wheel columns. Hidden when all-day. */}
          {!draft.allDay && (
            <div className="flex items-start justify-center gap-12 pt-1">
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
            fontSize={DIGIT_FONT}
            loop
          />
        </WheelWithLines>
        <span
          className="select-none"
          style={{
            fontSize: DIGIT_FONT,
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
            fontSize={DIGIT_FONT}
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
