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

const PRESETS: PeriodKind[] = ["today", "yesterday", "week", "month", "year"];

function parse(ymd: string): { d: number; m: number; y: number } {
  const dt = new Date(`${ymd}T00:00:00`);
  return { d: dt.getDate(), m: dt.getMonth(), y: dt.getFullYear() };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function dmy(ymd: string): string {
  const a = parse(ymd);
  return `${pad2(a.d)}.${pad2(a.m + 1)}.${String(a.y).slice(2)}`;
}
function formatFullRange(from: string, to: string): string {
  if (from === to) return dmy(from);
  return `${dmy(from)} – ${dmy(to)}`;
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

  const openWith = (custom: boolean) => {
    setFromDate(range.from);
    setToDate(range.to);
    setCustomMode(custom);
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
      <div className="flex items-center justify-between gap-2 py-0.5">
        <button
          type="button"
          onClick={() => openWith(false)}
          className="inline-flex items-center gap-1 text-[16px] font-semibold text-[var(--label)] active:opacity-60 transition"
        >
          {value === "custom" ? "Свой период" : PERIOD_LABELS[value]}
          <span className="text-[11px] text-[var(--label-tertiary)]">▾</span>
        </button>
        <button
          type="button"
          onClick={() => openWith(true)}
          className="text-[15px] font-semibold tabular-nums text-[var(--label)] active:opacity-60 transition"
        >
          {formatFullRange(range.from, range.to)}
        </button>
      </div>

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
