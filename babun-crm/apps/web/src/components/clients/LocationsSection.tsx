"use client";

import { useState } from "react";
import { Home, MapPin, Plus, Wind } from "lucide-react";
import {
  AC_TYPE_LABELS,
  type ACUnit,
  type Client,
  type Location,
} from "@babun/shared/local/clients";
import { generateId } from "@babun/shared/local/masters";
import { haptic } from "@/lib/haptics";
import LocationEditor from "./LocationEditor";

interface LocationsSectionProps {
  client: Client;
  onUpdate: (next: Client) => void;
}

// Sections-of-objects view. Each card = one Location with its own
// equipment list summarised. Tap card → open LocationEditor.
export default function LocationsSection({
  client,
  onUpdate,
}: LocationsSectionProps) {
  const [editing, setEditing] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);

  const locations = client.locations ?? [];

  // v327 — Treat objects with no address AND no equipment as "empty
  // placeholders" (created automatically during migration) and hide
  // them so the panel doesn't show a useless «адрес не указан / нет
  // оборудования» card. The real promo button takes over instead.
  const meaningful = locations.filter(
    (l) => (l.address?.trim() ?? "") !== "" || (l.equipment?.length ?? 0) > 0,
  );
  const showAsEmpty = meaningful.length === 0;

  const openExisting = (loc: Location) => {
    haptic("tap");
    setEditing(loc);
  };

  const openNew = () => {
    haptic("tap");
    setCreating(true);
  };

  const closeEditor = () => {
    setEditing(null);
    setCreating(false);
  };

  const saveLocation = (next: Location) => {
    let updated: Location[];
    if (locations.some((l) => l.id === next.id)) {
      updated = locations.map((l) => (l.id === next.id ? next : l));
    } else {
      updated = [...locations, next];
    }
    // Enforce single primary — if the saved one is primary, demote
    // the others. If nothing primary remains (e.g. user un-checked
    // the only primary), promote the first.
    if (next.isPrimary) {
      updated = updated.map((l) =>
        l.id === next.id ? l : { ...l, isPrimary: false },
      );
    } else if (!updated.some((l) => l.isPrimary) && updated.length > 0) {
      updated = updated.map((l, i) => (i === 0 ? { ...l, isPrimary: true } : l));
    }
    onUpdate({ ...client, locations: updated });
    closeEditor();
  };

  const deleteLocation = (id: string) => {
    let next = locations.filter((l) => l.id !== id);
    if (!next.some((l) => l.isPrimary) && next.length > 0) {
      next = next.map((l, i) => (i === 0 ? { ...l, isPrimary: true } : l));
    }
    onUpdate({ ...client, locations: next });
    closeEditor();
  };

  // When the user taps the promo "+ Добавить объект" while an empty
  // placeholder location already exists, edit that placeholder
  // instead of stacking a second one.  Avoids the "two empty
  // Основной cards" bug after migration.
  const editingLocation: Location | null = creating
    ? showAsEmpty && locations[0]
      ? locations[0]
      : {
          id: generateId("loc"),
          label: "Дом",
          address: "",
          isPrimary: locations.length === 0,
          equipment: [],
        }
    : editing;

  return (
    <>
      <div className="px-4 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Объекты
          </div>
          <span className="text-[11px] text-[var(--label-tertiary)]">
            адрес и оборудование привязаны к объекту
          </span>
        </div>

        {showAsEmpty ? (
          <button
            type="button"
            onClick={openNew}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-[12px] bg-[var(--fill-tertiary)] border border-dashed border-[var(--separator)] active:bg-[var(--fill-secondary)] text-left"
          >
            <span className="w-9 h-9 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <Plus size={16} strokeWidth={2.5} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold text-[var(--accent)]">
                Добавить объект
              </span>
              <span className="block text-[12px] text-[var(--label-tertiary)] mt-0.5">
                Дом, офис или вилла — со своим адресом и оборудованием
              </span>
            </span>
          </button>
        ) : (
          <>
            <div className="space-y-1.5">
              {meaningful.map((loc) => (
                <LocationCard
                  key={loc.id}
                  loc={loc}
                  onClick={() => openExisting(loc)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={openNew}
              className="w-full h-10 flex items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-[var(--separator)] text-[13px] font-semibold text-[var(--accent)] active:bg-[var(--accent-tint)]"
            >
              <Plus size={14} strokeWidth={2.5} />
              Добавить объект
            </button>
          </>
        )}
      </div>

      <LocationEditor
        open={Boolean(editingLocation)}
        location={editingLocation}
        isOnly={
          editingLocation
            ? locations.length === 0 ||
              (locations.length === 1 && locations[0].id === editingLocation.id)
            : false
        }
        onSave={saveLocation}
        onDelete={
          editing
            ? () => deleteLocation(editing.id)
            : undefined
        }
        onClose={closeEditor}
      />
    </>
  );
}

function LocationCard({
  loc,
  onClick,
}: {
  loc: Location;
  onClick: () => void;
}) {
  const equipment = loc.equipment ?? [];
  const acSummary = summarizeEquipment(equipment);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-[var(--fill-tertiary)] rounded-[12px] px-3 py-2.5 flex items-start gap-3 active:bg-[var(--fill-secondary)] transition text-left"
    >
      <span className="w-9 h-9 rounded-lg bg-[var(--surface-card)] text-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
        <Home size={16} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[14px] font-semibold text-[var(--label)] truncate">
            {loc.label || "Объект"}
          </span>
          {loc.isPrimary && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent-tint)] px-1.5 py-0.5 rounded">
              основной
            </span>
          )}
        </div>
        {loc.address ? (
          <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 flex items-center gap-1">
            <MapPin size={11} strokeWidth={2} className="shrink-0" />
            <span className="truncate">{loc.address}</span>
          </div>
        ) : (
          <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5">
            адрес не указан
          </div>
        )}
        <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5 flex items-center gap-1">
          <Wind size={11} strokeWidth={2} className="shrink-0" />
          <span className="truncate">{acSummary}</span>
        </div>
        {loc.note && (
          <div className="text-[12px] text-[var(--label)] mt-1 px-2 py-1 rounded bg-[rgba(255,149,0,0.1)] border border-[rgba(255,149,0,0.2)] truncate">
            {loc.note}
          </div>
        )}
      </div>
    </button>
  );
}

function summarizeEquipment(units: ACUnit[]): string {
  if (units.length === 0) return "оборудования нет";
  const byType = new Map<string, number>();
  for (const u of units) {
    const k = AC_TYPE_LABELS[u.ac_type];
    byType.set(k, (byType.get(k) ?? 0) + 1);
  }
  const parts = Array.from(byType.entries()).map(
    ([k, n]) => `${n} × ${k}`,
  );
  return parts.join(" · ");
}
