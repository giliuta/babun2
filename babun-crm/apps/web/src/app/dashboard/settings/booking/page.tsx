"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check, X, Pencil, Trash2 } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui";
import { useLocationLabels } from "@/components/layout/DashboardClientLayout";
import {
  generateLocationLabelId,
  type LocationLabel,
} from "@babun/shared/local/location-labels";

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
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--accent-tint)] rounded-[10px]">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          className="flex-1 h-9 px-2 bg-[var(--surface-card)] border border-transparent rounded-[8px] text-[14px] text-[var(--label)] focus:outline-none focus:border-[var(--accent)]"
          placeholder="Название"
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
        <div className="text-[15px] font-medium text-[var(--label)] truncate">
          {label.name}
        </div>
      </div>
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
            className="inline-flex items-center gap-1 text-[var(--accent)] text-[13px] font-medium px-2 py-2 active:opacity-70"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
            Календарь
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
                Новый тип
              </div>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addLabel();
                  if (e.key === "Escape") setAddOpen(false);
                }}
                className="w-full h-10 px-3 bg-[var(--surface-card)] border border-transparent rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="Напр. Склад, Магазин, Ресторан"
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => {
                    setAddOpen(false);
                    setNewName("");
                  }}
                >
                  Отмена
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={addLabel}
                  disabled={!newName.trim()}
                >
                  Добавить
                </Button>
              </div>
            </div>
          )}

          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)]">
            {locationLabels.length === 0 ? (
              <div className="px-4 py-8 text-center text-[14px] text-[var(--label-tertiary)]">
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

          <div className="text-[12px] text-[var(--label-tertiary)] px-4 leading-snug">
            Эти типы появляются как быстрые чипы (Дом, Квартира, Офис, Вилла…) при добавлении адреса в записи.
            Кнопка «Другое…» остаётся всегда — для разового имени без сохранения в список.
          </div>
        </div>
      </div>
    </>
  );
}
