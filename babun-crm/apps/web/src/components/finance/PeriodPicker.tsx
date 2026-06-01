"use client";

// Period control for /finances — a single compact pill showing the
// active date range. Tap → centered modal with presets (Сегодня /
// Вчера / Неделя / Месяц / Год) + «Свой период» (custom from–to).
// Replaces the long horizontal chip strip.

import { useState } from "react";
import {
  PERIOD_LABELS,
  type PeriodKind,
  type PeriodRange,
} from "@/lib/finance/period";

const MONTHS_SHORT = [
  "янв.", "фев.", "мар.", "апр.", "мая", "июн.",
  "июл.", "авг.", "сен.", "окт.", "ноя.", "дек.",
];

const PRESETS: PeriodKind[] = ["today", "yesterday", "week", "month", "year"];

function parse(ymd: string): { d: number; m: number; y: number } {
  const dt = new Date(`${ymd}T00:00:00`);
  return { d: dt.getDate(), m: dt.getMonth(), y: dt.getFullYear() };
}

function formatRange(from: string, to: string): string {
  const a = parse(from);
  const b = parse(to);
  if (from === to) return `${a.d} ${MONTHS_SHORT[a.m]}`;
  if (a.m === b.m && a.y === b.y) return `${a.d}–${b.d} ${MONTHS_SHORT[b.m]}`;
  return `${a.d} ${MONTHS_SHORT[a.m]} – ${b.d} ${MONTHS_SHORT[b.m]}`;
}

interface PeriodPickerProps {
  value: PeriodKind;
  onChange: (kind: PeriodKind) => void;
  range: PeriodRange;
  /** Apply a custom from–to range (also flips value to "custom"). */
  onCustomRange: (range: PeriodRange) => void;
}

export default function PeriodPicker({
  value,
  onChange,
  range,
  onCustomRange,
}: PeriodPickerProps) {
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [fromDate, setFromDate] = useState(range.from);
  const [toDate, setToDate] = useState(range.to);

  const openModal = () => {
    setFromDate(range.from);
    setToDate(range.to);
    setCustomMode(value === "custom");
    setOpen(true);
  };

  const pickPreset = (k: PeriodKind) => {
    onChange(k);
    setOpen(false);
  };

  const applyCustom = () => {
    if (!fromDate || !toDate) return;
    const lo = fromDate <= toDate ? fromDate : toDate;
    const hi = fromDate <= toDate ? toDate : fromDate;
    onCustomRange({ from: lo, to: hi });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[var(--fill-tertiary)] text-[14px] font-semibold text-[var(--label)] active:scale-[0.98] transition"
      >
        <span className="text-[13px]">📅</span>
        <span className="tabular-nums">{formatRange(range.from, range.to)}</span>
        <span className="text-[10px] text-[var(--label-tertiary)]">▼</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[var(--surface-overlay)] backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-[var(--surface-card)] rounded-[18px] overflow-hidden shadow-[var(--shadow-sheet)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-3.5 pb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
              Период
            </div>

            {PRESETS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pickPreset(k)}
                className={`w-full flex items-center justify-between px-4 h-12 text-[15px] active:bg-[var(--fill-quaternary)] transition-colors ${
                  value === k && !customMode
                    ? "text-[var(--accent)] font-semibold"
                    : "text-[var(--label)]"
                }`}
              >
                <span>{PERIOD_LABELS[k]}</span>
                {value === k && !customMode && (
                  <span className="text-[var(--accent)]">✓</span>
                )}
              </button>
            ))}

            <div className="border-t border-[var(--separator)]">
              <button
                type="button"
                onClick={() => setCustomMode((v) => !v)}
                className={`w-full flex items-center justify-between px-4 h-12 text-[15px] active:bg-[var(--fill-quaternary)] transition-colors ${
                  value === "custom" || customMode
                    ? "text-[var(--accent)] font-semibold"
                    : "text-[var(--label)]"
                }`}
              >
                <span>Свой период</span>
                <span className="text-[12px] text-[var(--label-tertiary)]">
                  {customMode ? "▲" : "▼"}
                </span>
              </button>

              {customMode && (
                <div className="px-4 pb-4 pt-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[var(--label-secondary)] w-5">С</span>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="flex-1 h-10 px-3 bg-[var(--fill-tertiary)] rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[var(--label-secondary)] w-5">По</span>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="flex-1 h-10 px-3 bg-[var(--fill-tertiary)] rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyCustom}
                    className="w-full h-10 rounded-[var(--radius-pill)] text-[14px] font-semibold bg-[var(--accent)] text-[var(--label-on-accent)] active:scale-[0.98]"
                  >
                    Применить
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
