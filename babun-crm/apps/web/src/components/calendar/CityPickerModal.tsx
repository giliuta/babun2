"use client";

import { useEffect } from "react";
import { CITY_LIST, getCityConfig } from "@/lib/day-cities";

interface CityPickerModalProps {
  open: boolean;
  onClose: () => void;
  current: string;
  defaultCity: string;
  /** ISO date key "YYYY-MM-DD" of the day being edited (for the header). */
  dateKey?: string;
  onPick: (city: string) => void;
  onReset: () => void;
}

// Bottom sheet по спеке: «Куда едет бригада?» + 4 кнопки городов
// с MapPin иконкой и цветной плашкой, плюс «Сбросить» внизу.
export default function CityPickerModal({
  open,
  onClose,
  current,
  defaultCity,
  dateKey,
  onPick,
  onReset,
}: CityPickerModalProps) {
  // ESC + body-scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handlePick = (city: string) => {
    onPick(city);
    onClose();
  };

  const handleResetClick = () => {
    onReset();
    onClose();
  };

  const dateLabel = dateKey
    ? (() => {
        const [y, m, d] = dateKey.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
          weekday: "short",
          day: "numeric",
          month: "long",
        });
      })()
    : "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full lg:max-w-md bg-white rounded-t-3xl lg:rounded-3xl lg:mb-8 pb-8 shadow-2xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 32px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="flex justify-center pt-2">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-1">
          {dateLabel && (
            <p className="text-[13px] text-slate-500 capitalize">
              {dateLabel}
            </p>
          )}
          <h2 className="text-[18px] font-semibold text-slate-900 mt-0.5">
            Куда едет бригада?
          </h2>
        </div>

        {/* City list */}
        <div className="px-3 mt-3 space-y-2">
          {CITY_LIST.map((c) => {
            const active = c.name === current;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => handlePick(c.name)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition active:scale-[0.99]"
                style={{
                  borderColor: active ? c.color : "#e2e8f0",
                  background: active ? c.bg : "white",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: c.bg }}
                  >
                    {/* MapPin */}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill={c.color}
                      stroke={c.color}
                      strokeWidth="2"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" fill="white" stroke="none" />
                    </svg>
                  </div>
                  <div
                    className="font-semibold text-[15px] text-left"
                    style={{ color: active ? c.color : "#0f172a" }}
                  >
                    {c.name}
                  </div>
                </div>
                {active && (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={c.color}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Reset to team default */}
        {defaultCity && current !== defaultCity && (
          <div className="px-3 mt-3">
            <button
              type="button"
              onClick={handleResetClick}
              className="w-full h-11 text-[13px] font-medium text-slate-600 bg-slate-100 rounded-xl active:scale-[0.99]"
            >
              Сбросить к «{getCityConfig(defaultCity)?.name ?? defaultCity}»
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
