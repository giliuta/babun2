"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
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
      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="flex-1 px-2 py-1 border border-indigo-300 rounded-lg text-sm bg-white"
          placeholder="Город"
        />
        <input
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-24 px-2 py-1 border border-indigo-300 rounded-lg text-sm bg-white"
          placeholder="Страна"
        />
        <button type="button" onClick={save} className="text-indigo-700 text-sm font-semibold px-2">✓</button>
        <button type="button" onClick={cancel} className="text-gray-400 text-sm px-1">✕</button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${city.isActive ? "bg-white" : "bg-gray-50"}`}>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${city.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}>
          {city.name}
        </div>
        <div className="text-[11px] text-gray-400">{city.country}</div>
      </div>
      <button
        type="button"
        onClick={() => onUpdate({ ...city, isActive: !city.isActive })}
        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${city.isActive ? "bg-indigo-600" : "bg-gray-300"}`}
        aria-label="Toggle active"
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${city.isActive ? "translate-x-4" : "translate-x-0"}`} />
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-lg"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="w-7 h-7 flex items-center justify-center text-rose-400 hover:bg-rose-50 rounded-lg"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
        </svg>
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
            className="flex items-center gap-1 text-white/80 lg:text-indigo-600 text-sm px-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Настройки
          </Link>
        }
        rightContent={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="text-white lg:text-indigo-600 text-sm font-semibold px-2"
          >
            + Добавить
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-lg mx-auto p-3 lg:p-4 space-y-2 pb-24">

          {addOpen && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
              <div className="text-xs font-semibold text-indigo-700">Новый город</div>
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addCity(); if (e.key === "Escape") setAddOpen(false); }}
                  className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg text-sm bg-white"
                  placeholder="Название города"
                />
                <input
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                  className="w-28 px-3 py-2 border border-indigo-300 rounded-lg text-sm bg-white"
                  placeholder="Страна"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={addCity}
                  disabled={!newName.trim()}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {cities.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Нет городов</div>
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

          <div className="text-[11px] text-gray-400 px-1">
            Активные города доступны при выборе города в клиенте и записи. Отключённые скрыты, но данные сохраняются.
          </div>
        </div>
      </div>
    </>
  );
}
