"use client";

// v809 — in-place С/До range picker built on the existing iOS wheel
// column (components/appointment/WheelColumn). Day / month / year wheels
// for whichever endpoint (from/to) is active. Auto-swaps if from > to on
// apply.

import { useMemo, useState } from "react";
import WheelColumn from "@/components/appointment/WheelColumn";
import { haptic } from "@/lib/haptics";

const M_NOM = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const M_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

interface DateParts {
  y: number;
  m: number; // 0-based
  d: number;
}

interface DateRangeWheelProps {
  /** Initial range; defaults to a sensible 1-month window when null. */
  initialFrom: string | null;
  initialTo: string | null;
  onApply: (from: string, to: string) => void;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function ymd(p: DateParts): string {
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
}
function parse(key: string | null, fallback: DateParts): DateParts {
  if (!key) return fallback;
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return fallback;
  return { y, m: m - 1, d };
}
function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}
function shortLabel(p: DateParts): string {
  return `${p.d} ${M_SHORT[p.m]} ${p.y}`;
}

export function DateRangeWheel({
  initialFrom,
  initialTo,
  onApply,
}: DateRangeWheelProps) {
  const today = useMemo(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
  }, []);
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
  }, []);

  const [from, setFrom] = useState<DateParts>(() => parse(initialFrom, monthAgo));
  const [to, setTo] = useState<DateParts>(() => parse(initialTo, today));
  const [active, setActive] = useState<"from" | "to">("from");

  const years = useMemo(() => {
    const base = today.y;
    const list: number[] = [];
    for (let y = base - 6; y <= base + 4; y++) list.push(y);
    return list;
  }, [today.y]);

  const cur = active === "from" ? from : to;
  const setCur = active === "from" ? setFrom : setTo;
  const maxDay = daysInMonth(cur.y, cur.m);

  const dayItems = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => String(i + 1)),
    [maxDay],
  );
  const yearItems = useMemo(() => years.map((y) => String(y)), [years]);

  const setDay = (idx: number) => {
    setCur((p) => ({ ...p, d: Math.min(idx + 1, daysInMonth(p.y, p.m)) }));
  };
  const setMonth = (idx: number) => {
    setCur((p) => ({ ...p, m: idx, d: Math.min(p.d, daysInMonth(p.y, idx)) }));
  };
  const setYear = (idx: number) => {
    const y = years[idx] ?? cur.y;
    setCur((p) => ({ ...p, y, d: Math.min(p.d, daysInMonth(y, p.m)) }));
  };

  const handleApply = () => {
    haptic("tap");
    let a = ymd(from);
    let b = ymd(to);
    if (a > b) {
      const t = a;
      a = b;
      b = t;
    }
    onApply(a, b);
  };

  const dayIdx = Math.min(cur.d - 1, maxDay - 1);
  const yearIdx = Math.max(0, years.indexOf(cur.y));

  return (
    <div className="pt-1">
      {/* С / До segmented control */}
      <div className="flex gap-1 bg-[var(--fill-tertiary)] rounded-[13px] p-[3px] mb-3">
        {(["from", "to"] as const).map((side) => {
          const on = active === side;
          const val = side === "from" ? from : to;
          return (
            <button
              key={side}
              type="button"
              onClick={() => {
                haptic("tap");
                setActive(side);
              }}
              className={`flex-1 h-12 rounded-[10px] flex flex-col items-center justify-center gap-0.5 transition ${
                on ? "bg-[var(--surface-card)] shadow-[var(--shadow-card)]" : ""
              }`}
            >
              <span
                className={`text-[11px] font-semibold ${
                  on ? "text-[var(--accent)]" : "text-[var(--label-tertiary)]"
                }`}
              >
                {side === "from" ? "С" : "До"}
              </span>
              <span className="text-[14px] font-bold text-[var(--label)] tabular-nums">
                {shortLabel(val)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Wheels for the active endpoint */}
      <div className="relative flex items-center justify-center gap-1">
        <div
          className="pointer-events-none absolute left-3 right-3 top-1/2 -translate-y-1/2 h-[34px] rounded-[8px] bg-[var(--fill-quaternary)]"
          aria-hidden
        />
        <div className="relative flex items-center justify-center gap-1">
          <WheelColumn
            items={dayItems}
            selectedIndex={dayIdx}
            onChange={setDay}
            width={56}
            loop={false}
          />
          <WheelColumn
            items={M_NOM}
            selectedIndex={cur.m}
            onChange={setMonth}
            width={120}
            loop={false}
          />
          <WheelColumn
            items={yearItems}
            selectedIndex={yearIdx}
            onChange={setYear}
            width={74}
            loop={false}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleApply}
        className="mt-3 w-full h-12 rounded-[12px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] transition press-scale"
      >
        Применить
      </button>
    </div>
  );
}
