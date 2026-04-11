"use client";

import { useEffect, useState } from "react";
import DialogModal from "@/components/appointments/sheet/DialogModal";
import { CITY_PRESETS } from "@/lib/day-cities";

interface CityPickerModalProps {
  open: boolean;
  onClose: () => void;
  current: string; // current city (assigned or default)
  defaultCity: string; // team's base city — shown as "по умолчанию"
  onPick: (city: string) => void;
  onReset: () => void; // clear the override, fall back to team default
}

// Small modal to assign a city to a specific calendar day for the active
// team. Presets come from Cyprus' main cities; a custom value is allowed.
export default function CityPickerModal({
  open,
  onClose,
  current,
  defaultCity,
  onPick,
  onReset,
}: CityPickerModalProps) {
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (open) setCustom("");
  }, [open]);

  const handlePick = (city: string) => {
    onPick(city);
    onClose();
  };

  const handleCustom = () => {
    const v = custom.trim();
    if (!v) return;
    handlePick(v);
  };

  const handleResetClick = () => {
    onReset();
    onClose();
  };

  return (
    <DialogModal open={open} onClose={onClose} title="Город на день">
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {CITY_PRESETS.map((city) => {
            const selected = city === current;
            return (
              <button
                key={city}
                type="button"
                onClick={() => handlePick(city)}
                className={`h-11 rounded-lg border-2 text-[13px] font-medium active:scale-[0.98] transition ${
                  selected
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                {city}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Свой город"
            className="flex-1 h-11 px-3 bg-gray-100 rounded-lg text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={handleCustom}
            disabled={!custom.trim()}
            className="h-11 px-4 bg-indigo-600 text-white rounded-lg text-[13px] font-semibold disabled:opacity-40"
          >
            OK
          </button>
        </div>

        {current !== defaultCity && (
          <button
            type="button"
            onClick={handleResetClick}
            className="w-full h-10 text-[12px] font-medium text-gray-600 bg-gray-100 rounded-lg active:scale-[0.98]"
          >
            Сбросить к «{defaultCity || "—"}»
          </button>
        )}
      </div>
    </DialogModal>
  );
}
