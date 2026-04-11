"use client";

import { useEffect, useState, useMemo } from "react";
import PageHeader from "@/components/layout/PageHeader";
import {
  type WaitlistItem,
  type WaitlistStatus,
  loadWaitlist,
  saveWaitlist,
  createBlankWaitlistItem,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/waitlist";
import SwipeableRow from "@/components/ui/SwipeableRow";

const STATUS_FILTER: (WaitlistStatus | "all")[] = [
  "all",
  "pending",
  "contacted",
  "booked",
  "dropped",
];

export default function WaitlistPage() {
  const [items, setItems] = useState<WaitlistItem[]>([]);
  const [filter, setFilter] = useState<WaitlistStatus | "all">("all");
  const [editing, setEditing] = useState<WaitlistItem | null>(null);

  useEffect(() => {
    setItems(loadWaitlist());
  }, []);

  const visible = useMemo(
    () =>
      filter === "all" ? items : items.filter((i) => i.status === filter),
    [items, filter]
  );

  const pendingCount = items.filter((i) => i.status === "pending").length;

  const persist = (next: WaitlistItem[]) => {
    setItems(next);
    saveWaitlist(next);
  };

  const handleSave = (item: WaitlistItem) => {
    const next = items.some((i) => i.id === item.id)
      ? items.map((i) => (i.id === item.id ? item : i))
      : [item, ...items];
    persist(next);
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    persist(items.filter((i) => i.id !== id));
    setEditing(null);
  };

  const handleSetStatus = (id: string, status: WaitlistStatus) => {
    persist(items.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  return (
    <>
      <PageHeader
        title={`Лист ожидания (${pendingCount})`}
        rightContent={
          <button
            type="button"
            onClick={() => setEditing(createBlankWaitlistItem())}
            aria-label="Добавить в лист ожидания"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50 relative">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3">
          {/* Filter chips */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {STATUS_FILTER.map((s) => {
              const label =
                s === "all" ? "Все" : STATUS_LABELS[s as WaitlistStatus];
              const count =
                s === "all"
                  ? items.length
                  : items.filter((i) => i.status === s).length;
              const active = filter === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {/* Items */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_2px_0_rgba(15,23,42,0.04),0_1px_3px_0_rgba(15,23,42,0.06)] overflow-hidden">
            {visible.map((item, index) => (
              <div
                key={item.id}
                className={
                  index < visible.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }
              >
                <SwipeableRow
                  leftActions={
                    item.phone
                      ? [
                          {
                            label: "Позвонить",
                            color: "bg-emerald-500",
                            icon: (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                            ),
                            onSelect: () => {
                              const digits = item.phone.replace(/\D/g, "");
                              if (digits) window.location.href = `tel:${digits}`;
                            },
                          },
                        ]
                      : []
                  }
                  rightActions={[
                    {
                      label: "Записан",
                      color: "bg-indigo-600",
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ),
                      onSelect: () => handleSetStatus(item.id, "booked"),
                    },
                    {
                      label: "Удалить",
                      color: "bg-red-500",
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                        </svg>
                      ),
                      onSelect: () => handleDelete(item.id),
                    },
                  ]}
                >
                  <button
                    type="button"
                    onClick={() => setEditing(item)}
                    className="w-full text-left px-4 py-3 active:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-400 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {(item.client_name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {item.client_name || "Без имени"}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {item.services || "—"}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status]}`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    <div className="pl-[52px] mt-1 space-y-0.5">
                      {item.master && (
                        <div className="text-xs text-gray-500">
                          Мастер: {item.master}
                        </div>
                      )}
                      {item.deadline && (
                        <div className="text-xs text-gray-500">
                          До: {item.deadline}
                        </div>
                      )}
                      {item.time_pref && (
                        <div className="text-xs text-gray-500">
                          Время: {item.time_pref}
                        </div>
                      )}
                      {item.location && (
                        <div className="text-xs text-gray-500">
                          {item.location}
                        </div>
                      )}
                    </div>
                  </button>
                </SwipeableRow>
              </div>
            ))}
            {visible.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="text-[14px] font-semibold text-gray-900">
                  Пока никто не ждёт
                </div>
                <div className="text-[12px] text-gray-500 max-w-xs">
                  Добавьте клиента в лист ожидания, когда нет свободных окон.
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(createBlankWaitlistItem())}
                  className="mt-2 h-10 px-4 rounded-lg border border-indigo-600 text-indigo-600 text-[13px] font-semibold active:bg-indigo-50"
                >
                  + Добавить
                </button>
              </div>
            )}
          </div>
        </div>

      </div>

      {editing && (
        <WaitlistEditor
          item={editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
          onStatusChange={(s) => handleSetStatus(editing.id, s)}
        />
      )}
    </>
  );
}

interface EditorProps {
  item: WaitlistItem;
  onSave: (item: WaitlistItem) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onStatusChange: (s: WaitlistStatus) => void;
}

function WaitlistEditor({
  item,
  onSave,
  onDelete,
  onClose,
  onStatusChange,
}: EditorProps) {
  const [draft, setDraft] = useState<WaitlistItem>(item);

  const statuses: WaitlistStatus[] = [
    "pending",
    "contacted",
    "booked",
    "dropped",
  ];

  const patch = (p: Partial<WaitlistItem>) =>
    setDraft((prev) => ({ ...prev, ...p }));

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40">
      <div className="w-full lg:max-w-md bg-white rounded-t-2xl lg:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div className="font-semibold text-[15px] text-gray-900">
            {item.client_name ? "Редактировать" : "Новая запись"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          <Field
            label="Имя клиента"
            value={draft.client_name}
            onChange={(v) => patch({ client_name: v })}
            placeholder="Иван"
          />
          <Field
            label="Телефон"
            value={draft.phone}
            onChange={(v) => patch({ phone: v })}
            placeholder="+357 ..."
            type="tel"
          />
          <Field
            label="Услуги / описание"
            value={draft.services}
            onChange={(v) => patch({ services: v })}
            placeholder="Чистка кондиционера x2"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Мастер / бригада"
              value={draft.master}
              onChange={(v) => patch({ master: v })}
              placeholder="Y&D"
            />
            <Field
              label="Город"
              value={draft.location}
              onChange={(v) => patch({ location: v })}
              placeholder="Лимассол"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Дедлайн"
              value={draft.deadline}
              onChange={(v) => patch({ deadline: v })}
              placeholder="до 15.05"
            />
            <Field
              label="Предпочтение времени"
              value={draft.time_pref}
              onChange={(v) => patch({ time_pref: v })}
              placeholder="после 18:00"
            />
          </div>
          <Field
            label="Заметка"
            value={draft.note}
            onChange={(v) => patch({ note: v })}
            placeholder="Перезвонить в четверг"
          />

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
              Статус
            </div>
            <div className="flex gap-1.5">
              {statuses.map((s) => {
                const active = draft.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      patch({ status: s });
                      onStatusChange(s);
                    }}
                    className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition ${
                      active
                        ? STATUS_COLORS[s] + " ring-1 ring-current"
                        : "bg-gray-50 text-gray-500"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2">
          {item.client_name && (
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="h-11 px-4 rounded-lg bg-red-50 text-red-600 text-[13px] font-medium active:scale-[0.98]"
            >
              Удалить
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="flex-1 h-11 rounded-lg bg-indigo-600 text-white text-[14px] font-semibold active:scale-[0.98]"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}

function Field({ label, value, onChange, placeholder, type = "text" }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-lg bg-gray-50 border border-gray-200 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </label>
  );
}
