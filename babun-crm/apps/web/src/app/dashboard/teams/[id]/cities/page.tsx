"use client";

// Sprint 033 Phase I8 — Cities page, Ultrathink pass.
//
// Design goals (from iPhone walkthrough with the user):
//  · Telegram-like iOS light feel. Grouped cards + hairline separators.
//  · Swipe the row to reveal actions (delete on left-swipe,
//    toggle-base on right-swipe). Visible star button stays as a
//    discoverable shortcut for base-toggle.
//  · Adding a city must feel deliberate — a centered modal with name,
//    colour palette, and a live preview tile. Not an inline form that
//    breaks the scroll flow.
//  · Empty state when the reference book is actually empty, with a
//    direct "Добавить первый город" primary button.

import { use, useEffect, useMemo, useRef, useState } from "react";
import { Check, MapPin, Plus, Search, Star, Trash2, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useCities, useTeams } from "@/app/dashboard/layout";
import {
  CITY_COLOR_PRESETS,
  generateCityId,
  type City,
} from "@/lib/cities";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import SwipeableRow from "@/components/ui/SwipeableRow";

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
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (team) {
      setSelected(team.cities ?? []);
      setDefaultCity(team.default_city ?? "");
    }
  }, [team]);

  // Hooks above any conditional return (Rules of Hooks).
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
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
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
      setSelected([...selected, cityName]);
    }
    setDefaultCity(defaultCity === cityName ? "" : cityName);
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
    setSelected([...selected, n]);
    setAddOpen(false);
  };

  const removeCityGlobally = async (cityName: string) => {
    const ok = await confirm({
      title: `Удалить город «${cityName}»?`,
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
  const referenceEmpty = activeCities.length === 0 && !query;

  return (
    <BrigadeSectionShell
      brigadeId={id}
      title="Города / Филиалы"
      onSave={handleSave}
    >
      {/* Empty state — reference book has nothing yet. */}
      {referenceEmpty && (
        <div className="px-6 pt-6 pb-4 flex flex-col items-center text-center gap-3">
          <span className="w-14 h-14 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)]">
            <MapPin size={26} strokeWidth={2} />
          </span>
          <div>
            <div className="text-[17px] font-semibold text-[var(--label)]">
              Пока нет ни одного города
            </div>
            <div className="mt-1 text-[13px] leading-snug text-[var(--label-secondary)]">
              Добавьте первый город или тег — бригада начнёт привязываться к нему в&nbsp;календаре.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-2 h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold press-scale"
          >
            Добавить город
          </button>
        </div>
      )}

      {/* Search field — lifted from any card so it sits above sections. */}
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

      {/* ── ВЫБРАНЫ ──────────────────────────────────────────────── */}
      {!referenceEmpty && pickedList.length > 0 && (
        <ListSection title="ВЫБРАНЫ" count={pickedList.length}>
          {pickedList.map((c) => (
            <SwipeableRow
              key={c.id}
              leftActions={[
                {
                  label: defaultCity === c.name ? "Снять ★" : "Базовый",
                  color: "bg-[var(--system-yellow)]",
                  icon: (
                    <Star
                      size={16}
                      strokeWidth={2}
                      fill={defaultCity === c.name ? "none" : "white"}
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
                  onSelect: () => removeCityGlobally(c.name),
                },
              ]}
            >
              <CityRow
                city={c}
                selected
                isBase={defaultCity === c.name}
                onTap={() => toggle(c.name)}
                onStarTap={() => setBase(c.name)}
              />
            </SwipeableRow>
          ))}
        </ListSection>
      )}

      {/* ── ДОСТУПНЫЕ / ВСЕ ─────────────────────────────────────── */}
      {!referenceEmpty && (
        <ListSection
          title={pickedList.length > 0 ? "ДОСТУПНЫЕ" : "ВСЕ ГОРОДА"}
          count={availableList.length}
        >
          {availableList.map((c) => (
            <SwipeableRow
              key={c.id}
              rightActions={[
                {
                  label: "Удалить",
                  color: "bg-[var(--system-red)]",
                  icon: <Trash2 size={16} strokeWidth={2} />,
                  onSelect: () => removeCityGlobally(c.name),
                },
              ]}
            >
              <CityRow
                city={c}
                selected={false}
                isBase={false}
                onTap={() => toggle(c.name)}
              />
            </SwipeableRow>
          ))}
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
          {availableList.length === 0 && query && (
            <div className="px-4 py-3 text-[13px] text-[var(--label-tertiary)]">
              Ничего не найдено по запросу «{query}».
            </div>
          )}
        </ListSection>
      )}

      {/* Footer hint — subtle, single line. */}
      {!referenceEmpty && (
        <div className="px-4 pt-0.5 text-[12px] leading-snug text-[var(--label-tertiary)]">
          Свайп влево —{" "}
          <span className="text-[var(--system-red)] font-medium">удалить</span>{" "}
          из справочника. Свайп вправо —{" "}
          <span className="text-[color:var(--system-yellow-strong,#B78600)] font-medium">
            базовый
          </span>
          . Тап по&nbsp;★&nbsp;тоже работает.
        </div>
      )}

      <AddCityModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={addNew}
        existingNames={cities.map((c) => c.name)}
      />
    </BrigadeSectionShell>
  );
}

// ─── List section helper ───────────────────────────────────────────────

function ListSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
        {typeof count === "number" && (
          <span className="ml-1 text-[var(--label-tertiary)] font-normal normal-case tracking-normal">
            · {count}
          </span>
        )}
      </div>
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
        {children}
      </div>
    </div>
  );
}

// ─── City row ──────────────────────────────────────────────────────────

function CityRow({
  city,
  selected,
  isBase,
  onTap,
  onStarTap,
}: {
  city: City;
  selected: boolean;
  isBase: boolean;
  onTap: () => void;
  onStarTap?: () => void;
}) {
  const tile = city.color ?? "#8E8E93";
  return (
    <div
      className={`flex items-center gap-3 px-4 min-h-[56px] ${
        isBase ? "bg-[var(--accent-tint)]" : ""
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
          <MapPin size={16} strokeWidth={2.2} />
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
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] bg-[var(--accent)] text-[var(--label-on-accent)]">
              база
            </span>
          )}
        </span>
        {selected ? (
          <Check size={18} strokeWidth={2.5} className="text-[var(--accent)]" />
        ) : (
          <span className="w-[18px]" />
        )}
      </button>
      {selected && onStarTap && (
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

// ─── Add-city modal ────────────────────────────────────────────────────
//
// Centered iOS-style sheet. Keeps the user's flow on the page — no
// route push, no full-screen takeover. Matches CityPickerModal chrome
// for consistency across all modals in the app.

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

  useEffect(() => {
    if (!open) {
      setName("");
      setColor(CITY_COLOR_PRESETS[0].value);
    } else {
      // Small delay to let the modal mount before focusing — iOS Safari
      // otherwise skips the keyboard raise on first open.
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

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
        {/* Header */}
        <div className="px-5 pt-5 pb-3 bg-[var(--surface-card)] border-b border-[var(--separator)] text-center">
          <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            Новый город или тег
          </div>
          <div className="mt-1 text-[12px] text-[var(--label-tertiary)] leading-snug">
            Любое название — «Пафос», «Германия», «День ног». Цвет
            подтянется в календарь.
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Name input */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] px-1">
              Название
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Напр. Пафос"
              className="mt-1 w-full h-11 px-3 rounded-[10px] bg-[var(--surface-card)] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              maxLength={40}
            />
            {isDup && (
              <div className="mt-1 px-1 text-[12px] text-[var(--system-red)]">
                Такое название уже есть — откройте список и выберите его.
              </div>
            )}
          </div>

          {/* Colour palette */}
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

          {/* Live preview */}
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
                  size={18}
                  strokeWidth={2.5}
                  className="text-[var(--accent)]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
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
