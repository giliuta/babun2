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

import { use, useMemo, useState } from "react";
import {
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { useCities, useTeams } from "@/components/layout/DashboardClientLayout";
import {
  generateCityId,
  type City,
} from "@babun/shared/local/cities";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import ContextMenu, {
  type ContextMenuOption,
} from "@/components/ui/ContextMenu";
import SwipeableRow from "@/components/ui/SwipeableRow";
// v492 — row + add-modal are now shared with the personal labels
// page at /dashboard/settings/calendar/labels. UX bug-fixes propagate
// to both.
import AddLabelModal from "@/components/labels/AddLabelModal";
import { LabelRow as CityRow } from "@/components/labels/LabelRow";

interface RouteParams {
  params: Promise<{ id: string }>;
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

  // BUGFIX (bug-hunt sweep) — `usedInOtherBrigades` useMemo (was at
  // line 287 below) was after the `if (!team) early-return`,
  // violating rules-of-hooks. Hoisted here to satisfy the rule;
  // dependencies don't reference `team` directly so it computes
  // safely either way.
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

  if (!team) {
    return (
      <BrigadeSectionShell
        brigadeId={id}
        backHref={`/dashboard/teams/${id}/calendar`}
        title="Метки"
        hideSave
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Команда не найдена.
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

  // (`usedInOtherBrigades` useMemo hoisted above the early return —
  // see bug-hunt bugfix comment.)

  return (
    <BrigadeSectionShell
      brigadeId={id}
      backHref={`/dashboard/teams/${id}/calendar`}
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
              У команды пока нет меток
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

      <AddLabelModal
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

