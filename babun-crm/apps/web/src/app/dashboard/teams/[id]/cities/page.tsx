"use client";

// Sprint 033 Phase I6 — Brigade cities subroute, proper redesign.
//
// User feedback: the chip-wrap layout was confusing — all 5 chips
// looked equally "present" even when only 1 was actually pinned to
// the brigade, and there was no way to spot the base city without
// scanning for the little tick. Delete wasn't obvious either.
//
// New layout (iOS Settings / Telegram-contacts flavour):
//   1. Search bar (slides the list, helpful once city count grows).
//   2. ВЫБРАНЫ ДЛЯ БРИГАДЫ — list group, one row per picked city.
//      Tap row = unselect. Tap ★ = set as base. Tap pin tile shows
//      colour. Base city row highlighted with accent-tint background.
//   3. ДОСТУПНЫЕ — every other city in the directory. Tap row =
//      add to brigade. «+ Новый город» lives at the bottom of this
//      group as a ghost row, opens the inline add-form.
//   4. Edit-mode (toggle top-right) swaps row-tap from
//      select/unselect to "delete from reference" with a confirm
//      cascade.
//
// Everything still writes through existing useTeams / useCities.

import { use, useEffect, useMemo, useState } from "react";
import {
  Check,
  MapPin,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useCities, useTeams } from "@/app/dashboard/layout";
import {
  CITY_COLOR_PRESETS,
  generateCityId,
  type City,
} from "@/lib/cities";
import BrigadeSectionShell, {
  SectionCard,
} from "@/components/teams/BrigadeSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е");
}

