"use client";

// STORY-068 — shared inline form for adding/editing a Location.
// Used by /dashboard/clients/new (during creation) and ObjectsBlock
// on the detail card. Replaces the LocationEditor full-screen sheet
// for the common quick-add case (the sheet is still available from
// blocks that need equipment editing).

import { Plus } from "@babun/shared/icons";
import type { PropertyType } from "@babun/shared/local/clients";
import { haptic } from "@/lib/haptics";

export interface LocationDraft {
  label: string;
  property_type: PropertyType;
  address: string;
  note: string;
}

interface PropertyChoice {
  value: PropertyType;
  label: string;
  defaultLabel: string;
}

const PROPERTY_CHOICES: PropertyChoice[] = [
  { value: "house", label: "Дом", defaultLabel: "Дом" },
  { value: "apartment", label: "Квартира", defaultLabel: "Квартира" },
  { value: "office", label: "Офис", defaultLabel: "Офис" },
  { value: "shop", label: "Магазин", defaultLabel: "Магазин" },
  { value: "restaurant", label: "Ресторан", defaultLabel: "Ресторан" },
  { value: "other", label: "Другое", defaultLabel: "Объект" },
];

export function emptyLocationDraft(): LocationDraft {
  return {
    label: PROPERTY_CHOICES[0].defaultLabel,
    property_type: "house",
    address: "",
    note: "",
  };
}

const inputCls =
  "w-full h-10 px-3 text-[15px] bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] focus:outline-none focus:border-[var(--accent)]";

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
      {/* Type chips — six options in a wrap row. */}
      <div className="flex flex-wrap gap-1.5">
        {PROPERTY_CHOICES.map((p) => {
          const active = draft.property_type === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                haptic("tap");
                onChange({
                  ...draft,
                  property_type: p.value,
                  // Auto-fill the label when picking a type, but only
                  // if the user hasn't typed a custom one already.
                  label: PROPERTY_CHOICES.some(
                    (c) => c.defaultLabel === draft.label,
                  )
                    ? p.defaultLabel
                    : draft.label,
                });
              }}
              className={`h-8 px-3 rounded-full text-[13px] font-medium transition ${
                active
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--surface-card)] text-[var(--label)] border border-[var(--separator)] active:bg-[var(--fill-tertiary)]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <FormField label="Адрес" required>
        <input
          type="text"
          autoFocus
          value={draft.address}
          onChange={(e) => onChange({ ...draft, address: e.target.value })}
          placeholder="ул. Архиепископу Макариу III, 12"
          className={inputCls}
          maxLength={200}
        />
      </FormField>

      <FormField
        label="Заметка для команды"
        hint="код домофона, собака, особенности входа"
      >
        <input
          type="text"
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          placeholder="зелёная дверь, домофон 25"
          className={inputCls}
          maxLength={140}
        />
      </FormField>

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

function FormField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-[var(--label-secondary)] flex items-center gap-1 mb-1">
        {label}
        {required && (
          <span className="text-[var(--system-red)]" aria-label="Обязательное поле">
            *
          </span>
        )}
        {hint && (
          <span className="text-[var(--label-tertiary)] font-normal ml-auto">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}
