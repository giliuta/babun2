"use client";

import { useEffect, useState } from "react";
import DialogModal from "./DialogModal";
import WheelPicker from "./WheelPicker";

interface TimeWheelModalProps {
  open: boolean;
  onClose: () => void;
  value: string; // HH:MM
  onConfirm: (next: string) => void;
}

function parseTime(s: string): { hour: number; minute: number } {
  const [h, m] = s.split(":").map(Number);
  return {
    hour: Math.max(0, Math.min(23, isNaN(h) ? 0 : h)),
    minute: Math.max(0, Math.min(59, isNaN(m) ? 0 : m)),
  };
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export default function TimeWheelModal({
  open,
  onClose,
  value,
  onConfirm,
}: TimeWheelModalProps) {
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (open) {
      const p = parseTime(value);
      setHour(p.hour);
      setMinute(p.minute);
    }
  }, [open, value]);

  const handleConfirm = () => {
    const next = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    onConfirm(next);
    onClose();
  };

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
      <div className="p-3">
        <div className="flex items-stretch gap-3 justify-center">
          <WheelPicker
            values={HOURS}
            selectedIndex={hour}
            onChange={(i) => setHour(i)}
            className="w-20"
          />
          <div className="flex items-center text-2xl font-semibold text-gray-300">
            :
          </div>
          <WheelPicker
            values={MINUTES}
            selectedIndex={minute}
            onChange={(i) => setMinute(i)}
            className="w-20"
          />
        </div>
      </div>
    </DialogModal>
  );
}
