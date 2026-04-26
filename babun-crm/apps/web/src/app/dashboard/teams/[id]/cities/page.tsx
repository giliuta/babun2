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
  Pencil,
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
} from "@babun/shared/local/cities";
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
  const { teams, upsertTeam, setTeams } = useTeams();
  const { cities, setCities } = useCities();
  const team = teams.find((t) => t.id === id);

  const [addOpen, setAddOpen] = useState(false);
  // Phase I40 — edit mode for an existing label; null when not editing.
  const [editing, setEditing] = useState<{
    name: string;
    color: string;
  } | null>(null);
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
      <BrigadeSectionShell brigadeId={id} title="Метки" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  // Phase I40 — the base city is NO LONGER auto-assigned. The user
  // explicitly stars one (swipe right) or leaves every row unstarred
  // — in which case the calendar shows a grey «+ метка» chip per day
  // instead of auto-painting one label under every date.
  const effectiveBase =
    defaultCity && brigadeCityNames.includes(defaultCity) ? defaultCity : "";

  const resolveBase = (nextCities: string[], prevBase: string): string => {
    // Keep prevBase if still valid; otherwise drop to "" (no forced
    // first-element fallback).
    if (prevBase && nextCities.includes(prevBase)) return prevBase;
    return "";
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
    haptic("tap");
    // Phase I40 — toggle: swipe right on the starred row unsets
    // primary (default_city becomes ""). Swipe right on an unstarred
    // row makes it the new primary.
    const nextBase = defaultCity === cityName ? "" : cityName;
    upsertTeam({ ...team, default_city: nextBase });
  };

  // Phase I40 — edit an existing label (rename + colour). The label
  // name lives in three places: the global library (City), every
  // brigade's cities[] array that references it, and default_city
  // fields when this label is a brigade's primary. We cascade the
  // rename through all three so no brigade is left with a dangling
  // reference. dayCities (per-date overrides) are intentionally left
  // alone — their user-visible colour comes from a library lookup by
  // name, so when the library entry renames, the dashboard picker's
  // dangling entries just stop resolving (UX: user re-taps to
  // re-assign). Cascading those too would require touching another
  // context; defer.
  const editCity = (oldName: string, newName: string, color: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    haptic("tap");

    // 1. Library — find the City by the OLD name, update its name
    //    and color. If a different City with the new name already
    //    exists, we merge: drop the old one, keep the new.
    const existingWithNewName =
      trimmed.toLowerCase() !== oldName.toLowerCase() &&
      cities.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    let nextLibrary: City[];
    if (existingWithNewName) {
      nextLibrary = cities
        .filter((c) => c.name !== oldName)
        .map((c) =>
          c.id === existingWithNewName.id ? { ...c, color } : c,
        );
    } else {
      nextLibrary = cities.map((c) =>
        c.name === oldName ? { ...c, name: trimmed, color } : c,
      );
    }
    setCities(nextLibrary);

    // 2. Every brigade that references the old name: replace in
    //    cities[] and fix default_city if it matches.
    if (oldName !== trimmed) {
      const nextTeams = teams.map((t) => {
        const usesOld = (t.cities ?? []).includes(oldName);
        const baseWasOld = t.default_city === oldName;
        if (!usesOld && !baseWasOld) return t;
        const nextCities = (t.cities ?? []).map((n) =>
          n === oldName ? trimmed : n,
        );
        // Dedup in case the brigade already had both.
        const deduped = Array.from(new Set(nextCities));
        return {
          ...t,
          cities: deduped,
          default_city: baseWasOld ? trimmed : t.default_city,
        };
      });
      setTeams(nextTeams);
    }

    setEditing(null);
  };

  const openMenu = (cityName: string, anchor: { x: number; y: number }) => {
    setMenu({ cityName, anchor });
  };

  // Context menu — toggle primary, edit, delete.
  const menuOptions: ContextMenuOption[] = menu
    ? [
        {
          label:
            effectiveBase === menu.cityName
              ? "Снять основной"
              : "Сделать основным",
          icon: (
            <Star
              size={18}
              strokeWidth={2}
              fill={
                effectiveBase === menu.cityName
                  ? "none"
                  : "var(--system-yellow)"
              }
              className="text-[var(--system-yellow)]"
            />
          ),
          onSelect: () => setBase(menu.cityName),
        },
        {
          label: "Редактировать",
          icon: <Pencil size={18} strokeWidth={2} />,
          onSelect: () => {
            const libraryCity = cities.find((c) => c.name === menu.cityName);
            setEditing({
              name: menu.cityName,
              color: libraryCity?.color ?? "#8E8E93",
            });
          },
        },
        {
          label: "Удалить",
          icon: <Trash2 size={18} strokeWidth={2} />,
          danger: true,
          onSelect: () => removeCity(menu.cityName),
        },
      ]
    : [];

  const listEmpty = rows.length === 0;

  // Suggestions for the Add modal — only tags the user ALREADY added
  // somewhere else in this account (other brigades of this tenant).
  // SaaS-correct: no universal "справочник", only my own history.
  const usedInOtherBrigades = useMemo(() => {
    const inUse = new Set<string>();
    teams.forEach((t) => {
      if (t.id === id) return;
      (t.cities ?? []).forEach((n) => inUse.add(n));
    });
    return cities
      .filter(
        (c) =>
          inUse.has(c.name) &&
          !brigadeCityNames.some(
            (n) => n.toLowerCase() === c.name.toLowerCase(),
          ),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [cities, teams, id, brigadeCityNames]);

  return (
    <BrigadeSectionShell
      brigadeId={id}
      title="Метки"
      hideSave
    >
      {listEmpty ? (
        <div className="px-6 pt-8 pb-4 flex flex-col items-center text-center gap-3">
          <span className="w-16 h-16 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
            <MapPin size={28} strokeWidth={2} />
          </span>
          <div>
            <div className="text-[17px] font-semibold text-[var(--label)]">
              У бригады пока нет меток
            </div>
            <div className="mt-1 text-[13px] leading-snug text-[var(--label-secondary)]">
              Добавьте пару меток и пометьте одну как основную — тогда
              она автоматически появится под каждой датой своим цветом.
              Без основной под датой будет серая иконка выбора.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-3 h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
          >
            Добавить метку
          </button>
        </div>
      ) : (
        <>
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
            {rows.map((c) => (
              <SwipeableRow
                key={c.id}
                leftActions={[
                  {
                    label: effectiveBase === c.name ? "Снять" : "Основной",
                    color: "bg-[var(--system-yellow)]",
                    icon: (
                      <Star
                        size={16}
                        strokeWidth={2}
                        fill={effectiveBase === c.name ? "none" : "white"}
                      />
                    ),
                    onSelect: () => setBase(c.name),
                  },
                ]}
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
                Новая метка
              </span>
            </button>
          </div>

          {/* Hint: one line only, very subtle. */}
          <div className="px-4 pt-0.5 text-[12px] leading-snug text-[var(--label-tertiary)]">
            Свайп вправо —{" "}
            <span className="text-[color:var(--system-yellow-strong,#B78600)] font-medium">
              основной
            </span>{" "}
            (повторно — снять). Свайп влево —{" "}
            <span className="text-[var(--system-red)] font-medium">удалить</span>
            . Долгое нажатие — меню.
          </div>
          {!effectiveBase && (
            <div className="px-4 pt-2 text-[12px] leading-snug text-[var(--label-tertiary)]">
              Нет основной — под каждой датой серая плашка выбора метки.
              Выделите одну звездой, чтобы она появилась автоматом.
            </div>
          )}
        </>
      )}

      <AddCityModal
        open={addOpen || editing !== null}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onPickExisting={(name) => addCity(name, "#8E8E93")}
        onCreateNew={(name, color) => addCity(name, color)}
        onUpdate={editCity}
        initial={editing}
        suggestions={usedInOtherBrigades}
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
  onUpdate,
  initial,
  suggestions,
}: {
  open: boolean;
  onClose: () => void;
  onPickExisting: (name: string) => void;
  onCreateNew: (name: string, color: string) => void;
  /** When `initial` is provided the modal goes into edit mode: title
   *  changes, suggestions are hidden, and submit calls `onUpdate`. */
  onUpdate?: (oldName: string, newName: string, color: string) => void;
  initial?: { name: string; color: string } | null;
  /** Tags the user already added for OTHER brigades in this account.
   *  Replaces the old "справочник" language — SaaS-correct source of
   *  truth: only your own history, not a universal catalogue. */
  suggestions: City[];
}) {
  const isEdit = Boolean(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [color, setColor] = useState<string>(
    initial?.color ?? CITY_COLOR_PRESETS[0].value,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
  const matchingSuggestions = useMemo(
    () => {
      if (isEdit) return [];
      return suggestions.filter((c) => {
        if (!trimmed) return true;
        return normalize(c.name).includes(normalize(trimmed));
      });
    },
    [suggestions, trimmed, isEdit],
  );
  const exactMatch =
    !isEdit &&
    suggestions.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
    );
  // In edit mode the trimmed name is allowed to stay the same — user
  // might just be changing the colour.
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
              ? "Поменяйте название или цвет. Применится во всех бригадах, где используется эта метка."
              : "Город, район, направление — что угодно. Появится в календаре в выбранном цвете."}
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

          {/* Suggestions pulled from OTHER brigades of this account.
              Hidden when you have no brigades that already use tags. */}
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

          {/* Create-new / edit flow. In edit mode the suggestion list
              is hidden (isEdit blocks matchingSuggestions), so this
              panel is always shown. In create mode it appears only
              when the typed name doesn't already exist in the library. */}
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
            disabled={!canSubmit}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40 disabled:pointer-events-none"
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
