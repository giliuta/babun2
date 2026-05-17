"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "@babun/shared/icons";
import {
  AC_TYPE_LABELS,
  type ACType,
  type ACUnit,
  type Location,
} from "@babun/shared/local/clients";
import type { Appointment } from "@babun/shared/local/appointments";
import { generateId } from "@babun/shared/local/masters";
import { formatEUR } from "@babun/shared/common/utils/money";
import { haptic } from "@/lib/haptics";
// P0 #6 (CRM Core brief) — shared field stack (type chips + label +
// address + mapUrl + note). LocationEditor wraps it with its own
// modal chrome + equipment list so create-time inline form and
// edit-time modal speak the same UI dialect.
import ObjectFormFields from "@/components/clients/ObjectFormFields";

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
  /** Beta #48 (CRM Core brief) — used to render the «История
   *  обслуживания» section for an existing location. The editor
   *  filters by `appointment.location_id === location.id`. Pass an
   *  empty array (or omit) on the create flow — there's no history
   *  for a brand-new object yet. */
  appointments?: Appointment[];
}

const AC_TYPE_ORDER: ACType[] = ["split", "ducted", "cassette"];

export default function LocationEditor({
  open,
  location,
  isOnly,
  onSave,
  onDelete,
  onClose,
  appointments,
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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden max-h-[92vh]"
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
          {/* P0 #6 — type / label / address / mapUrl / note all live
              in the shared <ObjectFormFields />. Modal-specific
              chrome (equipment list, primary toggle) stays below in
              its own group so the two surfaces (inline create vs
              modal edit) share one base-field UI but each still owns
              what's genuinely modal-only. */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-3">
            <ObjectFormFields
              draft={{
                label: draft.label,
                property_type: draft.property_type,
                address: draft.address,
                note: draft.note ?? "",
                mapUrl: draft.mapUrl,
              }}
              onChange={(next) =>
                patch({
                  label: next.label,
                  property_type: next.property_type,
                  address: next.address,
                  note: next.note,
                  mapUrl: next.mapUrl,
                })
              }
              showMapUrl
            />
          </div>

          {/* ── Оборудование ───────────────────────────────── */}
          <Group
            title="Оборудование на объекте"
            footer="Команда видит до выезда: модель, тип, комната. Привязано к этому объекту."
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

          {/* ── Beta #48 — История обслуживания ──────────────── */}
          {location && Array.isArray(appointments) && (
            <LocationServiceHistory
              locationId={location.id}
              appointments={appointments}
            />
          )}

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
            className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] disabled:active:scale-100"
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

// Beta #48 (CRM Core brief) — service history for this specific
// object. Filters the client's appointments by `location_id` and
// renders date + status pill + amount + comment. The brief mentioned
// «диагностика, использованные материалы, фото до/после» — those
// already live in the appointment record; we surface them via a tap
// that opens the appointment on the calendar (same as VisitsBlock).
function LocationServiceHistory({
  locationId,
  appointments,
}: {
  locationId: string;
  appointments: Appointment[];
}) {
  const visits = useMemo(() => {
    return appointments
      .filter((a) => a.location_id === locationId)
      .sort((a, b) =>
        `${b.date}${b.time_start}`.localeCompare(`${a.date}${a.time_start}`),
      )
      .slice(0, 12);
  }, [appointments, locationId]);

  return (
    <Group
      title="История обслуживания"
      footer="Только визиты на этот объект. Тап — открыть запись в календаре."
    >
      {visits.length === 0 ? (
        <div className="px-4 py-3 text-[13px] text-[var(--label-tertiary)]">
          Визитов на этот объект ещё нет.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--separator)]">
          {visits.map((apt) => {
            const status = (() => {
              if (apt.status === "completed")
                return { label: "Выполнено", cls: "bg-[rgba(52,199,89,0.15)] text-[var(--system-green)]" };
              if (apt.status === "cancelled")
                return { label: "Отменено", cls: "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]" };
              if (apt.status === "in_progress")
                return { label: "В работе", cls: "bg-[rgba(255,149,0,0.14)] text-[var(--system-orange)]" };
              return { label: "Запланировано", cls: "bg-[rgba(0,122,255,0.12)] text-[var(--system-blue)]" };
            })();
            return (
              <li key={apt.id} className="px-4 py-2.5 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-[var(--label)] truncate">
                    {apt.comment?.trim() || "—"}
                  </div>
                  <div className="text-[12px] text-[var(--label-secondary)] tabular-nums">
                    {formatLocHistoryDate(apt.date)} · {apt.time_start}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.cls}`}
                >
                  {status.label}
                </span>
                <span className="shrink-0 w-14 text-right text-[13px] font-bold text-[var(--system-green)] tabular-nums">
                  {formatEUR(apt.total_amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Group>
  );
}

function formatLocHistoryDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
