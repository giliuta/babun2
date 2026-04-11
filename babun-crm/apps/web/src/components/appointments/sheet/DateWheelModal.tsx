"use client";

import { useEffect, useState } from "react";
import DialogModal from "./DialogModal";
import WheelPicker from "./WheelPicker";

interface DateWheelModalProps {
  open: boolean;
  onClose: () => void;
  value: string; // YYYY-MM-DD
  onConfirm: (next: string) => void;
}

const MONTHS_RU = [
  "Января", "Февраля", "Марта", "Апреля", "Мая", "Июня",
  "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря",
];

function daysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

function parseDate(s: string): { day: number; month: number; year: number } {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) {
    const n = new Date();
    return { day: n.getDate(), month: n.getMonth(), year: n.getFullYear() };
  }
  return { day: d, month: m - 1, year: y };
}

function formatDate(day: number, month: number, year: number): string {
  const max = daysInMonth(year, month);
  const d = Math.min(day, max);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function DateWheelModal({
  open,
  onClose,
  value,
  onConfirm,
}: DateWheelModalProps) {
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (open) {
      const p = parseDate(value);
      setDay(p.day);
      setMonth(p.month);
      setYear(p.year);
    }
  }, [open, value]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 2 + i);
  const maxDay = daysInMonth(year, month);
  const dayValues = Array.from({ length: 31 }, (_, i) => i + 1);

  // Clamp day if month/year change makes it invalid
  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [maxDay, day]);

  const handleConfirm = () => {
    onConfirm(formatDate(day, month, year));
    onClose();
  };

  return (
    <DialogModal
      open={open}
      onClose={onClose}
      title="Дата"
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
        <div className="flex items-stretch gap-1">
          <WheelPicker
            values={dayValues}
            selectedIndex={Math.min(day, maxDay) - 1}
            onChange={(i) => setDay(i + 1)}
            className="flex-[0.8]"
          />
          <WheelPicker
            values={MONTHS_RU}
            selectedIndex={month}
            onChange={(i) => setMonth(i)}
            className="flex-[1.4]"
          />
          <WheelPicker
            values={years}
            selectedIndex={Math.max(0, years.indexOf(year))}
            onChange={(i) => setYear(years[i])}
            className="flex-[1]"
          />
        </div>
      </div>
    </DialogModal>
  );
}
