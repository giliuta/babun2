"use client";

// v492 — extracted from /dashboard/teams/[id]/cities/page.tsx.
// Two flows in one sheet: quick-pick from the global library (cities
// other brigades / the personal calendar already know about) + create
// new with name + colour. Shared between brigade labels and personal
// calendar labels (/dashboard/settings/calendar/labels) so the UX is
// identical and bug-fixes propagate to both.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MapPin, Plus, Search, X } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { CITY_COLOR_PRESETS, type City } from "@babun/shared/local/cities";

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

interface AddLabelModalProps {
  open: boolean;
  onClose: () => void;
  onPickExisting: (name: string) => void;
  onCreateNew: (name: string, color: string) => void;
  /** When `initial` is provided the modal goes into edit mode: title
   *  changes, suggestions are hidden, and submit calls `onUpdate`. */
  onUpdate?: (oldName: string, newName: string, color: string) => void;
  initial?: { name: string; color: string } | null;
  /** Labels already used elsewhere (other brigades, or — for the
   *  personal labels page — labels the user has elsewhere). Shown as
   *  quick-pick suggestions above the create form. */
  suggestions: City[];
}

export default function AddLabelModal({
  open,
  onClose,
  onPickExisting,
  onCreateNew,
  onUpdate,
  initial,
  suggestions,
}: AddLabelModalProps) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<string>(
    initial?.color ?? CITY_COLOR_PRESETS[0].value,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Reset form state on open/close/initial-prop change. Two
    // setters batch into a single re-render per change, so the
    // React-Compiler cascade warning is a false positive here.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open) {
      setName("");
      setColor(CITY_COLOR_PRESETS[0].value);
    } else if (initial) {
      setName(initial.name);
      setColor(initial.color);
    } else {
      setName("");
      setColor(CITY_COLOR_PRESETS[0].value);
      const t = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const trimmed = name.trim();
  const matchingSuggestions = useMemo(() => {
    if (isEdit) return [];
    return suggestions.filter((c) => {
      if (!trimmed) return true;
      return normalize(c.name).includes(normalize(trimmed));
    });
  }, [suggestions, trimmed, isEdit]);
  const exactMatch =
    !isEdit &&
    suggestions.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  const canSubmit = isEdit
    ? trimmed.length > 0
    : trimmed.length > 0 && !exactMatch;

  if (!open) return null;

  const submit = () => {
    if (!canSubmit) return;
    if (isEdit && initial && onUpdate) {
      onUpdate(initial.name, trimmed, color);
      return;
    }
    onCreateNew(trimmed, color);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] bg-[var(--surface-grouped)] rounded-[16px] overflow-hidden shadow-[var(--shadow-sheet)] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 bg-[var(--surface-card)] border-b border-[var(--separator)] text-center shrink-0">
          <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            {isEdit ? "Редактировать метку" : "Новая метка"}
          </div>
          <div className="mt-1 text-[12px] text-[var(--label-tertiary)] leading-snug">
            {isEdit
              ? "Поменяйте название или цвет. Применится везде, где используется эта метка."
              : "Город, район, направление — что угодно. Появится в календаре в выбранном цвете."}
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="relative">
            <Search
              size={16}
              strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--label-tertiary)] pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (exactMatch) onPickExisting(exactMatch.name);
                  else if (canSubmit) submit();
                }
              }}
              placeholder="Название метки"
              className="w-full h-11 pl-9 pr-9 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              maxLength={40}
            />
            {name && (
              <button
                type="button"
                onClick={() => setName("")}
                aria-label="Очистить"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--fill-secondary)] text-[var(--label-tertiary)] press-scale"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {matchingSuggestions.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1 mb-1.5">
                Уже используется
              </div>
              <div className="bg-[var(--surface-card)] rounded-[10px] overflow-hidden divide-y divide-[var(--separator)] max-h-[230px] overflow-y-auto">
                {matchingSuggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onPickExisting(c.name)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[48px] text-left active:bg-[var(--fill-quaternary)] transition press-scale"
                  >
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--label-on-accent)] shrink-0"
                      style={{ backgroundColor: c.color ?? "#8E8E93" }}
                    >
                      <MapPin size={14} strokeWidth={2.2} />
                    </span>
                    <span className="flex-1 text-[15px] truncate text-[var(--label)]">
                      {c.name}
                    </span>
                    <Plus
                      size={18}
                      strokeWidth={2.5}
                      className="text-[var(--accent)] shrink-0"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(isEdit || canSubmit) && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1 mb-1.5">
                {isEdit ? "Цвет и название" : "Создать новый"}
              </div>
              <div className="bg-[var(--surface-card)] rounded-[10px] p-3 space-y-3">
                <div>
                  <div className="text-[11px] text-[var(--label-secondary)] mb-1.5">
                    Цвет
                  </div>
                  <div className="grid grid-cols-7 gap-2.5">
                    {CITY_COLOR_PRESETS.map((c) => {
                      const picked = c.value === color;
                      return (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => {
                            haptic("tap");
                            setColor(c.value);
                          }}
                          aria-label={c.name}
                          className="relative w-full aspect-square rounded-full press-scale flex items-center justify-center"
                          style={{ backgroundColor: c.value }}
                        >
                          {picked && (
                            <Check
                              size={16}
                              strokeWidth={3}
                              className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]"
                            />
                          )}
                          {picked && (
                            <span
                              className="absolute -inset-[3px] rounded-full border-2 pointer-events-none"
                              style={{ borderColor: c.value }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3 min-h-[48px] px-1">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--label-on-accent)] shrink-0"
                    style={{ backgroundColor: color }}
                  >
                    <MapPin size={16} strokeWidth={2.2} />
                  </span>
                  <span className="flex-1 min-w-0 text-[15px] font-medium text-[var(--label)] truncate">
                    {trimmed}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pb-4 pt-1 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] font-medium text-[var(--label)] press-scale"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--label-on-accent)] press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] disabled:pointer-events-none"
          >
            {isEdit
              ? "Сохранить"
              : canSubmit
                ? `Создать «${trimmed}»`
                : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}
