"use client";

import { useEffect, useState } from "react";
import DialogModal from "./DialogModal";
import WheelPicker from "./WheelPicker";

interface TimeWheelModalProps {
  open: boolean;
  onClose: () => void;
  startValue: string; // HH:MM
  endValue: string; // HH:MM
  onConfirm: (next: { startValue: string; endValue: string }) => void;
}

function parseTime(s: string): { hour: number; minute: number } {
  const [h, m] = s.split(":").map(Number);
  return {
    hour: Math.max(0, Math.min(23, isNaN(h) ? 0 : h)),
    minute: Math.max(0, Math.min(59, isNaN(m) ? 0 : m)),
  };
}

function toMinutes(h: number, m: number): number {
  return h * 60 + m;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

// Compact wheel column — 3 visible items, 38 px tall, so two stacked
// time rows fit comfortably in the popup.
const SMALL_ITEM_HEIGHT = 38;
const SMALL_VISIBLE = 3;

export default function TimeWheelModal({
  open,
  onClose,
  startValue,
  endValue,
  onConfirm,
}: TimeWheelModalProps) {
  const [startHour, setStartHour] = useState(0);
  const [startMin, setStartMin] = useState(0);
  const [endHour, setEndHour] = useState(0);
  const [endMin, setEndMin] = useState(0);

  useEffect(() => {
    if (open) {
      const s = parseTime(startValue);
      const e = parseTime(endValue);
      setStartHour(s.hour);
      setStartMin(s.minute);
      setEndHour(e.hour);
      setEndMin(e.minute);
    }
  }, [open, startValue, endValue]);

  // Ensure end time is always after start time when start is moved.
  const handleStartChange = (h: number, m: number) => {
    setStartHour(h);
    setStartMin(m);
    if (toMinutes(h, m) >= toMinutes(endHour, endMin)) {
      // Push end one hour ahead, clamped to 23:59
      const total = toMinutes(h, m) + 60;
      const nh = Math.min(23, Math.floor(total / 60));
      const nm = total >= 24 * 60 ? 59 : total % 60;
      setEndHour(nh);
      setEndMin(nm);
    }
  };

  const handleConfirm = () => {
    const sh = String(startHour).padStart(2, "0");
    const sm = String(startMin).padStart(2, "0");
    const eh = String(endHour).padStart(2, "0");
    const em = String(endMin).padStart(2, "0");
    onConfirm({ startValue: `${sh}:${sm}`, endValue: `${eh}:${em}` });
    onClose();
  };

  const startLabel = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
  const endLabel = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title="Время"
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full h-12 bg-indigo-600 text-white rounded-xl font-semibold text-[14px] active:scale-[0.98] transition"
        >
          Готово
        </button>
      }
    >
      <div className="p-3 space-y-3">
        {/* Summary */}
        <div className="bg-indigo-50 rounded-xl py-2.5 px-4 flex items-center justify-center gap-2 text-indigo-900">
          <span className="text-[11px] uppercase tracking-wider text-indigo-500">с</span>
          <span className="text-[18px] font-bold tabular-nums">{startLabel}</span>
          <span className="text-[16px] text-indigo-400 mx-1">→</span>
          <span className="text-[11px] uppercase tracking-wider text-indigo-500">до</span>
          <span className="text-[18px] font-bold tabular-nums">{endLabel}</span>
        </div>

        {/* Начало */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 px-0.5">
            Начало
          </div>
          <div className="flex items-center justify-center gap-2 bg-gray-50 rounded-xl py-1">
            <WheelPicker
              values={HOURS}
              selectedIndex={startHour}
              onChange={(i) => handleStartChange(i, startMin)}
              className="w-14"
              itemHeight={SMALL_ITEM_HEIGHT}
              visibleCount={SMALL_VISIBLE}
            />
            <div className="text-[18px] font-bold text-gray-400">:</div>
            <WheelPicker
              values={MINUTES}
              selectedIndex={startMin}
              onChange={(i) => handleStartChange(startHour, i)}
              className="w-14"
              itemHeight={SMALL_ITEM_HEIGHT}
              visibleCount={SMALL_VISIBLE}
            />
          </div>
        </div>

        {/* Конец */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1 px-0.5">
            Конец
          </div>
          <div className="flex items-center justify-center gap-2 bg-gray-50 rounded-xl py-1">
            <WheelPicker
              values={HOURS}
              selectedIndex={endHour}
              onChange={(i) => setEndHour(i)}
              className="w-14"
              itemHeight={SMALL_ITEM_HEIGHT}
              visibleCount={SMALL_VISIBLE}
            />
            <div className="text-[18px] font-bold text-gray-400">:</div>
            <WheelPicker
              values={MINUTES}
              selectedIndex={endMin}
              onChange={(i) => setEndMin(i)}
              className="w-14"
              itemHeight={SMALL_ITEM_HEIGHT}
              visibleCount={SMALL_VISIBLE}
            />
          </div>
        </div>
      </div>
    </DialogModal>
  );
}
