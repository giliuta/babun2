"use client";

// Sprint 033 Phase H — Brigade cities / filials / tags subroute.

import { use, useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useCities, useTeams } from "@/app/dashboard/layout";
import {
  CITY_COLOR_PRESETS,
  generateCityId,
  type City,
} from "@/lib/cities";
import BrigadeSectionShell, {
  SectionCard,
  FieldRow,
} from "@/components/teams/BrigadeSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadeCitiesPage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams, upsertTeam } = useTeams();
  const { cities, setCities } = useCities();

  const team = teams.find((t) => t.id === id);
  const [selected, setSelected] = useState<string[]>(team?.cities ?? []);
  const [defaultCity, setDefaultCity] = useState<string>(team?.default_city ?? "");

  useEffect(() => {
    if (team) {
      setSelected(team.cities ?? []);
      setDefaultCity(team.default_city ?? "");
    }
  }, [team]);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(CITY_COLOR_PRESETS[0].value);

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

  const activeCities = cities.filter((c) => c.isActive);

  const toggle = (cityName: string) => {
    haptic("tap");
    if (selected.includes(cityName)) {
      setSelected(selected.filter((c) => c !== cityName));
      if (defaultCity === cityName) setDefaultCity("");
    } else {
      setSelected([...selected, cityName]);
    }
  };

  const addNew = () => {
    const n = newName.trim();
    if (!n) return;
    if (cities.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
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

  const handleSave = () => {
    haptic("tap");
    upsertTeam({
      ...team,
      cities: selected.length > 0 ? selected : undefined,
      default_city: selected.includes(defaultCity) ? defaultCity : "",
    });
    return true;
  };

  return (
    <BrigadeSectionShell
      brigadeId={id}
      title="Города / Филиалы"
      onSave={handleSave}
    >
      <SectionCard subtitle="Где бригада работает. Любые теги — «Германия», «День ног» — появятся в календаре в своём цвете.">
        <div className="flex flex-wrap gap-2">
          {activeCities.map((c) => {
            const isSel = selected.includes(c.name) || defaultCity === c.name;
            const isBase = defaultCity === c.name;
            const tint = c.color ?? "var(--accent)";
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.name)}
                className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[14px] font-medium press-scale transition ${
                  isBase
                    ? "text-[var(--label-on-accent)]"
                    : isSel
                      ? "text-[var(--label)]"
                      : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                }`}
                style={
                  isBase
                    ? { backgroundColor: tint }
                    : isSel
                      ? { backgroundColor: `${tint}22`, color: tint }
                      : undefined
                }
              >
                {c.color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />}
                {c.name}
                {isBase && <Check size={14} strokeWidth={2.5} />}
              </button>
            );
          })}
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-full text-[14px] font-medium bg-[var(--accent-tint)] text-[var(--accent)] press-scale"
            >
              <Plus size={14} strokeWidth={2.5} />
              Добавить
            </button>
          )}
        </div>

        {adding && (
          <div className="bg-[var(--fill-tertiary)] rounded-[10px] p-3 space-y-3 mt-3">
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
                      newColor === c.value ? "ring-[3px] ring-offset-2 ring-[var(--accent)]" : ""
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setAdding(false); setNewName(""); }}
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
        )}

        {selected.length > 0 && (
          <FieldRow label="Базовый город">
            <select
              value={defaultCity}
              onChange={(e) => setDefaultCity(e.target.value)}
              className="w-full h-11 px-3 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] text-[var(--label)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="">— не выбран —</option>
              {selected.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="text-[12px] text-[var(--label-tertiary)] mt-1.5">
              Ставится дефолтом на каждый день.
            </div>
          </FieldRow>
        )}
      </SectionCard>
    </BrigadeSectionShell>
  );
}
