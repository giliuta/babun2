"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, MapPin, Settings } from "@babun/shared/icons";
import { CITIES, cityConfigFromColor } from "@babun/shared/local/day-cities";
import type { City } from "@babun/shared/local/cities";

interface CityPickerModalProps {
  open: boolean;
  onClose: () => void;
  current: string;
  /** kept for API back-compat; no longer rendered */
  defaultCity?: string;
  /** ISO date key "YYYY-MM-DD" of the day being edited (for the header). */
  dateKey?: string;
  /** Sprint 033: full settings.cities list. Custom tags the user added
   *  from the brigade editor («Германия», «День ног», Айя-Напа…) all
   *  need to appear here. When missing, falls back to the 4 legacy
   *  CITIES presets so nothing ever renders empty. */
  cities?: City[];
  /** Sprint 033 Phase I5: narrow the picker to just the cities this
   *  brigade is configured for (brigade.cities[]). When provided and
   *  non-empty the picker shows only these; otherwise falls back to
   *  the full cities list. */
  brigadeCities?: string[];
  onPick: (city: string) => void;
  /** kept for API back-compat; reset button removed from UI */
  onReset?: () => void;
  /** Settings page for the active calendar's labels — brigade «Метки»
   *  (/dashboard/teams/:id/cities) or personal labels. When set, a gear
   *  in the header's top-left corner navigates there. */
  settingsHref?: string;
}

// Sprint 029 Phase 1: iOS-style city picker. Grouped-list card with
// city rows, each row gets a tinted pin tile matching the city's
// brand colour, a checkmark on the right for the active choice.
export default function CityPickerModal({
  open,
  onClose,
  current,
  dateKey,
  cities,
  brigadeCities,
  onPick,
  onReset,
  settingsHref,
}: CityPickerModalProps) {
  const router = useRouter();
  // Build the single render list. Prefer settings.cities (the source of
  // truth that the brigade editor writes to). Each entry carries its
  // accent colour so custom tags render in the user-picked hue.
  // When brigadeCities is provided and non-empty, narrow to that set
  // so the user can't accidentally pick a city the brigade isn't
  // configured for.
  const pickerList = useMemo(() => {
    const source = (cities && cities.length > 0 ? cities : [])
      .filter((c) => c.isActive)
      .map((c) => {
        const legacy = CITIES[c.name];
        return {
          name: c.name,
          color: c.color ?? legacy?.color ?? "#8E8E93",
        };
      });
    const narrowed =
      brigadeCities && brigadeCities.length > 0
        ? source.filter((c) => brigadeCities.includes(c.name))
        : source;
    if (narrowed.length > 0) return narrowed;
    // Fallback — the 4 hardcoded Cyprus presets.
    return Object.values(CITIES).map((c) => ({ name: c.name, color: c.color }));
  }, [cities, brigadeCities]);

  void cityConfigFromColor;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handlePick = (city: string) => {
    // v501 — tap on the already-active label toggles it off. Without
    // this the user had no way to remove the day's label («не могу
    // отменить выбор метки»). Falls back to `onPick` when `onReset`
    // isn't provided so the API stays back-compat.
    if (city === current && onReset) {
      onReset();
      onClose();
      return;
    }
    onPick(city);
    onClose();
  };

  const dateLabel = dateKey
    ? (() => {
        const [y, m, d] = dateKey.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
          weekday: "short",
          day: "numeric",
          month: "long",
        });
      })()
    : "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[340px] bg-[var(--surface-grouped)] rounded-[14px] pb-3 overflow-hidden shadow-[var(--shadow-sheet)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-3 bg-[var(--surface-card)] border-b border-[var(--separator)] flex items-center gap-3">
          {settingsHref && (
            <button
              type="button"
              aria-label="Настройки меток"
              onClick={() => {
                onClose();
                router.push(settingsHref);
              }}
              className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] press-scale shrink-0"
            >
              <Settings size={20} strokeWidth={2} />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
              Метка
            </h2>
            {dateLabel && (
              <p className="text-[13px] text-[var(--label-secondary)] capitalize mt-0.5">
                {dateLabel}
              </p>
            )}
          </div>
        </div>

        <div className="px-3 pt-3">
          <div className="bg-[var(--surface-card)] rounded-[14px] overflow-hidden divide-y divide-[var(--separator)]">
            {pickerList.map((c) => {
              const active = c.name === current;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => handlePick(c.name)}
                  className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] active:bg-[var(--fill-quaternary)] transition"
                >
                  <span
                    className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0"
                    style={{ background: c.color }}
                  >
                    <MapPin
                      size={16}
                      strokeWidth={2.2}
                      className="text-[var(--label-on-accent)]"
                    />
                  </span>
                  <span className="flex-1 text-left text-[15px] font-medium text-[var(--label)]">
                    {c.name}
                  </span>
                  {active && (
                    <Check
                      size={18}
                      strokeWidth={2.5}
                      className="text-[var(--accent)]"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* v693 — explicit «Снять метку» row removed. The active
              row already toggles itself off via `handlePick` above,
              so the button was a visual duplicate that also pushed
              the picker taller than necessary. */}
        </div>
      </div>
    </div>
  );
}
