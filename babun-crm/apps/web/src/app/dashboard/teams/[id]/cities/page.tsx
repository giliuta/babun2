"use client";

// Sprint 033 Phase I9 — Cities, simplified to pure iPhone/Telegram.
//
// What changed vs I8:
//  · Save button gone. Every tap persists to upsertTeam instantly —
//    behaves like iOS Settings toggles.
//  · No more ВЫБРАНЫ / ДОСТУПНЫЕ split. One alphabetical list,
//    selection shown by a right-side indicator (gold ★ for base,
//    blue ✓ for selected, nothing otherwise).
//  · Tap = toggle in one motion. Long-press (500 ms) opens an iOS
//    ActionSheet with "Сделать базовым" and "Удалить".
//  · Swipe-row removed from this page — long-press is the one extra-
//    actions mechanism. Less gesture ambiguity.
//  · Footer hint removed — discoverable by trying.

import { use, useEffect, useMemo, useRef, useState } from "react";
import { Check, MapPin, Plus, Search, Star, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useCities, useTeams } from "@/app/dashboard/layout";
import {
  CITY_COLOR_PRESETS,
  generateCityId,
  type City,
} from "@/lib/cities";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import ActionMenuModal, {
  type ActionMenuOption,
} from "@/components/calendar/ActionMenuModal";

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

  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuCity, setMenuCity] = useState<City | null>(null);

  const selected = team?.cities ?? [];
  const defaultCity = team?.default_city ?? "";

  // Hooks above any conditional return.
  const activeCities = useMemo(
    () =>
      cities
        .filter((c) => c.isActive)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
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
      <BrigadeSectionShell brigadeId={id} title="Города / Филиалы" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  const persist = (next: { cities?: string[]; default_city?: string }) => {
    upsertTeam({
      ...team,
      cities:
        next.cities !== undefined
          ? next.cities.length > 0
            ? next.cities
            : undefined
          : team.cities,
      default_city:
        next.default_city !== undefined ? next.default_city : team.default_city,
    });
  };

  const toggle = (cityName: string) => {
    haptic("tap");
    if (selectedSet.has(cityName)) {
      persist({
        cities: selected.filter((c) => c !== cityName),
        default_city: defaultCity === cityName ? "" : defaultCity,
      });
    } else {
      persist({ cities: [...selected, cityName] });
    }
  };

  const setBase = (cityName: string) => {
    haptic("tap");
    const nextSelected = selectedSet.has(cityName)
      ? selected
      : [...selected, cityName];
    persist({
      cities: nextSelected,
      default_city: defaultCity === cityName ? "" : cityName,
    });
  };

  const addNew = (name: string, color: string) => {
    const n = name.trim();
    if (!n) return;
    const dup = cities.find((c) => c.name.toLowerCase() === n.toLowerCase());
    if (dup) {
      if (!selectedSet.has(dup.name)) toggle(dup.name);
      setAddOpen(false);
      return;
    }
    haptic("tap");
    const created: City = {
      id: generateCityId(),
      name: n,
      country: "",
      isActive: true,
      color,
    };
    setCities([...cities, created]);
    persist({ cities: [...selected, n] });
    setAddOpen(false);
  };

  const removeCityGlobally = async (cityName: string) => {
    const ok = await confirm({
      title: `Удалить «${cityName}»?`,
      message:
        "Город уйдёт из справочника. Во всех бригадах, где он был выбран, автоматически снимется.",
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
  };

  const showSearch = activeCities.length > 6;
  const referenceEmpty = activeCities.length === 0 && !query;

  // Action-sheet options for the currently long-pressed city.
  const menuOptions: ActionMenuOption[] = menuCity
    ? [
        selectedSet.has(menuCity.name)
          ? {
              label:
                defaultCity === menuCity.name
                  ? "Снять с базы"
                  : "Сделать базовым",
              subtitle:
                defaultCity === menuCity.name
                  ? "Этот город перестанет быть основным"
                  : "Бригада будет открываться на этом городе по умолчанию",
              onSelect: () => setBase(menuCity.name),
            }
          : {
              label: "Добавить бригаде",
              subtitle: "Появится в календаре с этим цветом",
              onSelect: () => toggle(menuCity.name),
            },
        {
          label: "Удалить из справочника",
          subtitle: "Исчезнет из всех бригад",
          danger: true,
          onSelect: () => removeCityGlobally(menuCity.name),
        },
      ]
    : [];

  return (
    <BrigadeSectionShell
      brigadeId={id}
      title="Города / Филиалы"
      hideSave
    >
      {/* Empty state */}
      {referenceEmpty && (
        <div className="px-6 pt-8 pb-4 flex flex-col items-center text-center gap-3">
          <span className="w-16 h-16 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
            <MapPin size={28} strokeWidth={2} />
          </span>
          <div>
            <div className="text-[17px] font-semibold text-[var(--label)]">
              Пока нет ни одного города
            </div>
            <div className="mt-1 text-[13px] leading-snug text-[var(--label-secondary)]">
              Добавьте город или тег — бригада привяжется к&nbsp;нему в&nbsp;календаре.
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
      )}

      {/* Search */}
      {!referenceEmpty && showSearch && (
        <div className="relative">
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
            className="w-full h-10 pl-9 pr-9 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:ring-2 focus:ring-[var(--accent)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-[var(--fill-secondary)] text-[var(--label-tertiary)] press-scale"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}

      {/* Single unified list */}
      {!referenceEmpty && (
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
          {filtered.map((c) => (
            <CityRow
              key={c.id}
              city={c}
              selected={selectedSet.has(c.name)}
              isBase={defaultCity === c.name}
              onTap={() => toggle(c.name)}
              onLongPress={() => setMenuCity(c)}
            />
          ))}
          {filtered.length === 0 && query && (
            <div className="px-4 py-4 text-center text-[13px] text-[var(--label-tertiary)]">
              Ничего не найдено по запросу «{query}».
            </div>
          )}
          {!query && (
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
          )}
        </div>
      )}

      <AddCityModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addNew}
        existingNames={cities.map((c) => c.name)}
      />

      <ActionMenuModal
        open={!!menuCity}
        onClose={() => setMenuCity(null)}
        title={menuCity?.name ?? ""}
        options={menuOptions}
      />
    </BrigadeSectionShell>
  );
}

// ─── Long-press hook ───────────────────────────────────────────────────

function useLongPressTap({
  onTap,
  onLongPress,
  delay = 500,
}: {
  onTap: () => void;
  onLongPress: () => void;
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
        onLongPress();
      }, delay);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!origin.current || timer.current == null) return;
      const dx = Math.abs(e.clientX - origin.current.x);
      const dy = Math.abs(e.clientY - origin.current.y);
      if (dx > 10 || dy > 10) cancel();
    },
    onPointerUp: (e: React.PointerEvent) => {
      cancel();
      if (triggered.current) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        onTap();
      }
    },
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
    },
  };
}

