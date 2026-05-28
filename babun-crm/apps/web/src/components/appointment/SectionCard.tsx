"use client";

/**
 * SectionCard — outer bordered card wrapper for each appointment-form
 * section. Fixed min-height ensures the layout never shifts when content
 * transitions between empty/filled states.
 */

import type { ReactNode } from "react";

interface SectionCardProps {
  children: ReactNode;
}

export default function SectionCard({ children }: SectionCardProps) {
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
