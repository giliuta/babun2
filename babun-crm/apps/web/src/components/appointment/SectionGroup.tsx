"use client";

/**
 * SectionGroup — Variant B grouping wrapper for the appointment form.
 *
 * Renders an uppercase section header above a single bordered card, and
 * provides a context flag so that the SectionCard primitives nested
 * inside it skip their own border/min-height and render as hairline-
 * separated rows within this shared card.
 *
 * This turns the old "простыня" (each section its own bordered plashka)
 * into grouped iOS-style sections without touching the individual card
 * components.
 */

import { createContext, useContext, type ReactNode } from "react";

const GroupedContext = createContext(false);

/** True when the current SectionCard is rendered inside a SectionGroup. */
export const useGrouped = (): boolean => useContext(GroupedContext);

interface SectionGroupProps {
  /** Uppercase header shown above the grouped card. Optional. */
  title?: string;
  children: ReactNode;
}

export default function SectionGroup({ title, children }: SectionGroupProps) {
  return (
    <div className="px-4 pt-3.5">
      {title && (
        <div className="px-1 pb-1 text-[13px] font-semibold text-[var(--label-secondary)]">
          {title}
        </div>
      )}
      <GroupedContext.Provider value={true}>
        <div className="rounded-[14px] border border-[var(--separator)] bg-[var(--surface-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
          {children}
        </div>
      </GroupedContext.Provider>
    </div>
  );
}
