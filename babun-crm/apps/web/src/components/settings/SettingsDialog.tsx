"use client";

import { useState } from "react";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

type FontSize = "small" | "medium" | "large";

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  small: "Мелкий",
  medium: "Средний",
  large: "Крупный",
};

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const [appointmentFontSize, setAppointmentFontSize] = useState<FontSize>("medium");
  const [timeFontSize, setTimeFontSize] = useState<FontSize>("medium");
  const [use12HourFormat, setUse12HourFormat] = useState(false);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<"monday" | "sunday">("monday");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--surface-card)] rounded-xl shadow-lg w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--accent)] text-[var(--label-on-accent)] px-4 py-3 flex items-center gap-2">
          <h2 className="flex-1 text-base font-semibold">Настройки</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--accent-tint)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Account */}
          <div>
            <div className="text-xs font-semibold text-[var(--label-tertiary)] uppercase mb-2">
              Учетная запись
            </div>
            <div className="px-3 py-2 bg-[var(--fill-tertiary)] border border-[var(--separator)] rounded-lg text-sm text-[var(--label-secondary)]">
              airfix.cy@gmail.com
            </div>
          </div>

          {/* Appointment font size */}
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1">
              Размер шрифта в записях
            </label>
            <select
              value={appointmentFontSize}
              onChange={(e) => setAppointmentFontSize(e.target.value as FontSize)}
              className="w-full px-3 py-2 border border-[var(--separator)] rounded-lg text-sm text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent bg-[var(--surface-card)]"
            >
              {(Object.keys(FONT_SIZE_LABELS) as FontSize[]).map((size) => (
                <option key={size} value={size}>
                  {FONT_SIZE_LABELS[size]}
                </option>
              ))}
            </select>
          </div>

          {/* Time font size */}
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1">
              Размер шрифта времени
            </label>
            <select
              value={timeFontSize}
              onChange={(e) => setTimeFontSize(e.target.value as FontSize)}
              className="w-full px-3 py-2 border border-[var(--separator)] rounded-lg text-sm text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent bg-[var(--surface-card)]"
            >
              {(Object.keys(FONT_SIZE_LABELS) as FontSize[]).map((size) => (
                <option key={size} value={size}>
                  {FONT_SIZE_LABELS[size]}
                </option>
              ))}
            </select>
          </div>

          {/* 12-hour format toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--label)]">
              12-часовой формат времени
            </label>
            <button
              type="button"
              onClick={() => setUse12HourFormat(!use12HourFormat)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                use12HourFormat ? "bg-[var(--accent)]" : "bg-[var(--fill-primary)]"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-[var(--surface-card)] rounded-full shadow transition-transform ${
                  use12HourFormat ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* First day of week */}
          <div>
            <label className="block text-sm font-medium text-[var(--label)] mb-1">
              Первый день недели
            </label>
            <select
              value={firstDayOfWeek}
              onChange={(e) => setFirstDayOfWeek(e.target.value as "monday" | "sunday")}
              className="w-full px-3 py-2 border border-[var(--separator)] rounded-lg text-sm text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent bg-[var(--surface-card)]"
            >
              <option value="monday">Понедельник</option>
              <option value="sunday">Воскресенье</option>
            </select>
          </div>
        </div>

        {/* Bottom */}
        <div className="px-4 py-3 border-t border-[var(--separator)] flex items-center">
          <button
            onClick={onClose}
            className="flex-1 text-center text-sm text-[var(--label-secondary)] hover:text-[var(--label)]"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