export default function BrigadeCitiesPage({ params }: RouteParams) {
  const { id } = use(params);
  const confirm = useConfirm();
  const { teams, upsertTeam } = useTeams();
  const { cities, setCities } = useCities();
  const team = teams.find((t) => t.id === id);

  const [selected, setSelected] = useState<string[]>(team?.cities ?? []);
  const [defaultCity, setDefaultCity] = useState<string>(team?.default_city ?? "");
  const [editMode, setEditMode] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(CITY_COLOR_PRESETS[0].value);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (team) {
      setSelected(team.cities ?? []);
      setDefaultCity(team.default_city ?? "");
    }
  }, [team]);

  // ALL hooks must run before any conditional return (Rules of Hooks).
  const activeCities = useMemo(
    () => cities.filter((c) => c.isActive),
    [cities],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return activeCities;
    return activeCities.filter((c) => normalize(c.name).includes(q));
  }, [activeCities, query]);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Города / Филиалы" onSave={() => true}>
        <SectionCard>
          <div className="text-[13px] text-[var(--label-tertiary)] py-4 text-center">
            Бригада не найдена.
          </div>
        </SectionCard>
      </BrigadeSectionShell>
    );
  }

  const pickedList = filtered.filter((c) => selectedSet.has(c.name));
  const availableList = filtered.filter((c) => !selectedSet.has(c.name));

  const toggle = (cityName: string) => {
    haptic("tap");
    if (selectedSet.has(cityName)) {
      setSelected(selected.filter((c) => c !== cityName));
      if (defaultCity === cityName) setDefaultCity("");
    } else {
      setSelected([...selected, cityName]);
    }
  };

  const setBase = (cityName: string) => {
    haptic("tap");
    if (!selectedSet.has(cityName)) {
      // Adding as base also pins it to the brigade.
      setSelected([...selected, cityName]);
    }
    setDefaultCity(defaultCity === cityName ? "" : cityName);
  };

  const addNew = () => {
    const n = newName.trim();
    if (!n) return;
    if (cities.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
      // Already in the reference — just pin to brigade.
      toggle(n);
      setNewName("");
      setAdding(false);
      return;
    }
    haptic("tap");
    const created: City = {
      id: generateCityId(),
      name: n,
      country: "",
      isActive: true,
      color: newColor,
    };
    setCities([...cities, created]);
    setSelected([...selected, n]);
    setNewName("");
    setNewColor(CITY_COLOR_PRESETS[0].value);
    setAdding(false);
  };

  const removeCityGlobally = async (cityName: string) => {
    const ok = await confirm({
      title: `Удалить город «${cityName}»?`,
      message:
        "Будет удалён из справочника. Во всех бригадах, где он был выбран, автоматически снимется.",
      confirmLabel: "Удалить",
    });
    if (!ok) return;
    haptic("warning");
    setCities(cities.filter((c) => c.name !== cityName));
    teams.forEach((t) => {
      const next = (t.cities ?? []).filter((c) => c !== cityName);
      const changed =
        next.length !== (t.cities?.length ?? 0) || t.default_city === cityName;
      if (!changed) return;
      upsertTeam({
        ...t,
        cities: next.length > 0 ? next : undefined,
        default_city: t.default_city === cityName ? "" : t.default_city,
      });
    });
    setSelected((prev) => prev.filter((c) => c !== cityName));
    if (defaultCity === cityName) setDefaultCity("");
  };

  const handleSave = () => {
    haptic("tap");
    upsertTeam({
      ...team,
      cities: selected.length > 0 ? selected : undefined,
      default_city: selected.includes(defaultCity) ? defaultCity : "",
    });
    return true;
  };

  const showSearch = activeCities.length > 6;

  return (
    <BrigadeSectionShell
      brigadeId={id}
      title="Города / Филиалы"
      onSave={handleSave}
    >
      {/* ── Intro + edit toggle ────────────────────────────────────── */}
      <SectionCard>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] text-[var(--label-secondary)] leading-snug flex-1 pt-1">
            Где бригада работает. Любые теги — «Германия», «День ног» —
            появятся в календаре в своём цвете.
          </p>
          {activeCities.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setEditMode((v) => !v);
                if (!editMode) {
                  setAdding(false);
                  setQuery("");
                }
              }}
              className={`shrink-0 h-8 px-3 rounded-full text-[13px] font-medium press-scale ${
                editMode
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--fill-tertiary)] text-[var(--label)]"
              }`}
            >
              {editMode ? "Готово" : "Изменить"}
            </button>
          )}
        </div>
        {editMode && (
          <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-[10px] bg-[rgba(255,59,48,0.08)]">
            <Trash2 size={14} className="text-[var(--system-red)] shrink-0 mt-0.5" strokeWidth={2.2} />
            <span className="text-[12px] text-[var(--label-secondary)] leading-snug">
              Тап по городу — удалить из справочника. В бригадах, где
              он был выбран, автоматически снимется.
            </span>
          </div>
        )}
        {showSearch && !editMode && (
          <div className="relative mt-2">
            <Search
              size={16}
              strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--label-tertiary)] pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию"
              className="w-full h-11 pl-9 pr-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>
        )}
      </SectionCard>

      {/* ── ВЫБРАНЫ ДЛЯ БРИГАДЫ ──────────────────────────────────── */}
      {pickedList.length > 0 && (
        <div>
          <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Выбраны для бригады · {pickedList.length}
          </div>
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
            {pickedList.map((c) => (
              <CityRow
                key={c.id}
                city={c}
                selected
                isBase={defaultCity === c.name}
                editMode={editMode}
                onTap={() => (editMode ? removeCityGlobally(c.name) : toggle(c.name))}
                onStarTap={() => setBase(c.name)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── ДОСТУПНЫЕ ────────────────────────────────────────────── */}
      {(availableList.length > 0 || !adding) && (
        <div>
          <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
            Доступные · {availableList.length}
          </div>
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
            {availableList.map((c) => (
              <CityRow
                key={c.id}
                city={c}
                selected={false}
                isBase={false}
                editMode={editMode}
                onTap={() => (editMode ? removeCityGlobally(c.name) : toggle(c.name))}
              />
            ))}
            {/* Add-new row (disabled in edit / search mode) */}
            {!editMode && !query && (
              adding ? (
                <div className="p-3 bg-[var(--fill-tertiary)] space-y-3">
                  <input
                    autoFocus
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addNew();
                      if (e.key === "Escape") setAdding(false);
                    }}
                    placeholder="Название (напр. Германия, День ног)"
                    className="w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <div>
                    <div className="text-[12px] font-medium uppercase tracking-wide text-[var(--label-secondary)] mb-1.5">
                      Цвет
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {CITY_COLOR_PRESETS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setNewColor(c.value)}
                          aria-label={c.name}
                          className={`w-8 h-8 rounded-full press-scale ${
                            newColor === c.value
                              ? "ring-[3px] ring-offset-2 ring-[var(--accent)]"
                              : ""
                          }`}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAdding(false);
                        setNewName("");
                      }}
                      className="flex-1 h-10 rounded-[10px] bg-[var(--fill-secondary)] text-[14px] font-medium text-[var(--label)] press-scale"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={addNew}
                      disabled={!newName.trim()}
                      className="flex-1 h-10 rounded-[10px] bg-[var(--accent)] text-[14px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40"
                    >
                      Добавить
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] text-left active:bg-[var(--fill-quaternary)] transition press-scale"
                >
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-tint)] text-[var(--accent)] shrink-0">
                    <Plus size={18} strokeWidth={2.5} />
                  </span>
                  <span className="flex-1 text-[15px] font-medium text-[var(--accent)]">
                    Новый город или тег
                  </span>
                </button>
              )
            )}
          </div>
          {availableList.length === 0 && query && (
            <div className="px-4 pt-2 text-[12px] text-[var(--label-tertiary)]">
              Ничего не найдено по запросу «{query}».
            </div>
          )}
        </div>
      )}

      {/* ── Empty state (no cities in reference at all) ────────────── */}
      {activeCities.length === 0 && !adding && (
        <SectionCard>
          <div className="text-[13px] text-[var(--label-tertiary)] py-4 text-center">
            В справочнике пока нет городов. Нажмите «Новый город» выше.
          </div>
        </SectionCard>
      )}
    </BrigadeSectionShell>
  );
}

