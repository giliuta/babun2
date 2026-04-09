"use client";

import { useState } from "react";
import {
  type MockClient,
  MOCK_CLIENT_APPOINTMENTS,
  type MockClientAppointment,
} from "@/lib/mock-data";

interface ClientCardProps {
  client: MockClient;
  onClose: () => void;
}

type Tab = "profile" | "appointments" | "history";
type AppointmentFilter = "all" | "new" | "completed" | "cancelled" | "online";

export default function ClientCard({ client, onClose }: ClientCardProps) {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [form, setForm] = useState({
    full_name: client.full_name,
    phone: client.phone,
    sms_name: client.sms_name,
    comment: client.comment,
    balance: client.balance,
    discount: client.discount,
  });
  const [appointmentFilter, setAppointmentFilter] =
    useState<AppointmentFilter>("all");

  const clientAppointments = MOCK_CLIENT_APPOINTMENTS.filter(
    (a) => a.client_id === client.id,
  );

  const completedCount = clientAppointments.filter(
    (a) => a.status === "completed",
  ).length;
  const cancelledCount = clientAppointments.filter(
    (a) => a.status === "cancelled",
  ).length;

  const filteredAppointments =
    appointmentFilter === "all"
      ? clientAppointments
      : clientAppointments.filter((a) => a.status === appointmentFilter);

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Профиль" },
    {
      key: "appointments",
      label: `Записи (${clientAppointments.length})`,
    },
    { key: "history", label: `История (${completedCount})` },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-indigo-500"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h2 className="flex-1 text-base font-semibold">Клиент</h2>
          <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-indigo-500">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-2 14H7L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                activeTab === tab.key
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "profile" && (
            <ProfileTab form={form} setForm={setForm} />
          )}
          {activeTab === "appointments" && (
            <AppointmentsTab
              appointments={filteredAppointments}
              filter={appointmentFilter}
              onFilterChange={setAppointmentFilter}
              completedCount={completedCount}
              cancelledCount={cancelledCount}
            />
          )}
          {activeTab === "history" && (
            <HistoryTab
              appointments={clientAppointments.filter(
                (a) => a.status === "completed",
              )}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Tab ─────────────────────────────────────────────────────────────

interface FormState {
  full_name: string;
  phone: string;
  sms_name: string;
  comment: string;
  balance: number;
  discount: number;
}

function ProfileTab({
  form,
  setForm,
}: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Avatar */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.5"
          >
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="10" r="3" />
            <path d="M6 20.5c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
          </svg>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Имя и фамилия
        </label>
        <input
          type="text"
          value={form.full_name}
          onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Телефон</label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button className="w-9 h-9 border border-gray-300 rounded-lg flex items-center justify-center text-green-600 hover:bg-green-50">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
          </button>
          <button className="w-9 h-9 border border-gray-300 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* SMS name */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Обращение в SMS напоминаниях
        </label>
        <input
          type="text"
          value={form.sms_name}
          onChange={(e) => setForm((p) => ({ ...p, sms_name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Comment */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Комментарий
        </label>
        <textarea
          value={form.comment}
          onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Balance */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Баланс</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setForm((p) => ({ ...p, balance: p.balance - 10 }))
            }
            className="w-9 h-9 border border-gray-300 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 font-bold"
          >
            -
          </button>
          <span className="flex-1 text-center text-sm font-medium">
            {form.balance} EUR
          </span>
          <button
            onClick={() =>
              setForm((p) => ({ ...p, balance: p.balance + 10 }))
            }
            className="w-9 h-9 border border-gray-300 rounded-lg flex items-center justify-center text-green-500 hover:bg-green-50 font-bold"
          >
            +
          </button>
        </div>
      </div>

      {/* Groups */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Группы</label>
        <button className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500">
          Добавить клиента в группы
        </button>
      </div>

      {/* Discount */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Скидка</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            value={form.discount}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                discount: Math.max(0, Math.min(100, Number(e.target.value))),
              }))
            }
            className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      </div>
    </div>
  );
}

// ─── Appointments Tab ────────────────────────────────────────────────────────

function AppointmentsTab({
  appointments,
  filter,
  onFilterChange,
  completedCount,
  cancelledCount,
}: {
  appointments: MockClientAppointment[];
  filter: AppointmentFilter;
  onFilterChange: (f: AppointmentFilter) => void;
  completedCount: number;
  cancelledCount: number;
}) {
  const filters: { key: AppointmentFilter; label: string }[] = [
    { key: "all", label: "Все" },
    { key: "new", label: "Новые (0)" },
    { key: "completed", label: `Завершены (${completedCount})` },
    { key: "cancelled", label: `Отменены (${cancelledCount})` },
    { key: "online", label: "Онлайн (0)" },
  ];

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-1 px-4 py-2 overflow-x-auto border-b border-gray-100">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`whitespace-nowrap px-3 py-1.5 text-xs rounded-full transition-colors ${
              filter === f.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div>
        {appointments.length === 0 && (
          <div className="text-center text-gray-400 py-10 text-sm">
            Нет записей
          </div>
        )}
        {appointments.map((a) => (
          <div
            key={a.id}
            className="px-4 py-3 border-b border-gray-100 space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">
                {a.date}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  a.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : a.status === "cancelled"
                      ? "bg-red-100 text-red-700"
                      : "bg-blue-100 text-blue-700"
                }`}
              >
                {a.status === "completed"
                  ? "Завершена"
                  : a.status === "cancelled"
                    ? "Отменена"
                    : "Новая"}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              Мастер: {a.master} | {a.service}
            </div>
            <div className="text-xs text-gray-500">{a.address}</div>
            <div className="text-sm font-medium text-gray-900">
              {a.amount} EUR
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab({
  appointments,
}: {
  appointments: MockClientAppointment[];
}) {
  return (
    <div>
      {appointments.length === 0 && (
        <div className="text-center text-gray-400 py-10 text-sm">
          Нет истории
        </div>
      )}
      {appointments.map((a) => (
        <div
          key={a.id}
          className="px-4 py-3 border-b border-gray-100 flex items-center gap-3"
        >
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <div className="flex-1">
            <div className="text-sm text-gray-900">{a.date}</div>
            <div className="text-xs text-gray-500">{a.address}</div>
          </div>
          <div className="text-sm font-medium text-gray-700">
            {a.amount} EUR
          </div>
        </div>
      ))}
    </div>
  );
}
