"use client";

// Sprint 033 Phase I11 — Cities, per-brigade mental model.
//
// Radical simplification based on user's new framing:
//  · A brigade's cities = exactly what's in its list, nothing more.
//    New brigade shows an EMPTY list. Adding picks from the global
//    reference or creates a new entry on the fly.
//  · No "selected / not selected" split, no checkboxes. Every row IS
//    in the brigade.
//  · Only 2 actions per row: "Сделать основным" and "Удалить".
//  · Auto-base: the first city is implicitly base when the user
//    hasn't explicitly picked one. No forced writes to default_city.
//  · Gestures:
//      – Swipe left (→delete)      red trash revealed on the right
//      – Swipe right (→star)       gold star revealed on the left
//      – Long-press / tap          context menu (both same 2 actions)
//
// Remaining components kept from I10: ContextMenu (anchored popover),
// SwipeableRow (reused for horizontal swipes).

import { use, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  MapPin,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useCities, useTeams } from "@/app/dashboard/layout";
import {
  CITY_COLOR_PRESETS,
  generateCityId,
  type City,
} from "@/lib/cities";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import ContextMenu, {
  type ContextMenuOption,
} from "@/components/ui/ContextMenu";
import SwipeableRow from "@/components/ui/SwipeableRow";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

export default function BrigadeCitiesPage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams, upsertTeam } = useTeams();
  const { cities, setCities } = useCities();
  const team = teams.find((t) => t.id === id);

  const [addOpen, setAddOpen] = useState(false);
  const [menu, setMenu] = useState<{
    cityName: string;
    anchor: { x: number; y: number };
  } | null>(null);

  const brigadeCityNames = team?.cities ?? [];
  const defaultCity = team?.default_city ?? "";

  // Resolve each brigade city name to a full City (with colour) from
  // the global reference. Missing entries fall back to a neutral grey.
  const rows = useMemo(() => {
    return brigadeCityNames.map((name) => {
      const hit = cities.find((c) => c.name === name);
      return (
        hit ?? {
          id: `ghost-${name}`,
          name,
          country: "",
          isActive: true,
          color: "#8E8E93",
        }
      );
    });
  }, [brigadeCityNames, cities]);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Города / Филиалы" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  // Effective base city (what the user sees as gold-starred):
  // explicit default_city, or — if none — the first city in the list.
  const effectiveBase =
    defaultCity && brigadeCityNames.includes(defaultCity)
      ? defaultCity
      : brigadeCityNames[0] ?? "";

  // Rule: every non-empty brigade must have exactly one base city.
  // Resolver keeps default_city aligned with that invariant.
  const resolveBase = (nextCities: string[], prevBase: string): string => {
    if (nextCities.length === 0) return "";
    if (prevBase && nextCities.includes(prevBase)) return prevBase;
    return nextCities[0];
  };

  const persistBrigade = (nextCities: string[], prevBase: string) => {
    upsertTeam({
      ...team,
      cities: nextCities.length > 0 ? nextCities : undefined,
      default_city: resolveBase(nextCities, prevBase),
    });
  };

  const addCity = (name: string, color: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Resolve to an existing library entry if the name already exists
    // (keeps colour consistent across brigades).
    const existing = cities.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    let resolvedName = trimmed;
    if (existing) {
      resolvedName = existing.name;
      if (!existing.isActive) {
        setCities(
          cities.map((c) =>
            c.id === existing.id ? { ...c, isActive: true } : c,
          ),
        );
      }
    } else {
      const created: City = {
        id: generateCityId(),
        name: trimmed,
        country: "",
        isActive: true,
        color,
      };
      setCities([...cities, created]);
    }
    if (!brigadeCityNames.includes(resolvedName)) {
      persistBrigade([...brigadeCityNames, resolvedName], defaultCity);
    }
    haptic("tap");
    setAddOpen(false);
  };

  const removeCity = (cityName: string) => {
    haptic("warning");
    persistBrigade(
      brigadeCityNames.filter((c) => c !== cityName),
      // If we just removed the base, resolver will pick the new first.
      defaultCity === cityName ? "" : defaultCity,
    );
  };

  const setBase = (cityName: string) => {
    if (defaultCity === cityName) return; // no-op on the current base
    haptic("tap");
    upsertTeam({ ...team, default_city: cityName });
  };

  const openMenu = (cityName: string, anchor: { x: number; y: number }) => {
    setMenu({ cityName, anchor });
  };

  // Context menu: only 2 actions per user's spec.
  // The "Сделать основным" option is hidden when the row is already
  // the base — the system always has exactly one base, so the only
  // way to change it is to pick a different city.
  const menuOptions: ContextMenuOption[] = menu
    ? [
        ...(effectiveBase === menu.cityName
          ? []
          : [
              {
                label: "Сделать основным",
                icon: (
                  <Star
                    size={18}
                    strokeWidth={2}
                    fill="var(--system-yellow)"
                    className="text-[var(--system-yellow)]"
                  />
                ),
                onSelect: () => setBase(menu.cityName),
              },
            ]),
        {
          label: "Удалить",
          icon: <Trash2 size={18} strokeWidth={2} />,
          danger: true,
          onSelect: () => removeCity(menu.cityName),
        },
      ]
    : [];

  const listEmpty = rows.length === 0;

  // All global cities this brigade hasn't added yet — used to populate
  // the Add modal's quick-pick section.
  const unpickedFromLibrary = cities
    .filter(
      (c) =>
        c.isActive &&
        !brigadeCityNames.some(
          (n) => n.toLowerCase() === c.name.toLowerCase(),
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  return (
    <BrigadeSectionShell
      brigadeId={id}
      title="Города / Филиалы"
      hideSave
    >
      {listEmpty ? (
        <div className="px-6 pt-8 pb-4 flex flex-col items-center text-center gap-3">
          <span className="w-16 h-16 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
            <MapPin size={28} strokeWidth={2} />
          </span>
          <div>
            <div className="text-[17px] font-semibold text-[var(--label)]">
              Бригада пока никуда не ездит
            </div>
            <div className="mt-1 text-[13px] leading-snug text-[var(--label-secondary)]">
              Добавьте первый город — он станет основным и появится в&nbsp;календаре.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-3 h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
          >
            Добавить город
          </button>
        </div>
      ) : (
        <>
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
            {rows.map((c) => (
              <SwipeableRow
                key={c.id}
                leftActions={
                  effectiveBase === c.name
                    ? []
                    : [
                        {
                          label: "Основной",
                          color: "bg-[var(--system-yellow)]",
                          icon: (
                            <Star
                              size={16}
                              strokeWidth={2}
                              fill="white"
                            />
                          ),
                          onSelect: () => setBase(c.name),
                        },
                      ]
                }
                rightActions={[
                  {
                    label: "Удалить",
                    color: "bg-[var(--system-red)]",
                    icon: <Trash2 size={16} strokeWidth={2} />,
                    onSelect: () => removeCity(c.name),
                  },
                ]}
              >
                <CityRow
                  city={c}
                  isBase={effectiveBase === c.name}
                  isImplicitBase={
                    effectiveBase === c.name && defaultCity !== c.name
                  }
                  onTap={(anchor) => openMenu(c.name, anchor)}
                  onLongPress={(anchor) => openMenu(c.name, anchor)}
                />
              </SwipeableRow>
            ))}
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left active:bg-[var(--fill-quaternary)] transition press-scale"
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-tint)] text-[var(--accent)] shrink-0">
                <Plus size={18} strokeWidth={2.5} />
              </span>
              <span className="flex-1 text-[15px] font-medium text-[var(--accent)]">
                Новый город или тег
              </span>
            </button>
          </div>

          {/* Hint: one line only, very subtle. */}
          <div className="px-4 pt-0.5 text-[12px] leading-snug text-[var(--label-tertiary)]">
            Свайп вправо —{" "}
            <span className="text-[color:var(--system-yellow-strong,#B78600)] font-medium">
              основной
            </span>
            . Свайп влево —{" "}
            <span className="text-[var(--system-red)] font-medium">удалить</span>
            . Долгое нажатие — меню.
          </div>
        </>
      )}

      <AddCityModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onPickExisting={(name) => addCity(name, "#8E8E93")}
        onCreateNew={(name, color) => addCity(name, color)}
        unpickedFromLibrary={unpickedFromLibrary}
      />

      <ContextMenu
        open={!!menu}
        onClose={() => setMenu(null)}
        anchor={menu?.anchor ?? null}
        title={menu?.cityName}
        options={menuOptions}
      />
    </BrigadeSectionShell>
  );
}

