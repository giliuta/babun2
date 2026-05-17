"use client";

// STORY-068 — shared inline form for adding/editing a Location.
// Used by /dashboard/clients/new (during creation) and ObjectsBlock
// on the detail card. Replaces the LocationEditor full-screen sheet
// for the common quick-add case (the sheet is still available from
// blocks that need equipment editing).
//
// Audit fix (Sprint #3 CRM Core, P0 #6 regression) — earlier I had
// a duplicate `PROPERTY_CHOICES` palette + auto-fill rule here.
// This file now delegates the field stack to the shared
// `<ObjectFormFields />` (the same one LocationEditor uses), keeping
// the inline Cancel/Save chrome local. Single source of truth for
// the type chips, label auto-fill, address + note inputs.

import { Plus } from "@babun/shared/icons";
import type { PropertyType } from "@babun/shared/local/clients";
import { haptic } from "@/lib/haptics";
import ObjectFormFields, {
  PROPERTY_CHOICES,
} from "@/components/clients/ObjectFormFields";

export interface LocationDraft {
  label: string;
  // Optional to align with `ObjectFormDraft` — the shared form treats
  // undefined as «type not picked yet» and renders no active chip.
  property_type?: PropertyType;
  address: string;
  note: string;
}

export function emptyLocationDraft(): LocationDraft {
  return {
    label: PROPERTY_CHOICES[0].defaultLabel,
    property_type: "house",
    address: "",
    note: "",
  };
}

export function InlineLocationForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saveLabel = "Готово",
}: {
  draft: LocationDraft;
  onChange: (next: LocationDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const canSave = draft.address.trim().length > 0;
  return (
    <div className="p-3 rounded-[12px] bg-[var(--fill-quaternary)] space-y-2.5">
      {/* Fields delegated to <ObjectFormFields /> — same palette + same
          auto-fill rule LocationEditor uses. */}
      <ObjectFormFields draft={draft} onChange={onChange} autoFocusAddress />

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-10 rounded-[10px] bg-[var(--surface-card)] border border-[var(--separator)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-tertiary)]"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={`flex-1 h-10 rounded-[10px] text-[14px] font-semibold transition ${
            canSave
              ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)]"
              : "bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] cursor-not-allowed"
          }`}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}

export function AddLocationButton({
  onClick,
  hasExisting,
}: {
  onClick: () => void;
  hasExisting: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("tap");
        onClick();
      }}
      className="w-full h-11 flex items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-[var(--separator)] text-[var(--accent)] text-[14px] font-semibold active:bg-[var(--accent-tint)]"
    >
      <Plus size={14} strokeWidth={2.5} />
      {hasExisting ? "Добавить ещё объект" : "Добавить объект"}
    </button>
  );
}