// ─── Single city row ───────────────────────────────────────────────────

function CityRow({
  city,
  selected,
  isBase,
  editMode,
  onTap,
  onStarTap,
}: {
  city: City;
  selected: boolean;
  isBase: boolean;
  editMode: boolean;
  onTap: () => void;
  onStarTap?: () => void;
}) {
  const tile = city.color ?? "#8E8E93";
  return (
    <div
      className={`flex items-center gap-3 px-4 min-h-[56px] ${
        editMode
          ? "bg-[rgba(255,59,48,0.04)]"
          : isBase
            ? "bg-[var(--accent-tint)]"
            : ""
      }`}
    >
      <button
        type="button"
        onClick={onTap}
        className="flex-1 min-w-0 flex items-center gap-3 py-3 text-left active:opacity-70 press-scale"
      >
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--label-on-accent)] shrink-0"
          style={{ backgroundColor: tile }}
        >
          {editMode ? (
            <Trash2 size={16} strokeWidth={2.2} />
          ) : (
            <MapPin size={16} strokeWidth={2.2} />
          )}
        </span>
        <span className="flex-1 min-w-0 flex items-center gap-1.5">
          <span
            className={`text-[15px] truncate ${
              isBase
                ? "font-semibold text-[var(--accent)]"
                : selected
                  ? "font-medium text-[var(--label)]"
                  : "text-[var(--label)]"
            }`}
          >
            {city.name}
          </span>
          {isBase && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
              базовый
            </span>
          )}
        </span>
        {!editMode && selected && (
          <Check
            size={18}
            strokeWidth={2.5}
            className={isBase ? "text-[var(--accent)]" : "text-[var(--accent)]"}
          />
        )}
        {!editMode && !selected && (
          <span className="w-[18px]" />
        )}
      </button>
      {!editMode && selected && onStarTap && (
        <button
          type="button"
          onClick={onStarTap}
          aria-label={isBase ? "Убрать статус базового" : "Сделать базовым"}
          className={`w-10 h-10 flex items-center justify-center rounded-full press-scale shrink-0 ${
            isBase
              ? "text-[var(--system-yellow)]"
              : "text-[var(--label-quaternary)]"
          } active:bg-[var(--fill-quaternary)]`}
        >
          <Star
            size={18}
            strokeWidth={2}
            fill={isBase ? "var(--system-yellow)" : "none"}
          />
        </button>
      )}
    </div>
  );
}
