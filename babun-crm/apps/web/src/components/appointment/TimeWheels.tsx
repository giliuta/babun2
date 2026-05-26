"use client";

import WheelColumn from "./WheelColumn";
import { HOURS } from "@/lib/time-block-utils";

// Shared iOS-style time wheel used by both the appointment time popup
// (UnifiedTimePopup) and the brigade calendar settings popup, so the two
// drums look pixel-identical. A WheelSide is one labeled часы:минуты pair.

export const ITEM_HEIGHT = 40;
export const VISIBLE_ROWS = 3;
export const COLUMN_WIDTH = 58;
export const DIGIT_FONT = 26;
export const WHEEL_H = ITEM_HEIGHT * VISIBLE_ROWS;
export const PAD = (WHEEL_H - ITEM_HEIGHT) / 2;

export function WheelSide({
  label,
  minutes,
  hourIdx,
  minIdx,
  onHour,
  onMin,
}: {
  label?: string;
  minutes: string[];
  hourIdx: number;
  minIdx: number;
  onHour: (idx: number) => void;
  onMin: (idx: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {label && (
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
          {label}
        </span>
      )}
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
