"use client";

import { useEffect } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  /** Высота sheet в vh. По спеке — 85%. */
  heightVh?: number;
  /** Если true — прячет backdrop (для nested sub-sheets). */
  transparentBackdrop?: boolean;
  children: React.ReactNode;
}

// Базовый bottom sheet для booking-флоу.
// Rounded-t-3xl, grabber полоска, backdrop с blur, безопасная зона.
// Swipe-down-to-dismiss не реализован здесь (не было в acceptance);
// закрытие по backdrop tap и ESC.
export default function BottomSheet({
  open,
  onClose,
  heightVh = 85,
  transparentBackdrop,
  children,
}: BottomSheetProps) {
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

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-end justify-center ${
        transparentBackdrop
          ? "bg-transparent pointer-events-none"
          : "bg-black/40 backdrop-blur-[2px]"
      }`}
      onClick={transparentBackdrop ? undefined : onClose}
    >
      <div
        className="w-full lg:max-w-lg bg-white rounded-t-3xl lg:rounded-3xl lg:mb-8 shadow-2xl flex flex-col pointer-events-auto"
        style={{ height: `${heightVh}vh` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
