"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { useLocationLabels } from "@/app/dashboard/layout";
import {
  generateLocationLabelId,
  type LocationLabel,
} from "@/lib/location-labels";

function LabelRow({
  label,
  onUpdate,
  onDelete,
}: {
  label: LocationLabel;
  onUpdate: (updated: LocationLabel) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);

  const save = () => {
    if (!name.trim()) return;
    onUpdate({ ...label, name: name.trim() });
    setEditing(false);
  };

  const cancel = () => {
    setName(label.name);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          className="flex-1 px-2 py-1 border border-indigo-300 rounded-lg text-sm bg-white"
          placeholder="Название"
        />
        <button type="button" onClick={save} className="text-indigo-700 text-sm font-semibold px-2">✓</button>
        <button type="button" onClick={cancel} className="text-gray-400 text-sm px-1">✕</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 truncate">
          {label.name}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-7 h-7 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-lg"
        aria-label="Редактировать"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="w-7 h-7 flex items-center justify-center text-rose-400 hover:bg-rose-50 rounded-lg"
        aria-label="Удалить"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" />
        </svg>
      </button>
    </div>
  );
}

export default function BookingSettingsPage() {
  const { locationLabels, setLocationLabels } = useLocationLabels();
  const [newName, setNewName] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const updateLabel = (updated: LocationLabel) => {
    setLocationLabels(
      locationLabels.map((l) => (l.id === updated.id ? updated : l))
    );
  };

  const deleteLabel = (id: string) => {
    setLocationLabels(locationLabels.filter((l) => l.id !== id));
  };

  const addLabel = () => {
    if (!newName.trim()) return;
    const nextLabel: LocationLabel = {
      id: generateLocationLabelId(),
      name: newName.trim(),
    };
    setLocationLabels([...locationLabels, nextLabel]);
    setNewName("");
    setAddOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Типы объектов"
        leftContent={
          <Link
            href="/dashboard/settings/calendar"
            className="flex items-center gap-1 text-white/80 lg:text-indigo-600 text-sm px-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Календарь
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
              <div className="text-xs font-semibold text-indigo-700">Новый тип</div>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addLabel();
                  if (e.key === "Escape") setAddOpen(false);
                }}
                className="w-full px-3 py-2 border border-indigo-300 rounded-lg text-sm bg-white"
                placeholder="Напр. Склад, Магазин, Ресторан"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    setNewName("");
                  }}
                  className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={addLabel}
                  disabled={!newName.trim()}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  Добавить
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            {locationLabels.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Нет типов. Нажми «+ Добавить».
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {locationLabels.map((label) => (
                  <LabelRow
                    key={label.id}
                    label={label}
                    onUpdate={updateLabel}
                    onDelete={() => deleteLabel(label.id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="text-[11px] text-gray-400 px-1">
            Эти типы появляются как быстрые чипы (Дом, Квартира, Офис, Вилла…) при добавлении адреса в записи.
            Кнопка «Другое…» остаётся всегда — для разового имени без сохранения в список.
          </div>
        </div>
      </div>
    </>
  );
}
