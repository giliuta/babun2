"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { useTeams } from "@/app/dashboard/layout";
import {
  MOCK_CLIENTS,
  MOCK_CLIENT_APPOINTMENTS,
  type MockClient,
  type MockClientAppointment,
} from "@/lib/mock-data";

type Tab = "profile" | "appointments" | "history";
type AppointmentFilter = "all" | "new" | "completed" | "cancelled" | "online";

interface FormState {
  full_name: string;
  phone: string;
  sms_name: string;
  comment: string;
  balance: number;
  discount: number;
}

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedClient, setSelectedClient] = useState<MockClient | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return MOCK_CLIENTS;
    const q = search.toLowerCase();
    return MOCK_CLIENTS.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [search]);

  if (selectedClient) {
    return (
      <ClientCardView
        client={selectedClient}
        onBack={() => setSelectedClient(null)}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`Все клиенты (${filtered.length})`}
        rightContent={
          <button
            type="button"
            onClick={() => setShowSearch((s) => !s)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100"
            aria-label="Поиск"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50 relative">
        <div className="max-w-3xl mx-auto p-3 lg:p-4">
          {showSearch && (
            <div className="mb-3">
              <input
                type="text"
                placeholder="Поиск по имени или телефону..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filtered.map((client, index) => (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedClient(client)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left ${
                  index < filtered.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-amber-400 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {client.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">
                    {client.full_name}
                  </div>
                  <div className="text-xs text-gray-500">{client.phone}</div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-center text-gray-400 py-10 text-sm">
                Клиенты не найдены
              </div>
            )}
          </div>
        </div>

        {/* FAB */}
        <button
          type="button"
          aria-label="Добавить клиента"
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-indigo-700 transition-colors z-20"
        >
          +
        </button>
      </div>
    </>
  );
}

// ─── Client Card View (inline, full page) ───────────────────────────────────

function ClientCardView({
  client,
  onBack,
}: {
  client: MockClient;
  onBack: () => void;
}) {
  const router = useRouter();
  const { teams } = useTeams();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  const handleBook = () => {
    const firstTeam = teams.find((t) => t.active);
    const params = new URLSearchParams({ client_id: client.id });
    if (firstTeam) params.set("team_id", firstTeam.id);
    router.push(`/dashboard/appointment/new?${params.toString()}`);
  };
  const [form, setForm] = useState<FormState>({
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
    { key: "appointments", label: `Записи (${clientAppointments.length})` },
    { key: "history", label: `История (${completedCount})` },
  ];

  return (
    <>
      <PageHeader
        title="Клиент"
        showBack={false}
        rightContent={
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100"
            aria-label="Назад к списку"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3">
          <button
            type="button"
            onClick={handleBook}
            className="w-full min-h-[44px] px-4 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
          >
            + Записать клиента
          </button>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
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
            {activeTab === "profile" && <ProfileTab form={form} setForm={setForm} />}
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
        </div>
      </div>
    </>
  );
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
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5">
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="10" r="3" />
            <path d="M6 20.5c0-3 2.7-5.5 6-5.5s6 2.5 6 5.5" />
          </svg>
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Имя и фамилия</label>
        <input
          type="text"
          value={form.full_name}
          onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Телефон</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

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

      <div>
        <label className="block text-xs text-gray-500 mb-1">Комментарий</label>
        <textarea
          value={form.comment}
          onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Баланс</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, balance: p.balance - 10 }))}
            className="w-9 h-9 border border-gray-300 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 font-bold"
          >
            -
          </button>
          <span className="flex-1 text-center text-sm font-medium">
            {form.balance} EUR
          </span>
          <button
            type="button"
            onClick={() => setForm((p) => ({ ...p, balance: p.balance + 10 }))}
            className="w-9 h-9 border border-gray-300 rounded-lg flex items-center justify-center text-green-500 hover:bg-green-50 font-bold"
          >
            +
          </button>
        </div>
      </div>

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
      <div className="flex gap-1 px-4 py-2 overflow-x-auto border-b border-gray-100">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
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

      <div>
        {appointments.length === 0 && (
          <div className="text-center text-gray-400 py-10 text-sm">
            Нет записей
          </div>
        )}
        {appointments.map((a) => (
          <div key={a.id} className="px-4 py-3 border-b border-gray-100 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">{a.date}</span>
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
            <div className="text-sm font-medium text-gray-900">{a.amount} EUR</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryTab({ appointments }: { appointments: MockClientAppointment[] }) {
  return (
    <div>
      {appointments.length === 0 && (
        <div className="text-center text-gray-400 py-10 text-sm">Нет истории</div>
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
          <div className="text-sm font-medium text-gray-700">{a.amount} EUR</div>
        </div>
      ))}
    </div>
  );
}
