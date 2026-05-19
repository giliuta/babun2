"use client";

// Brief 1 #10 — Floating color legend for the calendar.
//
// The auto-color system (see getAppointmentColorKind in shared/local/
// appointments.ts) maps an appointment's status, kind, address, and
// property type to one of ~9 colors. Without a key the colors are
// "pretty but mysterious"; this widget gives the dispatcher a one-tap
// reference.
//
// Collapsed: a small floating ⓘ button in the bottom-right of the
// calendar. Tap to open a centered popover with the 5 most-meaningful
// colors. Click outside / Esc to close. Hidden on mobile (`md:` and up
// only) — the touch user has the empty-slot tap + the AppointmentSheet
// for context, and screen real estate is precious; the desktop user
// is more likely scanning weeks at a glance and benefits from the key.

import { useEffect, useState } from "react";
import { Info, X } from "@babun/shared/icons";

interface LegendItem {
  swatch: string;        // tailwind bg-* token
  label: string;         // RU
  hint: string;          // RU one-liner
}

const ITEMS: LegendItem[] = [
  {
    swatch: "bg-[var(--accent)]",
    label: "Записан",
    hint: "Запланировано, адрес есть.",
  },
  {
    swatch: "bg-[var(--system-green)]",
    label: "В работе",
    hint: "Команда уже на месте.",
  },
  {
    swatch: "bg-[var(--system-yellow)]",
    label: "Нет адреса",
    hint: "Запросите адрес у клиента.",
  },
  {
    swatch: "bg-[var(--system-orange)]",
    label: "Коммерция",
    hint: "Офис/ресторан/магазин — другая лестница, проверьте оборудование.",
  },
  {
    swatch: "bg-[var(--system-red)]",
    label: "Отменена",
    hint: "Клиент отказался.",
  },
  {
    swatch: "bg-[var(--fill-tertiary)]",
    label: "Личное событие",
    hint: "Обед, перерыв, заметка для команды.",
  },
];

export default function CalendarLegend() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // STORY audit: ранее CalendarLegend жил только на десктопе
  // (hidden md:block). На phone цвета записей оставались "тайными"
  // для нового диспетчера. Теперь компонент рендерится на всех
  // размерах — на мобиле кнопка-подсказка просто прячется под FAB
  // и BottomTabBar (z-30 vs FAB z-40, поэтому FAB перекрывает её,
  // но при открытой легенде ⓘ → popover видны). На широком экране
  // legend стоит в углу как раньше.
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Цветовая легенда"
        title="Цветовая легенда"
        // На phone стоит чуть левее FAB чтобы не накладываться.
        // lg:right-4 — на десктопе bottom-right как раньше.
        className="fixed bottom-[176px] right-4 lg:bottom-4 z-30 w-11 h-11 rounded-full bg-[var(--surface-card)] border border-[var(--separator)] shadow-md text-[var(--label-secondary)] active:scale-[0.95] flex items-center justify-center transition"
      >
        <Info size={18} strokeWidth={2.2} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Цветовая легенда календаря"
            // STORY audit (reviewer fix): popover sat at bottom-16 (64 px)
            // and reached ~352 px upward — that's ABOVE the FAB at ~166 px
            // from bottom, so на mobile popover буквально закрывал FAB.
            // Поднимаем popover чуть выше кнопки ⓘ на phone (bottom-[226px]),
            // на desktop остаётся bottom-16 как раньше.
            className="fixed bottom-[226px] right-4 lg:bottom-16 z-50 w-72 max-w-[calc(100vw-32px)] bg-[var(--surface-card)] border border-[var(--separator)] rounded-2xl shadow-xl p-3"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Цвета записей
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="w-7 h-7 rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] flex items-center justify-center"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
            <ul className="space-y-2">
              {ITEMS.map((item) => (
                <li
                  key={item.label}
                  className="flex items-start gap-2 px-1 py-1"
                >
                  <span
                    aria-hidden
                    className={`w-3.5 h-3.5 rounded-full mt-0.5 shrink-0 ${item.swatch}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold text-[var(--label)]">
                      {item.label}
                    </span>
                    <span className="block text-[11px] leading-snug text-[var(--label-secondary)]">
                      {item.hint}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
