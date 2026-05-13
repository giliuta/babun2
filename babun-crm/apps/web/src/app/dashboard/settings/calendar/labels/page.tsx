"use client";

// v492 — personal-calendar labels page. Mirrors the brigade
// `/dashboard/teams/[id]/cities` UX (rows + swipe gestures + star /
// edit / delete) but writes to `CalendarSettings.personalLabels` and
// `personalDefaultLabel` instead of `team.cities` / `team.default_city`.
//
// Shares `AddLabelModal` and `LabelRow` with the brigade page so
// behaviour stays identical — fix once, fix everywhere.

import { useMemo, useState } from "react";
import {
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import {
  useCalendarSettings,
  useCities,
  useTeams,
} from "@/components/layout/DashboardClientLayout";
import {
  generateCityId,
  type City,
} from "@babun/shared/local/cities";
import PageHeader from "@/components/layout/PageHeader";
import ContextMenu, {
  type ContextMenuOption,
} from "@/components/ui/ContextMenu";
import SwipeableRow from "@/components/ui/SwipeableRow";
import AddLabelModal from "@/components/labels/AddLabelModal";
import { LabelRow } from "@/components/labels/LabelRow";

export default function PersonalLabelsPage() {
  const { calendarSettings, setCalendarSettings } = useCalendarSettings();
  const { cities, setCities } = useCities();
  const { teams } = useTeams();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<{
    name: string;
    color: string;
  } | null>(null);
  const [menu, setMenu] = useState<{
    cityName: string;
    anchor: { x: number; y: number };
  } | null>(null);

  const personalLabels = calendarSettings.personalLabels ?? [];
  const defaultLabel = calendarSettings.personalDefaultLabel ?? "";

  // Resolve each name to a City entry from the global library (with
  // colour). Missing entries get a neutral grey ghost so the row still
  // renders something tap-able.
  const rows = useMemo<City[]>(() => {
    return personalLabels.map((name) => {
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
  }, [personalLabels, cities]);

  // Labels already used by some brigade in the tenant — surface them
  // as quick-pick suggestions when the user opens the «Новая метка»
  // sheet, just like the brigade page does the reverse.
  const usedElsewhere = useMemo<City[]>(() => {
    const inUse = new Set<string>();
    teams.forEach((t) => (t.cities ?? []).forEach((n) => inUse.add(n)));
    return cities
      .filter(
        (c) =>
          inUse.has(c.name) &&
          !personalLabels.some(
            (n) => n.toLowerCase() === c.name.toLowerCase(),
          ),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [cities, teams, personalLabels]);

  const effectiveBase =
    defaultLabel && personalLabels.includes(defaultLabel) ? defaultLabel : "";

  const resolveBase = (next: string[], prev: string): string =>
    prev && next.includes(prev) ? prev : "";

  const persist = (nextLabels: string[], prevBase: string) => {
    // v493 — pass the array as-is (even empty). The repo writes []
    // to Supabase as null, but the explicit write is required to
    // clear stale entries when the user removes the last label. The
    // previous «empty → undefined» short-circuit left Supabase with
    // the old labels because the repo's `if (patch !== undefined)`
    // gate skipped the write, and the next realtime resync brought
    // the deleted labels back.
    setCalendarSettings({
      ...calendarSettings,
      personalLabels: nextLabels,
      personalDefaultLabel: resolveBase(nextLabels, prevBase) || undefined,
    });
  };

  const addLabel = (name: string, color: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // If the library already has this name, reuse its entry (and
    // reactivate if it was hidden); else create a new library row.
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
    if (!personalLabels.includes(resolvedName)) {
      persist([...personalLabels, resolvedName], defaultLabel);
    }
    haptic("tap");
    setAddOpen(false);
  };

  const removeLabel = (name: string) => {
    haptic("warning");
    persist(
      personalLabels.filter((n) => n !== name),
      defaultLabel === name ? "" : defaultLabel,
    );
  };

  const setBase = (name: string) => {
    haptic("tap");
    // Toggle: tapping star on the current primary unsets it.
    const next = defaultLabel === name ? "" : name;
    setCalendarSettings({
      ...calendarSettings,
      personalDefaultLabel: next || undefined,
    });
  };

  const editLabel = (oldName: string, newName: string, color: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    haptic("tap");

    // 1) Update the global library entry (rename + colour). If a
    //    different entry with the new name exists, merge into it.
    const existingWithNewName =
      trimmed.toLowerCase() !== oldName.toLowerCase() &&
      cities.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    const nextLibrary: City[] = existingWithNewName
      ? cities
          .filter((c) => c.name !== oldName)
          .map((c) =>
            c.id === existingWithNewName.id ? { ...c, color } : c,
          )
      : cities.map((c) =>
          c.name === oldName ? { ...c, name: trimmed, color } : c,
        );
    setCities(nextLibrary);

    // 2) Cascade the rename through personal labels list + default.
    if (oldName !== trimmed) {
      const nextLabels = Array.from(
        new Set(personalLabels.map((n) => (n === oldName ? trimmed : n))),
      );
      const nextDefault =
        defaultLabel === oldName ? trimmed : defaultLabel;
      setCalendarSettings({
        ...calendarSettings,
        personalLabels: nextLabels.length > 0 ? nextLabels : undefined,
        personalDefaultLabel: nextDefault || undefined,
      });
    }

    setEditing(null);
  };

  const openMenu = (cityName: string, anchor: { x: number; y: number }) => {
    setMenu({ cityName, anchor });
  };

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
          onSelect: () => removeLabel(menu.cityName),
        },
      ]
    : [];

  const listEmpty = rows.length === 0;

  return (
    <>
      <PageHeader title="Метки" backHref="/dashboard/settings/calendar" />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-3 pb-24">
          {listEmpty ? (
            <div className="px-6 pt-8 pb-4 flex flex-col items-center text-center gap-3">
              <span className="w-16 h-16 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
                <MapPin size={28} strokeWidth={2} />
              </span>
              <div>
                <div className="text-[17px] font-semibold text-[var(--label)]">
                  В личном календаре пока нет меток
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
                        label:
                          effectiveBase === c.name ? "Снять" : "Основной",
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
                        onSelect: () => removeLabel(c.name),
                      },
                    ]}
                  >
                    <LabelRow
                      city={c}
                      isBase={effectiveBase === c.name}
                      isImplicitBase={
                        effectiveBase === c.name && defaultLabel !== c.name
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

              <div className="px-4 pt-0.5 text-[12px] leading-snug text-[var(--label-tertiary)]">
                Свайп вправо —{" "}
                <span className="text-[color:var(--system-yellow-strong,#B78600)] font-medium">
                  основной
                </span>{" "}
                (повторно — снять). Свайп влево —{" "}
                <span className="text-[var(--system-red)] font-medium">
                  удалить
                </span>
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
        </div>
      </div>

      <AddLabelModal
        open={addOpen || editing !== null}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onPickExisting={(name) => addLabel(name, "#8E8E93")}
        onCreateNew={(name, color) => addLabel(name, color)}
        onUpdate={editLabel}
        initial={editing}
        suggestions={usedElsewhere}
      />

      <ContextMenu
        open={!!menu}
        onClose={() => setMenu(null)}
        anchor={menu?.anchor ?? null}
        title={menu?.cityName}
        options={menuOptions}
      />
    </>
  );
}
