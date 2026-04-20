"use client";

import type { ClientSegment } from "@/lib/clients";

interface ClientStatusDotProps {
  segments: ClientSegment[];
  size?: number;
  className?: string;
}

// One authoritative dot — first matching segment wins priority. Red for
// debtors (critical), amber for lost, green for active, sky for new,
// slate for sleeping. Zero-booking clients get no dot so they don't add
// visual noise in the list.
//
// Keep priority in sync with the visual meaning: debt > lost > new >
// active > sleeping.
export default function ClientStatusDot({
  segments,
  size = 8,
  className = "",
}: ClientStatusDotProps) {
  const color = colorFor(segments);
  if (!color) return null;
  return (
    <span
      aria-hidden
      className={`inline-block rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}

function colorFor(segments: ClientSegment[]): string | null {
  if (segments.includes("debtors")) return "#dc2626"; // red-600
  if (segments.includes("lost")) return "#d97706"; // amber-600
  if (segments.includes("new")) return "#0ea5e9"; // sky-500
  if (segments.includes("active")) return "#16a34a"; // green-600
  if (segments.includes("sleeping")) return "#94a3b8"; // slate-400
  return null;
}
