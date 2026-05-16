"use client";

// P0 #6 (CRM Core brief) — shared «object form» field stack used by
// both the inline create-flow on /clients/new and the modal editor
// (LocationEditor) on /clients/[id].
//
// Both used to declare their own type-chip row + label + address +
// note inputs. Diverged slowly: chip palette, default-label fill
// logic, placeholder copy. The brief wanted ONE `<ObjectForm />`
// surface so creating an object during onboarding and adding one
// from inside the client card use identical UI.
//
// This component renders ONLY the shared fields. Each consumer wraps
// its own chrome (inline buttons for the create flow; modal header +
// equipment list + primary-toggle for the editor). Equipment, photos,
// map links etc. stay out of here — they're consumer-specific.

import type { PropertyType } from "@babun/shared/local/clients";
import { haptic } from "@/lib/haptics";

export interface PropertyChoice {
  value: PropertyType;
  label: string;
  /** Label used when the user picks this type and hasn't overridden
   *  the freeform name field yet. «Дом» → name auto-fills «Дом». */
  defaultLabel: string;
}

// One canonical palette. Both call sites used to hand-roll their own
// 5-7-entry array; align on this list so adding «Парикмахерская»
// later changes one place.
export const PROPERTY_CHOICES: PropertyChoice[] = [
  { value: "house", label: "Дом", defaultLabel: "Дом" },
  { value: "apartment", label: "Квартира", defaultLabel: "Квартира" },
  { value: "office", label: "Офис", defaultLabel: "Офис" },
  { value: "shop", label: "Магазин", defaultLabel: "Магазин" },
  { value: "restaurant", label: "Ресторан", defaultLabel: "Ресторан" },
  { value: "other", label: "Другое", defaultLabel: "Объект" },
];

export interface ObjectFormDraft {
  label: string;
  property_type: PropertyType;
  address: string;
  note: string;
}

interface Props {
  draft: ObjectFormDraft;
  onChange: (next: ObjectFormDraft) => void;
  /** Optional `autoFocus` on the address field. The inline-create
   *  flow uses true (user just tapped «Добавить объект»); the modal
   *  editor leaves it false so the modal's title is the first thing
   *  the user reads. */
  autoFocusAddress?: boolean;
}

const inputCls =
  "w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition";

export default function ObjectFormFields({
  draft,
  onChange,
  autoFocusAddress,
}: Props) {
  const setType = (next: PropertyType) => {
    haptic("tap");
    onChange({
      ...draft,
      property_type: next,
      // Auto-fill the label when picking a type — but only if the
      // user hasn't typed a custom one yet. We detect «hasn't typed»
      // by checking the label against every defaultLabel in the
      // palette: if it's one of them, replace; otherwise keep what
      // the user wrote.
      label: PROPERTY_CHOICES.some((c) => c.defaultLabel === draft.label)
        ? PROPERTY_CHOICES.find((c) => c.value === next)?.defaultLabel ??
          draft.label
        : draft.label,
    });
  };

  return (
    <div className="space-y-2.5">
      {/* Type chips */}
      <div className="flex flex-wrap gap-1.5">
        {PROPERTY_CHOICES.map((p) => {
          const active = draft.property_type === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setType(p.value)}
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

      <Field label="Название" hint="как клиент сам называет — «дом», «студия у моря»">
        <input
          type="text"
          value={draft.label}
          onChange={(e) => onChange({ ...draft, label: e.target.value })}
          placeholder="Дом"
          className={inputCls}
          maxLength={60}
        />
      </Field>

      <Field label="Адрес" required>
        <input
          type="text"
          autoFocus={autoFocusAddress}
          value={draft.address}
          onChange={(e) => onChange({ ...draft, address: e.target.value })}
          placeholder="ул. Архиепископу Макариу III, 12"
          className={inputCls}
          maxLength={200}
        />
      </Field>

      <Field label="Заметка для команды" hint="код домофона, собака, особенности входа">
        <input
          type="text"
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          placeholder="зелёная дверь, домофон 25"
          className={inputCls}
          maxLength={140}
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <div className="text-[12px] font-medium text-[var(--label-secondary)] tracking-wide">
          {label}
          {required && <span className="text-[var(--system-red)] ml-1">*</span>}
        </div>
        {hint && (
          <div className="text-[11px] text-[var(--label-tertiary)] truncate ml-2">
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