// ─── Long-press + tap hook ────────────────────────────────────────────
//
// Tap fires on click (gets iOS's built-in movement tolerance for free).
// Long-press fires after 500 ms of stationary press and flags itself
// so the subsequent synthetic click is swallowed.

function useLongPressOrTap({
  onTap,
  onLongPress,
  delay = 500,
}: {
  onTap: (anchor: { x: number; y: number }) => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
  delay?: number;
}) {
  const timer = useRef<number | null>(null);
  const triggered = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      triggered.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        triggered.current = true;
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(12);
        }
        if (origin.current) onLongPress(origin.current);
      }, delay);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!origin.current || timer.current == null) return;
      const dx = Math.abs(e.clientX - origin.current.x);
      const dy = Math.abs(e.clientY - origin.current.y);
      if (dx > 10 || dy > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClick: (e: React.MouseEvent) => {
      if (triggered.current) {
        e.preventDefault();
        e.stopPropagation();
        triggered.current = false;
        return;
      }
      onTap({ x: e.clientX, y: e.clientY });
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
  };
}

// ─── City row ──────────────────────────────────────────────────────────

function CityRow({
  city,
  isBase,
  isImplicitBase,
  onTap,
  onLongPress,
}: {
  city: City;
  isBase: boolean;
  isImplicitBase?: boolean;
  onTap: (anchor: { x: number; y: number }) => void;
  onLongPress: (anchor: { x: number; y: number }) => void;
}) {
  const handlers = useLongPressOrTap({ onTap, onLongPress });
  const tile = city.color ?? "#8E8E93";
  return (
    <div
      {...handlers}
      className={`flex items-center gap-3 px-4 min-h-[56px] cursor-pointer select-none active:bg-[var(--fill-quaternary)] transition ${
        isBase ? "bg-[var(--accent-tint)]" : ""
      }`}
      style={{
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--label-on-accent)] shrink-0"
        style={{ backgroundColor: tile }}
      >
        <MapPin size={16} strokeWidth={2.2} />
      </span>
      <span
        className={`flex-1 min-w-0 text-[15px] truncate ${
          isBase
            ? "font-semibold text-[var(--accent)]"
            : "text-[var(--label)]"
        }`}
      >
        {city.name}
      </span>
      <span className="w-6 flex items-center justify-end">
        {isBase ? (
          isImplicitBase ? (
            <Star
              size={20}
              strokeWidth={2}
              className="text-[var(--system-yellow)] opacity-70"
            />
          ) : (
            <Star
              size={20}
              strokeWidth={0}
              fill="var(--system-yellow)"
              className="text-[var(--system-yellow)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
            />
          )
        ) : null}
      </span>
    </div>
  );
}

