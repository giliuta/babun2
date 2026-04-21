"use client";

import { formatEUR, formatEURFromCents } from "@/lib/money";
import AnimatedNumber from "./AnimatedNumber";

type MoneySize = "sm" | "md" | "lg" | "xl" | "hero";

interface MoneyProps {
  // Value is in cents internally (see lib/money). Pass the stored cents.
  cents: number;
  size?: MoneySize;
  animate?: boolean;
  className?: string;
}

// Single place that decides how money looks everywhere. Tabular digits
// so numbers line up in reports, hero-size for the "earned today"
// widget, medium for detail screens, small for inline chips. If we ever
// switch currencies (Turkish lira edge-case in the SaaS future) all
// formatters update from one place.
const SIZES: Record<MoneySize, string> = {
  sm: "text-sm font-medium",
  md: "text-base font-semibold",
  lg: "text-xl font-semibold",
  xl: "text-2xl font-bold tracking-tight",
  hero: "text-[40px] leading-none font-bold tracking-tight",
};

export default function Money({
  cents,
  size = "md",
  animate = false,
  className = "",
}: MoneyProps) {
  const classes = `tabular-nums ${SIZES[size]} ${className}`;
  if (animate) {
    return (
      <AnimatedNumber
        value={cents}
        // `cents` is integer; divide inside the format callback so the
        // animation interpolates in the storage unit (avoids a visible
        // 100× jump on mount). `formatEUR` takes euros.
        format={(n) => formatEUR(Math.round(n / 100))}
        className={classes}
      />
    );
  }
  return <span className={classes}>{formatEURFromCents(cents)}</span>;
}
