"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { useTeams, useClients, useAppointments } from "@/app/dashboard/layout";
import {
  groupClientsByLetter,
  createBlankClient,
  ACQUISITION_LABELS,
  type AcquisitionSource,
  type Client,
} from "@/lib/clients";
import { MOCK_CLIENT_APPOINTMENTS, type MockClientAppointment } from "@/lib/mock-data";

type Tab = "profile" | "appointments" | "history";
type AppointmentFilter = "all" | "new" | "completed" | "cancelled" | "online";

export default function ClientsPage() {
  const { clients, upsertClient, deleteClient, tags } = useClients();
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) => c.full_name.toLowerCase().includes(q) || c.phone.includes(q)
    );
  }, [clients, search]);

  const grouped = useMemo(() => groupClientsByLetter(filtered), [filtered]);

  if (selectedClient) {
    return (
      <ClientCardView
        key={selectedClient.id}
        client={selectedClient}
        onBack={() => setSelectedClient(null)}
        onSave={(next) => {
          upsertClient(next);
          setSelectedClient(next);
        }}
        onDelete={(id) => {
          deleteClient(id);
          setSelectedClient(null);
        }}
      />
    );
  }

  if (creating) {
    return (
      <ClientCardView
        client={createBlankClient()}
        isNew
        onBack={() => setCreating(false)}
        onSave={(next) => {
          upsertClient(next);
          setCreating(false);
        }}
        onDelete={() => setCreating(false)}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`Все клиенты (${filtered.length})`}
        rightContent={
          <>
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
            <button
              type="button"
              onClick={() => setCreating(true)}
              aria-label="Добавить клиента"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50 relative">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 pb-24">
          {showSearch && (
            <div className="mb-3">
              <input
                type="text"
                placeholder="Поиск по имени или телефону..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="space-y-4">
            {grouped.map((group) => (
              <div key={group.letter}>
                <div className="text-xs font-bold text-gray-500 mb-1 px-1 sticky top-0 bg-gray-50 py-1 z-10">
                  {group.letter}
                </div>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {group.clients.map((client, i) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClient(client)}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left ${
                        i < group.clients.length - 1 ? "border-b border-gray-100" : ""
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-amber-400 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {client.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {client.full_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{client.phone}</div>
                        {(client.tag_ids?.length ?? 0) > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {client.tag_ids.map((tid) => {
                              const tag = tags.find((t) => t.id === tid);
                              if (!tag) return null;
                              return (
                                <span
                                  key={tid}
                                  className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium"
                                  style={{ backgroundColor: tag.color }}
                                >
                                  {tag.name}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {client.balance !== 0 && (
                        <div
                          className={`text-xs font-semibold ${
                            client.balance < 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {client.balance > 0 ? "+" : ""}
                          {client.balance}€
                        </div>
                      )}
                      {client.discount > 0 && (
                        <div className="text-xs text-pink-600 font-semibold ml-2">
                          −{client.discount}%
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {grouped.length === 0 && (
              <div className="text-center text-gray-400 py-10 text-sm">
                Клиенты не найдены
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}

// ─── Client Card View ───────────────────────────────────────────────────────

function ClientCardView({
  client,
  isNew = false,
  onBack,
  onSave,
  onDelete,
}: {
  client: Client;
  isNew?: boolean;
  onBack: () => void;
  onSave: (c: Client) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const { teams } = useTeams();
  const { tags, clients: allClients } = useClients();
  const { appointments: allAppointments } = useAppointments();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [draft, setDraft] = useState<Client>(client);
  const [appointmentFilter, setAppointmentFilter] = useState<AppointmentFilter>("all");

  const handleBook = () => {
    const firstTeam = teams.find((t) => t.active);
    const params = new URLSearchParams({ client_id: draft.id });
    if (firstTeam) params.set("team_id", firstTeam.id);
    router.push(`/dashboard/appointment/new?${params.toString()}`);
  };

  const clientAppointments = useMemo(
    () => MOCK_CLIENT_APPOINTMENTS.filter((a) => a.client_id === client.id),
    [client.id]
  );
  const realApptCount = allAppointments.filter((a) => a.client_id === client.id).length;

  const completedCount = clientAppointments.filter((a) => a.status === "completed").length;
  const cancelledCount = clientAppointments.filter((a) => a.status === "cancelled").length;

  const filteredAppointments =
    appointmentFilter === "all"
      ? clientAppointments
      : clientAppointments.filter((a) => a.status === appointmentFilter);

  const tabs: { key: Tab; label: string }[] = [
    { key: "profile", label: "Профиль" },
    { key: "appointments", label: `Записи (${clientAppointments.length + realApptCount})` },
    { key: "history", label: `История (${completedCount})` },
  ];

  const handleSave = () => onSave(draft);

  const toggleTag = (tagId: string) => {
    setDraft((d) => ({
      ...d,
      tag_ids: d.tag_ids.includes(tagId)
        ? d.tag_ids.filter((t) => t !== tagId)
        : [...d.tag_ids, tagId],
    }));
  };

  return (
    <>
      <PageHeader
        title={isNew ? "Новый клиент" : "Клиент"}
        showBack={false}
        rightContent={
          <>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 bg-white text-indigo-700 lg:bg-indigo-600 lg:text-white rounded-lg text-sm font-semibold"
            >
              Сохранить
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white lg:text-gray-700 hover:bg-indigo-600 lg:hover:bg-gray-100 ml-1"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3">
          {!isNew && (
            <button
              type="button"
              onClick={handleBook}
              className="w-full min-h-[44px] px-4 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
            >
              + Записать клиента
            </button>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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

            {activeTab === "profile" && (
              <ProfileTab
                draft={draft}
                setDraft={setDraft}
                tags={tags}
                toggleTag={toggleTag}
                allClients={allClients}
                onDelete={!isNew ? () => {
                  if (typeof window !== "undefined" && window.confirm("Удалить клиента?")) {
                    onDelete(client.id);
                  }
                } : undefined}
              />
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
                appointments={clientAppointments.filter((a) => a.status === "completed")}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileTab({
  draft,
  setDraft,
  tags,
  toggleTag,
  allClients,
  onDelete,
}: {
  draft: Client;
  setDraft: React.Dispatch<React.SetStateAction<Client>>;
  tags: { id: string; name: string; color: string }[];
  toggleTag: (id: string) => void;
  allClients: Client[];
  onDelete?: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-amber-400 text-white flex items-center justify-center text-3xl font-bold">
          {draft.full_name.charAt(0).toUpperCase() || "?"}
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Имя и фамилия</label>
        <input
          type="text"
          value={draft.full_name}
          onChange={(e) => setDraft((p) => ({ ...p, full_name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Телефон</label>
        <input
          type="tel"
          value={draft.phone}
          onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Обращение в SMS</label>
        <input
          type="text"
          value={draft.sms_name}
          onChange={(e) => setDraft((p) => ({ ...p, sms_name: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Комментарий</label>
        <textarea
          value={draft.comment}
          onChange={(e) => setDraft((p) => ({ ...p, comment: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Address + city */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Город</label>
          <input
            type="text"
            value={draft.city}
            onChange={(e) => setDraft((p) => ({ ...p, city: e.target.value }))}
            placeholder="Лимассол"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Первый контакт</label>
          <input
            type="date"
            value={draft.first_contact_date ?? ""}
            onChange={(e) => setDraft((p) => ({ ...p, first_contact_date: e.target.value || null }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Адрес</label>
        <input
          type="text"
          value={draft.address}
          onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))}
          placeholder="Улица, дом"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Acquisition source */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Как узнал о нас</label>
        <select
          value={draft.acquisition_source}
          onChange={(e) =>
            setDraft((p) => ({
              ...p,
              acquisition_source: e.target.value as AcquisitionSource,
              // if switched away from referral, clear referrer
              referred_by_client_id:
                e.target.value === "referral" ? p.referred_by_client_id : null,
            }))
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        >
          {(Object.keys(ACQUISITION_LABELS) as AcquisitionSource[]).map((s) => (
            <option key={s} value={s}>
              {ACQUISITION_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {draft.acquisition_source === "referral" && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Кто рекомендовал</label>
          <select
            value={draft.referred_by_client_id ?? ""}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                referred_by_client_id: e.target.value || null,
              }))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="">— Не указано —</option>
            {allClients
              .filter((c) => c.id !== draft.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Balance */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Баланс {draft.balance < 0 && <span className="text-red-600">(долг)</span>}
          {draft.balance > 0 && <span className="text-emerald-600">(предоплата)</span>}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft((p) => ({ ...p, balance: p.balance - 10 }))}
            className="w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 font-bold text-lg"
            aria-label="-10€"
          >
            −10
          </button>
          <input
            type="number"
            value={draft.balance}
            onChange={(e) => setDraft((p) => ({ ...p, balance: Number(e.target.value) || 0 }))}
            className={`flex-1 text-center text-lg font-semibold border rounded-lg px-3 py-2 ${
              draft.balance < 0
                ? "border-red-300 text-red-600 bg-red-50"
                : draft.balance > 0
                ? "border-emerald-300 text-emerald-600 bg-emerald-50"
                : "border-gray-300 text-gray-900"
            }`}
          />
          <button
            type="button"
            onClick={() => setDraft((p) => ({ ...p, balance: p.balance + 10 }))}
            className="w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center text-emerald-500 hover:bg-emerald-50 font-bold text-lg"
            aria-label="+10€"
          >
            +10
          </button>
        </div>
      </div>

      {/* Discount */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Персональная скидка</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={draft.discount}
            onChange={(e) => setDraft((p) => ({ ...p, discount: Number(e.target.value) }))}
            className="flex-1"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={draft.discount}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                discount: Math.max(0, Math.min(100, Number(e.target.value))),
              }))
            }
            className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-500">%</span>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Группы / теги</label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const active = draft.tag_ids.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  active ? "text-white border-transparent" : "text-gray-600 bg-white border-gray-300"
                }`}
                style={active ? { backgroundColor: tag.color } : undefined}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full mt-4 min-h-[44px] text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50"
        >
          Удалить клиента
        </button>
      )}
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
          <div className="text-center text-gray-400 py-10 text-sm">Нет записей</div>
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