// ─── City row ──────────────────────────────────────────────────────────

function CityRow({
  city,
  selected,
  isBase,
  onTap,
  onLongPress,
}: {
  city: City;
  selected: boolean;
  isBase: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const handlers = useLongPressTap({ onTap, onLongPress });
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
            : selected
              ? "font-medium text-[var(--label)]"
              : "text-[var(--label)]"
        }`}
      >
        {city.name}
      </span>
      <span className="w-6 flex items-center justify-end">
        {isBase ? (
          <Star
            size={20}
            strokeWidth={0}
            fill="var(--system-yellow)"
            className="text-[var(--system-yellow)] drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
          />
        ) : selected ? (
          <Check
            size={20}
            strokeWidth={3}
            className="text-[var(--accent)]"
          />
        ) : null}
      </span>
    </div>
  );
}

// ─── Add-city modal ────────────────────────────────────────────────────

function AddCityModal({
  open,
  onClose,
  onAdd,
  existingNames,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, color: string) => void;
  existingNames: string[];
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(CITY_COLOR_PRESETS[0].value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset fields whenever the modal is closed.
  useEffect(() => {
    if (!open) {
      setName("");
      setColor(CITY_COLOR_PRESETS[0].value);
    }
  }, [open]);

  if (!open) return null;

  const trimmed = name.trim();
  const isDup =
    trimmed.length > 0 &&
    existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());
  const canAdd = trimmed.length > 0 && !isDup;

  const submit = () => {
    if (!canAdd) return;
    onAdd(trimmed, color);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[360px] bg-[var(--surface-grouped)] rounded-[16px] overflow-hidden shadow-[var(--shadow-sheet)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 bg-[var(--surface-card)] border-b border-[var(--separator)] text-center">
          <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            Новый город или тег
          </div>
          <div className="mt-1 text-[12px] text-[var(--label-tertiary)] leading-snug">
            Любое название — «Пафос», «Германия», «День ног».
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
              Название
            </label>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") onClose();
              }}
              placeholder="Напр. Пафос"
              className="mt-1 w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              maxLength={40}
            />
            {isDup && (
              <div className="mt-1 px-1 text-[12px] text-[var(--system-red)]">
                Такое название уже есть — откройте список и выберите.
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1 mb-1.5">
              Цвет
            </div>
            <div className="bg-[var(--surface-card)] rounded-[10px] p-3">
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
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1 mb-1.5">
              Предпросмотр
            </div>
            <div className="bg-[var(--surface-card)] rounded-[10px] overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--label-on-accent)] shrink-0"
                  style={{ backgroundColor: color }}
                >
                  <MapPin size={16} strokeWidth={2.2} />
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={`block text-[15px] truncate ${
                      trimmed
                        ? "font-medium text-[var(--label)]"
                        : "text-[var(--label-tertiary)]"
                    }`}
                  >
                    {trimmed || "Название города"}
                  </span>
                </span>
                <Check
                  size={20}
                  strokeWidth={3}
                  className="text-[var(--accent)]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 pt-1 flex gap-2">
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
            disabled={!canAdd}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[15px] font-semibold text-[var(--label-on-accent)] press-scale disabled:opacity-40 disabled:pointer-events-none"
          >
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}
