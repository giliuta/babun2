"use client";

// Live duplicate strip for the client card's create mode. As the user types
// the phone, confident matches surface here — «Открыть» jumps to the
// existing card (opening it IS the link; no separate «Привязать» step).
// Rendered only when ClientCardPage has matches to show.

import type { Client } from "@babun/shared/local/clients";
import { haptic } from "@/lib/haptics";

interface ClientDedupeStripProps {
  matches: Client[];
  onOpen: (clientId: string) => void;
}

export default function ClientDedupeStrip({ matches, onOpen }: ClientDedupeStripProps) {
  if (matches.length === 0) return null;
  return (
    <div className="mx-3 mt-3 px-1">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
        Похоже, такой уже есть
      </div>
      <div className="space-y-0.5">
        {matches.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-1.5">
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold text-[var(--label)] truncate">
                {c.full_name || "Без имени"}
              </div>
              <div className="text-[13px] text-[var(--label-secondary)] truncate tabular-nums">
                {[c.phone, c.city].filter(Boolean).join(" · ")}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                onOpen(c.id);
              }}
              className="shrink-0 text-[14px] font-semibold text-[var(--accent)] active:opacity-60 px-1"
            >
              Открыть
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
