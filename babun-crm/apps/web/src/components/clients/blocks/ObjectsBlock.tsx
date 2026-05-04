"use client";

// STORY-034 — Objects block for the client card.
// STORY-068 — supports inline add + remove of objects without opening
// the LocationEditor sheet. The full editor (with equipment) still
// lives at LocationEditor.tsx and remains the path for advanced edits.

import { useState } from "react";
import { ArrowUpRight, Home, MapPin, Trash2 } from "@babun/shared/icons";
import type { Client, Location } from "@babun/shared/local/clients";
import { buildMapUrl } from "@babun/shared/common/utils/map-links";
import { generateId } from "@babun/shared/local/masters";
import ClientCard from "../ClientCard";
import {
  AddLocationButton,
  InlineLocationForm,
  emptyLocationDraft,
  type LocationDraft,
} from "../InlineLocationForm";
import { haptic } from "@/lib/haptics";

interface ObjectsBlockProps {
  client: Client;
  /** Wired from ClientCardPage so add/remove persist via the
   *  Supabase repo (and survive realtime). */
  onUpdate: (next: Client) => void;
}

function preferAppleMaps(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export default function ObjectsBlock({ client, onUpdate }: ObjectsBlockProps) {
  const all = client.locations ?? [];
  // Header shows the primary one already; the block lists everything
  // the user has so they can edit/remove ANY of them, including the
  // primary (otherwise removing a now-stale primary is a dead-end).
  const [draft, setDraft] = useState<LocationDraft | null>(null);

  const handleAdd = () => {
    setDraft(emptyLocationDraft());
  };

  const handleSaveDraft = () => {
    if (!draft) return;
    if (!draft.address.trim()) return;
    haptic("tap");
    const newLoc: Location = {
      id: generateId("loc"),
      label: draft.label.trim() || "Объект",
      address: draft.address.trim(),
      isPrimary: all.length === 0,
      note: draft.note.trim() || undefined,
      equipment: [],
    };
    onUpdate({
      ...client,
      locations: [...all, newLoc],
    });
    setDraft(null);
  };

  const handleRemove = (id: string) => {
    haptic("warning");
    const next = all.filter((l) => l.id !== id);
    // Promote a new primary if we removed the previous one.
    const stillHasPrimary = next.some((l) => l.isPrimary);
    const reseated =
      !stillHasPrimary && next.length > 0
        ? next.map((l, i) => ({ ...l, isPrimary: i === 0 }))
        : next;
    onUpdate({
      ...client,
      locations: reseated,
    });
  };

  return (
    <ClientCard
      kind="objects"
      title="Объекты"
      badge={all.length || undefined}
      defaultOpen={all.length > 0 || draft !== null}
    >
      <div className="p-3 space-y-2">
        {all.length === 0 && !draft && (
          <p className="text-[13px] text-[var(--label-tertiary)]">
            Объектов пока нет — добавь дом или офис, чтобы привязать оборудование и адрес.
          </p>
        )}

        {all.map((loc) => (
          <ObjectRow
            key={loc.id}
            loc={loc}
            onRemove={() => handleRemove(loc.id)}
          />
        ))}

        {draft ? (
          <InlineLocationForm
            draft={draft}
            onChange={setDraft}
            onSave={handleSaveDraft}
            onCancel={() => setDraft(null)}
          />
        ) : (
          <AddLocationButton onClick={handleAdd} hasExisting={all.length > 0} />
        )}
      </div>
    </ClientCard>
  );
}

function ObjectRow({
  loc,
  onRemove,
}: {
  loc: Location;
  onRemove: () => void;
}) {
  const openMaps = () => {
    haptic("light");
    const service = preferAppleMaps() ? "apple" : "google";
    const url = buildMapUrl(service, loc.mapUrl || loc.address);
    if (url) window.open(url, "_blank", "noopener");
  };
  return (
    <div className="flex items-start gap-2 p-3 rounded-[12px] bg-[var(--fill-quaternary)]">
      <span className="shrink-0 w-9 h-9 rounded-lg bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
        <Home size={16} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[var(--label)] truncate">
          {loc.label || "Объект"}
          {loc.isPrimary && (
            <span className="ml-1.5 text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">
              основной
            </span>
          )}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] truncate flex items-center gap-1">
          <MapPin size={10} strokeWidth={2} className="shrink-0" />
          {loc.address || "адрес не указан"}
        </div>
        {loc.note && (
          <div className="text-[11px] text-[var(--label-tertiary)] truncate mt-0.5">
            {loc.note}
          </div>
        )}
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
      <button
        type="button"
        onClick={onRemove}
        aria-label="Удалить объект"
        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-[var(--system-red)] active:bg-[rgba(255,59,48,0.12)]"
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
