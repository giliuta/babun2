"use client";

/**
 * TimePopup — centred modal that hosts the full date+time+duration
 * editing surface for AppointmentSheet: quick-fill chips
 * («⚡ Сейчас», «Через час», «Завтра»), TimeBlock wheels, duration
 * chip row (30/60/90/120). State is mutated live by the inner editors
 * so closing is a no-op (no commit/cancel split).
 *
 * Extracted from AppointmentSheet (Sprint #4 §9 step 3, v625).
 */

import type { Team } from "@babun/shared/local/masters";
import TimeBlock from "./TimeBlock";

interface TimePopupProps {
  open: boolean;
  onClose: () => void;
  liveMode: "create" | "view" | "edit" | "done";
  isEventMode: boolean;
  isEditable: boolean;
  readonly: boolean;
  activeTeam: Team | null;
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  totalDur: number;
  durationTouched: boolean;
  liveDurationMins: number;
  setDateKey: (d: string) => void;
  setTimeStart: (t: string) => void;
  setTimeEnd: (t: string) => void;
  applyDuration: (mins: number) => void;
}

const PRESET_DURATIONS = [30, 60, 90, 120] as const;

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(mins: number): string {
  const clamped = Math.min(23 * 60 + 59, Math.max(0, mins));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

export default function TimePopup({
  open,
  onClose,
  liveMode,
  isEventMode,
  isEditable,
  readonly,
  activeTeam,
  dateKey,
  timeStart,
  timeEnd,
  totalDur,
  durationTouched,
  liveDurationMins,
  setDateKey,
  setTimeStart,
  setTimeEnd,
  applyDuration,
}: TimePopupProps) {
  if (!open) return null;

  const step = activeTeam?.default_slot_minutes ?? 30;
  const dur = totalDur > 0 ? totalDur : step;
  const applyQuickFill = (d: Date, startMin: number) => {
    setDateKey(formatDateKey(d));
    setTimeStart(formatTime(startMin));
    setTimeEnd(formatTime(startMin + dur));
  };

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nextSlot = Math.ceil((nowMins + 1) / step) * step;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const quickChips = [
    { label: "⚡ Сейчас", onClick: () => applyQuickFill(now, nextSlot) },
    { label: "Через час", onClick: () => applyQuickFill(now, nextSlot + 60) },
    { label: "Завтра", onClick: () => applyQuickFill(tomorrow, 9 * 60) },
  ];

  return (
    <div
      className="fixed inset-0 z-[92] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between border-b border-[var(--separator)]">
          <span className="text-[13px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Время записи
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 h-8 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99]"
          >
            Готово
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto pb-3">
          {liveMode === "create" && !isEventMode && (
            <div
              className="px-4 pt-3 flex gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {quickChips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={c.onClick}
                  className="flex-shrink-0 px-3 h-8 rounded-full text-[13px] font-semibold bg-[var(--fill-tertiary)] text-[var(--label)] border border-[var(--separator)] active:scale-[0.97]"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          <TimeBlock
            date={dateKey}
            timeStart={timeStart}
            timeEnd={timeEnd}
            readOnly={readonly}
            stepMinutes={!isEventMode ? activeTeam?.default_slot_minutes : undefined}
            onChange={({ date: d, timeStart: s, timeEnd: e }) => {
              setDateKey(d);
              setTimeStart(s);
              setTimeEnd(e);
            }}
          />

          {isEditable && !isEventMode && (
            <div
              className="px-4 pt-3 flex items-center gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] flex-shrink-0 mr-1">
                Длит.
              </span>
              {PRESET_DURATIONS.map((m) => {
                const active = liveDurationMins === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => applyDuration(m)}
                    className={`flex-shrink-0 px-3 h-8 rounded-full text-[13px] font-semibold transition active:scale-[0.97] tabular-nums ${
                      active
                        ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                        : "bg-[var(--fill-tertiary)] text-[var(--label)] border border-[var(--separator)]"
                    }`}
                  >
                    {m}м
                  </button>
                );
              })}
              {durationTouched && !PRESET_DURATIONS.includes(liveDurationMins as never) && (
                <span className="flex-shrink-0 px-3 h-8 inline-flex items-center rounded-full text-[13px] font-semibold bg-[var(--accent)] text-[var(--label-on-accent)] tabular-nums">
                  {liveDurationMins}м
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
