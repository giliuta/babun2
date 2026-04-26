"use client";

// STORY-034 — Objects block for the redesigned client card.
//
// The header already shows the *primary* object inline.  This block
// only renders the *additional* objects (so we don't duplicate the
// primary).  Auto-opens when there's more than one usable location.

import { Home, MapPin, ArrowUpRight } from "lucide-react";
import type { Client, Location } from "@/lib/clients";
import { buildMapUrl } from "@babun/shared/common/utils/map-links";
import ClientCard from "../ClientCard";
import { haptic } from "@/lib/haptics";

interface ObjectsBlockProps {
  client: Client;
}

function preferAppleMaps(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function ObjectsBlock({ client }: ObjectsBlockProps) {
  const usable = (client.locations ?? []).filter(
    (l) => l.address || l.mapUrl,
  );
  // Header shows the primary one; here we list everything else.
  const primary = usable.find((l) => l.isPrimary) ?? usable[0] ?? null;
  const others = primary
    ? usable.filter((l) => l.id !== primary.id)
    : usable;

  // When there's only one (and it's the primary in header), the block
  // is empty — render the card collapsed with a "+ добавить объект"
  // hint inside.
  return (
    <ClientCard
      kind="objects"
      title="Объекты"
      badge={usable.length || undefined}
      defaultOpen={usable.length > 1}
    >
      <div className="divide-y divide-[var(--separator)]">
        {others.length === 0 ? (
          <div className="px-4 py-3 text-[13px] text-[var(--label-tertiary)]">
            Только основной объект (он показан в шапке).
          </div>
        ) : (
          others.map((loc) => <ObjectRow key={loc.id} loc={loc} />)
        )}
      </div>
    </ClientCard>
  );
}

function ObjectRow({ loc }: { loc: Location }) {
  const openMaps = () => {
    haptic("light");
    const service = preferAppleMaps() ? "apple" : "google";
    const url = buildMapUrl(service, loc.mapUrl || loc.address);
    if (url) window.open(url, "_blank", "noopener");
  };
  return (
    <div className="px-4 py-3 flex items-center gap-2">
      <span className="shrink-0 w-8 h-8 rounded-lg bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
        <Home size={14} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[var(--label)] truncate">
          {loc.label || "Объект"}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] truncate flex items-center gap-1">
          <MapPin size={10} strokeWidth={2} className="shrink-0" />
          {loc.address || "адрес не указан"}
        </div>
      </div>
      {(loc.address || loc.mapUrl) && (
        <button
          type="button"
          onClick={openMaps}
          aria-label="Открыть в Картах"
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--system-blue)] bg-[rgba(0,122,255,0.10)] active:bg-[rgba(0,122,255,0.20)]"
        >
          <ArrowUpRight size={14} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
