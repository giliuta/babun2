"use client";

// Period control for /finances — name + dates split (mockup):
//  • tapping the semantic NAME opens a «Период» popup of paired
//    current/previous presets (День/Неделя/Месяц/Год × тек./прош.),
//    each showing its concrete range + a checkmark when active;
//  • tapping the DATES opens a «Свой период» popup with native from–to
//    inputs. Two separate popups, matching finances-design.html.

import { useState } from "react";
import {
  getPeriodRange,
  PERIOD_BLOCKS,
  PERIOD_LABELS,
  type PeriodKind,
  type PeriodRange,
} from "@/lib/finance/period";

const RU_MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function parseYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00`);
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function dmy(ymd: string): string {
  const d = parseYmd(ymd);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${String(d.getFullYear()).slice(2)}`;
}
function formatFullRange(from: string, to: string): string {
  return from === to ? dmy(from) : `${dmy(from)} – ${dmy(to)}`;
}

// Friendly short range hint for a preset row («1–30 июн», year → «2026»).
function presetHint(kind: PeriodKind, r: PeriodRange): string {
  const a = parseYmd(r.from);
  if (kind === "year" || kind === "lastyear") return String(a.getFullYear());
  const b = parseYmd(r.to);
  if (r.from === r.to) return `${a.getDate()} ${RU_MONTHS_SHORT[a.getMonth()]}`;
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear())
    return `${a.getDate()}–${b.getDate()} ${RU_MONTHS_SHORT[a.getMonth()]}`;
  return `${a.getDate()} ${RU_MONTHS_SHORT[a.getMonth()]} – ${b.getDate()} ${RU_MONTHS_SHORT[b.getMonth()]}`;
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
  const [presetOpen, setPresetOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [fromDate, setFromDate] = useState(range.from);
  const [toDate, setToDate] = useState(range.to);

  const openCustom = () => {
    setFromDate(range.from);
    setToDate(range.to);
    setCustomOpen(true);
  };

  const pickPreset = (k: PeriodKind) => {
    onChange(k);
    setPresetOpen(false);
  };

  const applyCustom = () => {
    if (!fromDate || !toDate) return;
    const lo = fromDate <= toDate ? fromDate : toDate;
    const hi = fromDate <= toDate ? toDate : fromDate;
    onCustomRange({ from: lo, to: hi });
    setCustomOpen(false);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 py-0.5">
        <button
          type="button"
          onClick={() => setPresetOpen(true)}
          className="inline-flex items-center gap-1 text-[16px] font-semibold text-[var(--label)] active:opacity-60 transition"
        >
          {value === "custom" ? "Свой период" : PERIOD_LABELS[value]}
          <span className="text-[11px] text-[var(--label-tertiary)]">▾</span>
        </button>
        <button
          type="button"
          onClick={openCustom}
          className="text-[15px] font-semibold tabular-nums text-[var(--label)] active:opacity-60 transition"
        >
          {formatFullRange(range.from, range.to)}
        </button>
      </div>

      {presetOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[var(--surface-overlay)] backdrop-blur-[2px]"
          onClick={() => setPresetOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-[var(--surface-card)] rounded-[18px] overflow-hidden shadow-[var(--shadow-sheet)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-3.5 pb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
              Период
            </div>
            <div className="px-3 pb-3 space-y-2">
              {PERIOD_BLOCKS.map(([cur, prev]) => (
                <div key={cur} className="bg-[var(--fill-tertiary)] rounded-[12px] overflow-hidden">
                  {[cur, prev].map((k, i) => {
                    const r = getPeriodRange({ kind: k });
                    const active = value === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => pickPreset(k)}
                        aria-pressed={active}
                        className={`w-full flex items-center gap-2 px-3.5 h-12 active:bg-[var(--fill-quaternary)] transition-colors ${
                          i > 0 ? "border-t border-[var(--separator)]" : ""
                        }`}
                      >
                        <span
                          className={`text-[15px] ${
                            active
                              ? "text-[var(--accent)] font-semibold"
                              : "text-[var(--label)]"
                          }`}
                        >
                          {PERIOD_LABELS[k]}
                        </span>
                        <span className="ml-auto text-[13px] tabular-nums text-[var(--label-tertiary)]">
                          {presetHint(k, r)}
                        </span>
                        {active && <span className="text-[var(--accent)]">✓</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {customOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[var(--surface-overlay)] backdrop-blur-[2px]"
          onClick={() => setCustomOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-[var(--surface-card)] rounded-[18px] overflow-hidden shadow-[var(--shadow-sheet)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-3.5 pb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)]">
              Свой период
            </div>
            <div className="px-4 pb-4 pt-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[var(--label-secondary)] w-6">С</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="flex-1 h-10 px-3 bg-[var(--fill-tertiary)] rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[var(--label-secondary)] w-6">По</span>
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
          </div>
        </div>
      )}
    </>
  );
}
