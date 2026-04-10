"use client";

import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useSchedules } from "@/app/dashboard/layout";
import { MOCK_SERVICES, MOCK_TEAMS, type MockService } from "@/lib/mock-data";
import {
  type ScheduleMap,
  type TeamSchedule,
  DEFAULT_SCHEDULE,
  getTeamSchedule,
} from "@/lib/schedule";

type TabId = "profile" | "services" | "schedule";

export default function MasterProfilePage() {
  const { schedules, setSchedules } = useSchedules();

  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // Profile state
  const [name, setName] = useState("AirFix");
  const [phone, setPhone] = useState("+357 99 000000");
  const country = "Кипр";
  const currency = "EUR";

  // Services state
  const [services, setServices] = useState<MockService[]>([...MOCK_SERVICES]);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Schedule state
  const [editingTeamId, setEditingTeamId] = useState<string>(
    MOCK_TEAMS[0]?.id || "",
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "profile", label: "Профиль" },
    { id: "services", label: "Услуги" },
    { id: "schedule", label: "Расписание" },
  ];

  const handleDeleteService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  const handleAddService = () => {
    const newId = String(Date.now());
    setServices([
      ...services,
      {
        id: newId,
        name: "Новая услуга",
        category: "other",
        duration_minutes: 60,
        price: 0,
      },
    ]);
    setEditingServiceId(newId);
  };

  const handleServiceChange = (
    id: string,
    field: keyof MockService,
    value: string | number,
  ) => {
    setServices(
      services.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  const currentSchedule: TeamSchedule = getTeamSchedule(editingTeamId, schedules);

  const updateScheduleField = (field: "start" | "end", value: string) => {
    const next: ScheduleMap = {
      ...schedules,
      [editingTeamId]: {
        ...(schedules[editingTeamId] || DEFAULT_SCHEDULE),
        [field]: value,
      },
    };
    setSchedules(next);
  };

  const applyPreset = (start: string, end: string) => {
    setSchedules({ ...schedules, [editingTeamId]: { start, end } });
  };

  const resetSchedule = () => {
    const next = { ...schedules };
    delete next[editingTeamId];
    setSchedules(next);
  };

  return (
    <>
      <PageHeader title="Профиль мастера" />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${
                    activeTab === tab.id
                      ? "text-indigo-600 border-b-2 border-indigo-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="px-4 py-4">
              {activeTab === "profile" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Имя
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Телефон
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Страна
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                      {country}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Валюта
                    </label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                      {currency}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "services" && (
                <div className="space-y-2">
                  {services.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg"
                    >
                      <div className="text-gray-300 cursor-grab">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="8" cy="6" r="1.5" />
                          <circle cx="16" cy="6" r="1.5" />
                          <circle cx="8" cy="12" r="1.5" />
                          <circle cx="16" cy="12" r="1.5" />
                          <circle cx="8" cy="18" r="1.5" />
                          <circle cx="16" cy="18" r="1.5" />
                        </svg>
                      </div>

                      {editingServiceId === service.id ? (
                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            value={service.name}
                            onChange={(e) =>
                              handleServiceChange(service.id, "name", e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={service.duration_minutes}
                              onChange={(e) =>
                                handleServiceChange(
                                  service.id,
                                  "duration_minutes",
                                  Number(e.target.value),
                                )
                              }
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="мин"
                            />
                            <input
                              type="number"
                              value={service.price}
                              onChange={(e) =>
                                handleServiceChange(
                                  service.id,
                                  "price",
                                  Number(e.target.value),
                                )
                              }
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              placeholder="EUR"
                            />
                            <button
                              type="button"
                              onClick={() => setEditingServiceId(null)}
                              className="px-2 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100"
                            >
                              Готово
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-900 truncate">
                              {service.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {service.duration_minutes} мин / {service.price} EUR
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditingServiceId(service.id)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400"
                            aria-label="Редактировать"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteService(service.id)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                            aria-label="Удалить"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-2 14H7L5 6" />
                              <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddService}
                    className="w-full py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    + Добавить услугу
                  </button>
                </div>
              )}

              {activeTab === "schedule" && (
                <div className="space-y-4">
                  {/* Team selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Бригада
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {MOCK_TEAMS.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => setEditingTeamId(team.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                            editingTeamId === team.id
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-gray-700 border-gray-200 hover:border-indigo-300"
                          }`}
                        >
                          {team.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    График работы бригады{" "}
                    <span className="font-medium text-gray-700">
                      {MOCK_TEAMS.find((t) => t.id === editingTeamId)?.name}
                    </span>
                    . Часы вне расписания будут затемнены на календаре.
                  </div>

                  {/* Working hours */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Время работы с
                      </label>
                      <input
                        type="time"
                        value={currentSchedule.start}
                        onChange={(e) => updateScheduleField("start", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        до
                      </label>
                      <input
                        type="time"
                        value={currentSchedule.end}
                        onChange={(e) => updateScheduleField("end", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* Quick presets */}
                  <div className="flex gap-2 flex-wrap">
                    <PresetButton label="08–22" onClick={() => applyPreset("08:00", "22:00")} />
                    <PresetButton label="09–18" onClick={() => applyPreset("09:00", "18:00")} />
                    <PresetButton label="07–20" onClick={() => applyPreset("07:00", "20:00")} />
                    <PresetButton label="00–24" onClick={() => applyPreset("00:00", "23:59")} />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={resetSchedule}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      Сбросить к стандартному (08:00 – 22:00)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
    >
      {label}
    </button>
  );
}
