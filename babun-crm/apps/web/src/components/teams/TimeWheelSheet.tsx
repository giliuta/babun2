"use client";

import { useMemo } from "react";
import WheelColumn from "@/components/appointment/WheelColumn";

interface TimeWheelSheetProps {
  open: boolean;
  title: string;
  /** "range" shows two wheels (Начало / Конец); "single" shows one. */
  mode: "range" | "single";
  /** Current "HH:MM" value(s). For single mode only `start` is used. */
  start: string;
  end?: string;
  /** Minutes between options. Default 30. */
  step?: number;
  onClose: () => void;
  /** Fires live on every wheel change. For single mode `end === start`. */
  onChange: (start: string, end: string) => void;
}

const ITEM_HEIGHT = 36;

function buildOptions(step: number): string[] {
  const out: string[] = [];
  for (let m = 0; m <= 24 * 60; m += step) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out;
}

function toMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Index of the option matching `value`, or the closest one if `value`
// isn't on the step grid (so an odd stored "06:10" still lands sensibly).
function nearestIndex(options: string[], value: string): number {
  const target = toMinutes(value);
  let best = 0;
  let bestDiff = Infinity;
  options.forEach((opt, i) => {
    const diff = Math.abs(toMinutes(opt) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
}

export default function TimeWheelSheet({
  open,
  title,
  mode,
  start,
  end,
  step = 30,
  onClose,
  onChange,
}: TimeWheelSheetProps) {
  const options = useMemo(() => buildOptions(step), [step]);
  const startIdx = nearestIndex(options, start);
  const endIdx = nearestIndex(options, end ?? start);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-lg bg-[var(--surface-card)] rounded-t-[20px] shadow-[var(--shadow-sheet)] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[15px] font-semibold text-[var(--label)]">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[15px] font-semibold text-[var(--accent)] press-scale"
          >
            Готово
          </button>
        </div>

        <div className="relative flex items-stretch justify-center gap-8 py-1">
          {/* Center selection band sits behind the wheels. */}
          <div
            aria-hidden
            className="absolute left-2 right-2 rounded-[10px] bg-[var(--fill-tertiary)]"
            style={{
              height: ITEM_HEIGHT,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          {mode === "range" ? (
            <>
              <WheelSide label="Начало">
                <WheelColumn
                  items={options}
                  selectedIndex={startIdx}
                  onChange={(i) => onChange(options[i], end ?? options[i])}
                  width={76}
                  itemHeight={ITEM_HEIGHT}
                  loop={false}
                />
              </WheelSide>
              <WheelSide label="Конец">
                <WheelColumn
                  items={options}
                  selectedIndex={endIdx}
                  onChange={(i) => onChange(start, options[i])}
                  width={76}
                  itemHeight={ITEM_HEIGHT}
                  loop={false}
                />
              </WheelSide>
            </>
          ) : (
            <WheelColumn
              items={options}
              selectedIndex={startIdx}
              onChange={(i) => onChange(options[i], options[i])}
              width={76}
              itemHeight={ITEM_HEIGHT}
              loop={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function WheelSide({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[12px] font-medium text-[var(--label-secondary)]">
        {label}
      </span>
      <div className="relative">{children}</div>
    </div>
  );
}
