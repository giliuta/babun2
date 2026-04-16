"use client";

import { CITY_LIST } from "@/lib/day-cities";

interface CityPickerProps {
  value: string;
  onPick: (city: string) => void;
}

// Четыре кнопки городов. Активный — в цвете города.
export default function CityPicker({ value, onPick }: CityPickerProps) {
  return (
    <div className="px-4 py-3 bg-white border-b border-slate-100 grid grid-cols-2 gap-2">
      {CITY_LIST.map((c) => {
        const active = c.name === value;
        return (
          <button
            key={c.name}
            type="button"
            onClick={() => onPick(c.name)}
            className="h-11 rounded-xl border-2 text-[14px] font-semibold active:scale-[0.98] transition"
            style={{
              borderColor: active ? c.color : "#e2e8f0",
              background: active ? c.bg : "white",
              color: active ? c.color : "#475569",
            }}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
