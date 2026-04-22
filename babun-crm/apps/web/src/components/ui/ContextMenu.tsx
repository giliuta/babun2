"use client";

import { useEffect, useMemo, type ReactNode } from "react";

export interface ContextMenuOption {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  open: boolean;
  onClose: () => void;
  /** Viewport-relative coordinates where the long-press landed. The menu
   *  anchors its top-left near this point and flips/shifts to stay
   *  inside the viewport. */
  anchor: { x: number; y: number } | null;
  /** Optional title shown above the actions. Short city/item name. */
  title?: string;
  options: ContextMenuOption[];
}

// Telegram-style anchored context menu. Opens near the long-press point
// rather than as a bottom sheet. Backdrop is lightly dimmed and
// dismisses on any outside pointer event; individual options dismiss
// on tap. Stays fully inside the viewport (flips above / clamps
// horizontally when near edges).
const MENU_WIDTH = 236;
const ROW_HEIGHT = 48;
const TITLE_HEIGHT = 34;
const GUTTER = 12;

export default function ContextMenu({
  open,
  onClose,
  anchor,
  title,
  options,
}: ContextMenuProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const position = useMemo(() => {
    if (!anchor || typeof window === "undefined") {
      return { top: 0, left: 0, origin: "top left" as const };
    }
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const menuHeight =
      options.length * ROW_HEIGHT + (title ? TITLE_HEIGHT : 0);

    let top = anchor.y + 4;
    let vertical: "top" | "bottom" = "top";
    // Flip above the finger if there's not enough room below.
    if (top + menuHeight > vh - GUTTER) {
      top = Math.max(GUTTER, anchor.y - menuHeight - 4);
      vertical = "bottom";
    }

    let left = anchor.x - 20;
    let horizontal: "left" | "right" = "left";
    if (left + MENU_WIDTH > vw - GUTTER) {
      left = vw - MENU_WIDTH - GUTTER;
      horizontal = "right";
    }
    if (left < GUTTER) left = GUTTER;

    return {
      top,
      left,
      origin: `${vertical} ${horizontal}` as const,
    };
  }, [anchor, options.length, title]);

  if (!open || !anchor) return null;

  return (
    <div
      className="fixed inset-0 z-[70] bg-[rgba(0,0,0,0.18)] backdrop-blur-[1px]"
      style={{ animation: "fadeIn 120ms ease-out both" }}
      onPointerDown={onClose}
    >
      <div
        role="menu"
        style={{
          top: position.top,
          left: position.left,
          width: MENU_WIDTH,
          transformOrigin: position.origin,
          animation: "ctxMenuIn 140ms cubic-bezier(0.2, 0.9, 0.35, 1.05) both",
        }}
        className="absolute bg-[var(--surface-card)] rounded-[13px] shadow-[0_10px_28px_rgba(0,0,0,0.18),0_1px_0_rgba(0,0,0,0.04)] overflow-hidden"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-3.5 py-2 border-b border-[var(--separator)] text-[12px] font-semibold text-[var(--label-secondary)] truncate">
            {title}
          </div>
        )}
        <div className="divide-y divide-[var(--separator)]">
          {options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                opt.onSelect();
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3.5 h-12 text-left active:bg-[var(--fill-quaternary)] transition ${
                opt.danger ? "text-[var(--system-red)]" : "text-[var(--label)]"
              }`}
            >
              <span className="flex-1 text-[15px] font-normal truncate">
                {opt.label}
              </span>
              {opt.icon && (
                <span
                  className={`shrink-0 ${
                    opt.danger
                      ? "text-[var(--system-red)]"
                      : "text-[var(--label-secondary)]"
                  }`}
                >
                  {opt.icon}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