// ─── Add-city modal ────────────────────────────────────────────────────
//
// Two flows in one sheet. The top half is quick-pick from the shared
// global library (cities other brigades already know about). The
// bottom half lets the user type a new name and pick a colour — used
// for custom tags like «Германия», «День ног». The Create button
// activates only when the typed name isn't already in the library.

function AddCityModal({
  open,
  onClose,
  onPickExisting,
  onCreateNew,
  unpickedFromLibrary,
}: {
  open: boolean;
  onClose: () => void;
  onPickExisting: (name: string) => void;
  onCreateNew: (name: string, color: string) => void;
  unpickedFromLibrary: City[];
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(CITY_COLOR_PRESETS[0].value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setColor(CITY_COLOR_PRESETS[0].value);
    } else {
      const t = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
  }, [open]);

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
  const matchingExisting = useMemo(
    () =>
      unpickedFromLibrary.filter((c) => {
        if (!trimmed) return true;
        return normalize(c.name).includes(normalize(trimmed));
      }),
    [unpickedFromLibrary, trimmed],
  );
  const exactMatch = unpickedFromLibrary.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = trimmed.length > 0 && !exactMatch;

  if (!open) return null;

  const submit = () => {
    if (!canCreate) return;
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
            Добавить город
          </div>
          <div className="mt-1 text-[12px] text-[var(--label-tertiary)] leading-snug">
            Выберите из справочника или создайте свой тег — «Германия», «День ног».
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Single smart input: filters the library + feeds the create flow. */}
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
                  else if (canCreate) submit();
                }
              }}
              placeholder="Название города или тега"
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

          {/* Library quick-pick. Hidden when the library has nothing to offer. */}
          {matchingExisting.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1 mb-1.5">
                Из справочника
              </div>
              <div className="bg-[var(--surface-card)] rounded-[10px] overflow-hidden divide-y divide-[var(--separator)] max-h-[230px] overflow-y-auto">
                {matchingExisting.map((c) => (
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

          {/* Create-new flow — only when the typed name doesn't already exist. */}
          {canCreate && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1 mb-1.5">
                Создать новый
              </div>
              <div className="bg-[var(--surface-card)] rounded-[10px] p-3 space-y-3">
                <div>
                  <div className="text-[11px] text-[var(--label-secondary)] mb-1.5">
                    Цвет
                  </div>
                  <div className="grid grid-cols-6 gap-2.5">
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
                {/* Preview row */}
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
            disabled={!canCreate}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40 disabled:pointer-events-none"
          >
            {canCreate ? `Создать «${trimmed}»` : "Создать"}
          </button>
        </div>
      </div>
    </div>
  );
}
