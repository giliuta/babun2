"use client";

/**
 * SectionCard — outer bordered card wrapper for each appointment-form
 * section. Fixed min-height ensures the layout never shifts when content
 * transitions between empty/filled states.
 */

import type { ReactNode } from "react";
import { useGrouped } from "./SectionGroup";

interface SectionCardProps {
  children: ReactNode;
}

export default function SectionCard({ children }: SectionCardProps) {
  // Inside a SectionGroup the row renders bare — the group owns the
  // border, background and hairline separators. Standalone (default),
  // it keeps the original bordered plashka with fixed min-height.
  const grouped = useGrouped();
  if (grouped) return <>{children}</>;

  return (
    <div className="px-4 pt-3">
      <div
        className="rounded-[14px] border border-[var(--separator)] bg-[var(--surface-card)] shadow-[var(--shadow-card)] min-h-[76px]"
      >
        {children}
      </div>
    </div>
  );
}
