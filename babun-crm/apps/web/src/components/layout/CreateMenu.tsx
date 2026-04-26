"use client";

import { useEffect } from "react";
import {
  CalendarPlus,
  Receipt,
  CalendarHeart,
  MessagesSquare,
} from "@babun/shared/icons";

interface CreateMenuProps {
  open: boolean;
  onClose: () => void;
  onCreateAppointment: () => void;
  onCreateExpense: () => void;
  onCreateEvent: () => void;
  onCreateLead: () => void;
}

// Centered popup opened by the "+" trigger. One tap reaches the four
// most common write-paths so the dispatcher never hunts for "where
// do I add a visit?". Not a bottom-sheet on purpose — per the product
// rule every popup is centred on screen.
const ITEMS: {
  key: keyof Handlers;
  icon: React.ReactNode;
  label: string;
  hint: string;
  tile: string;
}[] = [
  {
    key: "appointment",
    icon: <CalendarPlus size={22} strokeWidth={2.25} />,
    label: "Запись",
    hint: "визит, работа, клиент",
    tile: "bg-[var(--tile-blue)]",
  },
  {
    key: "expense",
    icon: <Receipt size={22} strokeWidth={2.25} />,
    label: "Расход",
    hint: "бензин, материалы, обед",
    tile: "bg-[var(--tile-red)]",
  },
  {
    key: "event",
    icon: <CalendarHeart size={22} strokeWidth={2.25} />,
    label: "Событие",
    hint: "обед, личное, перерыв",
    tile: "bg-[var(--tile-orange)]",
  },
  {
    key: "lead",
    icon: <MessagesSquare size={22} strokeWidth={2.25} />,
    label: "Лид из чата",
    hint: "перенести обращение в запись",
    tile: "bg-[var(--tile-cyan)]",
  },
];

type Handlers = {
  appointment: () => void;
  expense: () => void;
  event: () => void;
  lead: () => void;
};

export default function CreateMenu({
  open,
  onClose,
  onCreateAppointment,
  onCreateExpense,
  onCreateEvent,
  onCreateLead,
}: CreateMenuProps) {
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

  const handlers: Handlers = {
    appointment: onCreateAppointment,
    expense: onCreateExpense,
    event: onCreateEvent,
    lead: onCreateLead,
  };

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-[var(--surface-overlay)] p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] bg-[var(--surface-card)] rounded-[14px] shadow-[var(--shadow-sheet)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-[var(--separator)] text-center">
          <div className="text-[13px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
            Создать
          </div>
        </div>
        <div className="divide-y divide-[var(--separator)]">
          {ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                handlers[item.key]();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[var(--fill-quaternary)] transition min-h-[56px]"
            >
              <span className={`w-9 h-9 rounded-[9px] flex items-center justify-center text-[var(--label-on-accent)] shrink-0 ${item.tile}`}>
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium text-[var(--label)]">
                  {item.label}
                </div>
                <div className="text-[12px] text-[var(--label-secondary)] truncate">
                  {item.hint}
                </div>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-[var(--label-tertiary)] shrink-0"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 text-[15px] font-medium text-[var(--accent)] border-t border-[var(--separator)] active:bg-[var(--fill-quaternary)] transition"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
