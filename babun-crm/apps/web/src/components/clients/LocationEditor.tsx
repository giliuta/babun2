"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  AC_TYPE_LABELS,
  type ACType,
  type ACUnit,
  type Location,
} from "@babun/shared/local/clients";
import { generateId } from "@babun/shared/local/masters";
import { haptic } from "@/lib/haptics";

interface LocationEditorProps {
  open: boolean;
  /** Existing location to edit, or null to create a fresh one. */
  location: Location | null;
  /** True when this is the only location of its client — disables
   *  «убрать как основной» so we always have at least one primary. */
  isOnly: boolean;
  onSave: (next: Location) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const AC_TYPE_ORDER: ACType[] = ["split", "ducted", "cassette"];

const LABEL_PRESETS = [
  "Дом",
  "Офис",
  "Вилла",
  "Квартира",
  "Магазин",
  "Ресторан",
];

export default function LocationEditor({
  open,
  location,
  isOnly,
  onSave,
  onDelete,
  onClose,
}: LocationEditorProps) {
  const [draft, setDraft] = useState<Location>(() =>
    location ?? blankLocation(),
  );

  useEffect(() => {
    setDraft(location ?? blankLocation());
  }, [location, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const patch = (diff: Partial<Location>) => setDraft((d) => ({ ...d, ...diff }));

  const equipment = draft.equipment ?? [];

  const addUnit = () => {
    haptic("tap");
    const unit: ACUnit = {
      id: generateId("ac"),
      room: "",
      ac_type: "split",
      has_indoor: true,
      has_outdoor: true,
    };
    patch({ equipment: [...equipment, unit] });
  };

  const updateUnit = (id: string, diff: Partial<ACUnit>) => {
    patch({
      equipment: equipment.map((u) => (u.id === id ? { ...u, ...diff } : u)),
    });
  };

  const removeUnit = (id: string) => {
    haptic("tap");
    patch({ equipment: equipment.filter((u) => u.id !== id) });
  };

  const save = () => {
    haptic("tap");
    onSave(draft);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-[var(--surface-card)] rounded-t-[20px] sm:rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--separator)]">
          <div className="text-[17px] font-semibold tracking-tight text-[var(--label)]">
            {location ? "Объект" : "Новый объект"}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 bg-[var(--surface-grouped)]">
          {/* ── Метка ─────────────────────────────────────── */}
          <Group title="Тип / название">
            <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-[var(--separator)]">
              {LABEL_PRESETS.map((p) => {
                const active = draft.label === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => patch({ label: p })}
                    className={`px-2.5 h-7 rounded-full text-[12px] font-semibold transition active:scale-[0.97] ${
                      active
                        ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                        : "bg-[var(--surface-card)] text-[var(--label)] border border-[var(--separator)]"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={draft.label}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder="Своё название"
              maxLength={40}
              className="w-full h-11 px-4 bg-transparent text-[15px] text-[var(--label)] focus:outline-none"
            />
          </Group>

          {/* ── Адрес ─────────────────────────────────────── */}
          <Group title="Адрес">
            <input
              type="text"
              value={draft.address}
              onChange={(e) => patch({ address: e.target.value })}
              placeholder="Пафос, ул. Posidonos 12"
              maxLength={160}
              className="w-full h-11 px-4 bg-transparent text-[15px] text-[var(--label)] focus:outline-none border-b border-[var(--separator)]"
            />
            <input
              type="url"
              value={draft.mapUrl ?? ""}
              onChange={(e) => patch({ mapUrl: e.target.value })}
              placeholder="Google Maps / Apple Maps ссылка (необязательно)"
              maxLength={300}
              className="w-full h-11 px-4 bg-transparent text-[14px] text-[var(--label)] focus:outline-none"
            />
          </Group>

          {/* ── Заметка для бригады ────────────────────────── */}
          <Group
            title="Заметка для бригады"
            footer="Что бригада увидит у порога — код домофона, особенности, ключи."
          >
            <textarea
              value={draft.note ?? ""}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="«Зелёная дверь, домофон 25», «снимать обувь», «собака во дворе»"
              rows={2}
              maxLength={400}
              className="w-full px-4 py-2 bg-transparent text-[14px] text-[var(--label)] focus:outline-none resize-none leading-snug"
            />
          </Group>

          {/* ── Оборудование ───────────────────────────────── */}
          <Group
            title="Оборудование на объекте"
            footer="Бригада видит до выезда: модель, тип, комната. Привязано к этому объекту."
          >
            {equipment.length === 0 && (
              <div className="px-4 py-3 text-[13px] text-[var(--label-tertiary)]">
                Юнитов ещё нет.
              </div>
            )}
            {equipment.map((u, idx) => (
              <div
                key={u.id}
                className={`px-4 py-2.5 space-y-1.5 ${
                  idx === equipment.length - 1
                    ? ""
                    : "border-b border-[var(--separator)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={u.room}
                    onChange={(e) =>
                      updateUnit(u.id, { room: e.target.value })
                    }
                    placeholder="Комната (Спальня / Гостиная)"
                    className="flex-1 h-9 px-2.5 rounded-[8px] bg-[var(--fill-tertiary)] text-[14px] text-[var(--label)] focus:outline-none"
                    maxLength={40}
                  />
                  <button
                    type="button"
                    onClick={() => removeUnit(u.id)}
                    aria-label="Удалить юнит"
                    className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)]"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={u.brand ?? ""}
                    onChange={(e) =>
                      updateUnit(u.id, { brand: e.target.value })
                    }
                    placeholder="Бренд"
                    className="flex-1 h-9 px-2.5 rounded-[8px] bg-[var(--fill-tertiary)] text-[14px] text-[var(--label)] focus:outline-none"
                    maxLength={40}
                  />
                  <input
                    type="text"
                    value={u.model ?? ""}
                    onChange={(e) =>
                      updateUnit(u.id, { model: e.target.value })
                    }
                    placeholder="Модель"
                    className="flex-1 h-9 px-2.5 rounded-[8px] bg-[var(--fill-tertiary)] text-[14px] text-[var(--label)] focus:outline-none"
                    maxLength={40}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AC_TYPE_ORDER.map((t) => {
                    const active = u.ac_type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => updateUnit(u.id, { ac_type: t })}
                        className={`px-2.5 h-7 rounded-full text-[11px] font-semibold transition active:scale-[0.97] ${
                          active
                            ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                            : "bg-[var(--fill-tertiary)] text-[var(--label)]"
                        }`}
                      >
                        {AC_TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addUnit}
              className="w-full flex items-center gap-2 px-4 py-3 min-h-[48px] text-left active:bg-[var(--fill-quaternary)] transition border-t border-[var(--separator)]"
            >
              <span className="w-7 h-7 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <Plus size={15} strokeWidth={2.5} />
              </span>
              <span className="text-[14px] font-medium text-[var(--accent)]">
                Добавить юнит
              </span>
            </button>
          </Group>

          {/* ── Основной объект тоггл ───────────────────────── */}
          <Group title="Признак">
            <label className="flex items-center gap-3 px-4 min-h-[44px]">
              <input
                type="checkbox"
                checked={draft.isPrimary}
                onChange={(e) => patch({ isPrimary: e.target.checked })}
                disabled={isOnly}
                className="w-5 h-5 accent-[var(--accent)] disabled:opacity-50"
              />
              <span className="flex-1 text-[14px] text-[var(--label)]">
                Основной объект
              </span>
              <span className="text-[12px] text-[var(--label-tertiary)]">
                {isOnly
                  ? "автоматически — других объектов нет"
                  : "выбирается по умолчанию при записи"}
              </span>
            </label>
          </Group>

          {onDelete && (
            <button
              type="button"
              onClick={() => {
                haptic("warning");
                onDelete();
              }}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-[var(--radius-card)] bg-[var(--surface-card)] shadow-[var(--shadow-card)] text-[var(--system-red)] text-[14px] font-medium active:bg-[rgba(255,59,48,0.08)]"
            >
              <Trash2 size={15} strokeWidth={2} />
              Удалить объект
            </button>
          )}
        </div>

        <div
          className="flex-shrink-0 px-4 pt-2 border-t border-[var(--separator)]"
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)",
          }}
        >
          <button
            type="button"
            onClick={save}
            disabled={!draft.label.trim()}
            className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

function blankLocation(): Location {
  return {
    id: generateId("loc"),
    label: "Дом",
    address: "",
    isPrimary: false,
    equipment: [],
  };
}

function Group({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-1 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
        {children}
      </div>
      {footer && (
        <div className="px-1 pt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}
