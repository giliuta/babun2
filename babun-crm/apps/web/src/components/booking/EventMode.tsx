"use client";

import { useState } from "react";
import type { EventPreset } from "@/lib/event-presets";
import { EVENT_PRESETS } from "@/lib/event-presets";

interface EventModeProps {
  onSave: (label: string, preset: EventPreset) => void;
  onCancel: () => void;
  timeLabel: string;
  dateLabel: string;
  teamLabel: string;
}

// Режим создания личного события бригады. 5 пресетов в сетке 3×2,
// одно текстовое поле «Название» (редактируемое). Без клиента,
// без услуги, без SMS, без суммы. Pешает проблему, когда бригада
// не на выезде а на обеде / в отпуске / на встрече.
export default function EventMode({
  onSave,
  onCancel,
  timeLabel,
  dateLabel,
  teamLabel,
}: EventModeProps) {
  const [preset, setPreset] = useState<EventPreset | null>(null);
  const [label, setLabel] = useState("");

  const handlePick = (p: EventPreset) => {
    setPreset(p);
    setLabel(p.label);
  };

  const handleSave = () => {
    if (!preset) return;
    const finalLabel = label.trim() || preset.label;
    onSave(finalLabel, preset);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Context chip */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
        <div className="text-[11px] text-slate-500">
          {dateLabel} · {timeLabel} · <span className="font-semibold">{teamLabel}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Тип события
          </div>
          <div className="grid grid-cols-3 gap-2">
            {EVENT_PRESETS.map((p) => {
              const active = preset?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePick(p)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border-2 transition active:scale-[0.98] ${
                    active ? "border-violet-600 bg-violet-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: `${p.color}22`, color: p.color }}
                  >
                    <EventIcon icon={p.icon} />
                  </div>
                  <div className="text-[12px] font-semibold text-slate-800 truncate max-w-full px-1">
                    {p.label}
                  </div>
                  <div className="text-[10px] text-slate-500 tabular-nums">
                    {p.allDay
                      ? "весь день"
                      : `${p.duration} мин`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {preset && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Название
            </div>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={preset.label}
              className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-[15px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="text-[11px] text-slate-400 mt-1.5">
              Событие заблокирует слот только для бригады {teamLabel}.
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div
        className="flex-shrink-0 px-4 pt-2 bg-white border-t border-slate-200 flex gap-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)" }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-12 rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-700 active:bg-slate-50"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!preset}
          className="flex-[2] h-12 rounded-xl bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.99] transition disabled:bg-slate-300 disabled:text-slate-500"
        >
          {preset ? "Создать событие" : "Выберите тип"}
        </button>
      </div>
    </div>
  );
}

function EventIcon({ icon }: { icon: EventPreset["icon"] }) {
  switch (icon) {
    case "coffee":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 8h1a4 4 0 010 8h-1" />
          <path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      );
    case "briefcase":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
        </svg>
      );
    case "navigation":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      );
    case "moon":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      );
    case "plane":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </svg>
      );
  }
}
