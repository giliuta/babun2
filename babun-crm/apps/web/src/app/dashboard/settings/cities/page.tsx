"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check, X, Pencil, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { Button, IOSSwitch } from "@/components/ui";
import { useCities } from "@/app/dashboard/layout";
import { generateCityId, type City } from "@/lib/cities";

function CityRow({
  city,
  onUpdate,
  onDelete,
}: {
  city: City;
  onUpdate: (updated: City) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(city.name);
  const [country, setCountry] = useState(city.country);

  const save = () => {
    if (!name.trim()) return;
    onUpdate({ ...city, name: name.trim(), country: country.trim() || "Cyprus" });
    setEditing(false);
  };

  const cancel = () => {
    setName(city.name);
    setCountry(city.country);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--accent-tint)] rounded-[10px]">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="flex-1 h-9 px-2 bg-[var(--surface-card)] border border-transparent rounded-[8px] text-[14px] text-[var(--label)] focus:outline-none focus:border-[var(--accent)]"
          placeholder="Город"
        />
        <input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-24 h-9 px-2 bg-[var(--surface-card)] border border-transparent rounded-[8px] text-[14px] text-[var(--label)] focus:outline-none focus:border-[var(--accent)]"
          placeholder="Страна"
        />
        <button
          type="button"
          onClick={save}
          className="w-8 h-8 flex items-center justify-center text-[var(--accent)] rounded-[8px] active:bg-white/50"
          aria-label="Сохранить"
        >
          <Check size={16} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={cancel}
          className="w-8 h-8 flex items-center justify-center text-[var(--label-tertiary)] rounded-[8px] active:bg-white/50"
          aria-label="Отмена"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-[10px]">
      <div className="flex-1 min-w-0">
        <div className={`text-[15px] font-medium ${city.isActive ? "text-[var(--label)]" : "text-[var(--label-tertiary)] line-through"}`}>
          {city.name}
        </div>
        <div className="text-[12px] text-[var(--label-tertiary)]">{city.country}</div>
      </div>
      <IOSSwitch
        checked={city.isActive}
        onChange={(next) => onUpdate({ ...city, isActive: next })}
        ariaLabel="Активен"
      />
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-8 h-8 flex items-center justify-center text-[var(--label-secondary)] hover:bg-[var(--fill-tertiary)] rounded-[8px]"
        aria-label="Редактировать"
      >
        <Pencil size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="w-8 h-8 flex items-center justify-center text-[var(--system-red)] hover:bg-[rgba(255,59,48,0.1)] rounded-[8px]"
        aria-label="Удалить"
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

export default function CitiesSettingsPage() {
  const { cities, setCities } = useCities();
  const [newName, setNewName] = useState("");
  const [newCountry, setNewCountry] = useState("Cyprus");
  const [addOpen, setAddOpen] = useState(false);

  const updateCity = (updated: City) => {
    setCities(cities.map((c) => (c.id === updated.id ? updated : c)));
  };

  const deleteCity = (id: string) => {
    setCities(cities.filter((c) => c.id !== id));
  };

  const addCity = () => {
    if (!newName.trim()) return;
    const newCity: City = {
      id: generateCityId(),
      name: newName.trim(),
      country: newCountry.trim() || "Cyprus",
      isActive: true,
    };
    setCities([...cities, newCity]);
    setNewName("");
    setNewCountry("Cyprus");
    setAddOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Города"
        leftContent={
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1 text-[var(--accent)] text-[13px] font-medium px-2 py-2 active:opacity-70"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
            Настройки
          </Link>
        }
        rightContent={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="text-[var(--accent)] text-[13px] font-semibold px-2 py-2 active:opacity-70"
          >
            + Добавить
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-3 pb-24">

          {addOpen && (
            <div className="bg-[var(--accent-tint)] rounded-2xl p-3 space-y-2">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                Новый город
              </div>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addCity(); if (e.key === "Escape") setAddOpen(false); }}
                  className="flex-1 h-10 px-3 bg-[var(--surface-card)] border border-transparent rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="Название города"
                />
                <input
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                  className="w-28 h-10 px-3 bg-[var(--surface-card)] border border-transparent rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none focus:border-[var(--accent)]"
                  placeholder="Страна"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="md" fullWidth onClick={() => setAddOpen(false)}>
                  Отмена
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={addCity}
                  disabled={!newName.trim()}
                >
                  Добавить
                </Button>
              </div>
            </div>
          )}

          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)]">
            {cities.length === 0 ? (
              <div className="px-4 py-8 text-center text-[14px] text-[var(--label-tertiary)]">Нет городов</div>
            ) : (
              <div className="p-2 space-y-1">
                {cities.map((city) => (
                  <CityRow
                    key={city.id}
                    city={city}
                    onUpdate={updateCity}
                    onDelete={() => deleteCity(city.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="text-[12px] text-[var(--label-tertiary)] px-4 leading-snug">
            Активные города доступны при выборе города в клиенте и записи. Отключённые скрыты, но данные сохраняются.
          </div>
        </div>
      </div>
    </>
  );
}
