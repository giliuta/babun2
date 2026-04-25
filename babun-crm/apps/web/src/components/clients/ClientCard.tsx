"use client";

// STORY-034 — Collapsible card wrapper for one block on the client
// page.  Header has the block title + optional badge (e.g. count) +
// a chevron.  Tap toggles; open-state persists to localStorage via
// `babun-block-open:{kind}` so user's choice survives a reload.

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  getBlockOpen,
  setBlockOpen,
  type BlockKind,
} from "@/lib/business-blocks";
import { haptic } from "@/lib/haptics";

interface ClientCardProps {
  /** Kind drives the localStorage key for open-state persistence. */
  kind: BlockKind;
  title: string;
  /** Small badge to the right of the title — usually a count (e.g. 12). */
  badge?: React.ReactNode;
  /** Initial open state when no localStorage entry exists yet. */
  defaultOpen?: boolean;
  /** When the consumer wants to override persistence (e.g. ObjectsBlock
   *  forces open when locations.length > 1).  Setting this to true
   *  ignores the persisted "closed" state for the current render. */
  forceOpen?: boolean;
  children: React.ReactNode;
}

export default function ClientCard({
  kind,
  title,
  badge,
  defaultOpen = false,
  forceOpen,
  children,
}: ClientCardProps) {
  // Hydrate from localStorage after mount to avoid SSR/CSR mismatch.
  const [open, setOpen] = useState<boolean>(forceOpen ?? defaultOpen);

  useEffect(() => {
    if (forceOpen !== undefined) {
      setOpen(forceOpen);
      return;
    }
    setOpen(getBlockOpen(kind, defaultOpen));
  }, [kind, defaultOpen, forceOpen]);

  const toggle = () => {
    if (forceOpen !== undefined) return; // controlled mode
    haptic("light");
    setOpen((prev) => {
      const next = !prev;
      setBlockOpen(kind, next);
      return next;
    });
  };

  return (
    <div className="mx-3 mb-2 bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 h-11 active:bg-[var(--fill-quaternary)] transition"
      >
        <span className="flex-1 text-left text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] truncate">
          {title}
        </span>
        {badge !== undefined && badge !== null && (
          <span className="text-[12px] font-semibold text-[var(--label-tertiary)] tabular-nums">
            {badge}
          </span>
        )}
        <span
          className={`text-[var(--label-tertiary)] transition-transform shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        >
          <ChevronDown size={14} strokeWidth={2.5} />
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--separator)]">{children}</div>
      )}
    </div>
  );
}
