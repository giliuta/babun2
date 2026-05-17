"use client";

// STORY-060 §F1.1 — calendar FAB (mobile + tablet only).
//
// Bottom-right floating action button that opens a small popover with
// two choices: «Запись клиента» (kind=work) and «Личное событие»
// (kind=event). Hidden via `lg:hidden` on desktop where the user has
// the `N` keyboard shortcut + tap-on-empty-slot.
//
// v322 deliberately removed the FAB; this is the explicit re-add
// per the Sprint 060 brief.

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Users as UsersIcon, CalendarPlus } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";

export interface CalendarFabProps {
  /** Hide on agenda view, when onboarding card is showing, or when an
   *  inline sheet is open. Parent owns this state. */
  hidden?: boolean;
  /** Tap → open AppointmentSheet (kind=work). */
  onCreateWork: () => void;
  /** Tap → open PersonalEventSheet (kind=event). */
  onCreateEvent: () => void;
}

export default function CalendarFab({
  hidden,
  onCreateWork,
  onCreateEvent,
}: CalendarFabProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close when `hidden` flips true so a parent-driven hide doesn't
  // strand a stale popover.
  useEffect(() => {
    if (hidden && open) setOpen(false);
  }, [hidden, open]);

  // Outside-click + Escape close.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleToggle = useCallback(() => {
    haptic("select");
    setOpen((v) => !v);
  }, []);

  const handleWork = useCallback(() => {
    haptic("select");
    setOpen(false);
    onCreateWork();
  }, [onCreateWork]);

  const handleEvent = useCallback(() => {
    haptic("select");
    setOpen(false);
    onCreateEvent();
  }, [onCreateEvent]);

  if (hidden) return null;

  return (
    <div
      ref={wrapperRef}
      className="lg:hidden fixed z-40"
      style={{
        right: 16,
        bottom: "calc(env(safe-area-inset-bottom) + 88px)",
      }}
    >
      {/* Popover above the FAB */}
      {open && (
        <div
          role="menu"
          aria-label="Создать запись или событие"
          className="absolute bottom-full right-0 mb-3 w-[240px] bg-[var(--surface-card)] rounded-[14px] border border-[var(--separator)] shadow-[0_8px_24px_rgba(0,0,0,0.18)] overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleWork}
            className="w-full flex items-center gap-3 min-h-12 px-3 py-2.5 active:bg-[var(--fill-quaternary)] transition text-left"
          >
            <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
              <UsersIcon size={18} strokeWidth={2} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold text-[var(--label)] leading-tight">
                Запись клиента
              </span>
              <span className="block text-[12px] text-[var(--label-secondary)] mt-0.5 leading-tight">
                Услуга, мастер, оплата
              </span>
            </span>
          </button>
          <div className="h-px bg-[var(--separator)]" />
          <button
            type="button"
            role="menuitem"
            onClick={handleEvent}
            className="w-full flex items-center gap-3 min-h-12 px-3 py-2.5 active:bg-[var(--fill-quaternary)] transition text-left"
          >
            <span className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
              <CalendarPlus size={18} strokeWidth={2} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-semibold text-[var(--label)] leading-tight">
                Личное событие
              </span>
              <span className="block text-[12px] text-[var(--label-secondary)] mt-0.5 leading-tight">
                Встреча, обед, выезд
              </span>
            </span>
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Создать запись или событие"
        className="w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.25)] active:scale-95 transition"
      >
        <Plus
          size={26}
          strokeWidth={2.5}
          className="transition-transform"
          style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
        />
      </button>
    </div>
  );
}
