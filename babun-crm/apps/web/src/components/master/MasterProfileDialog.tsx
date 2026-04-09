"use client";

import { useState } from "react";
import { MOCK_SERVICES, type MockService } from "@/lib/mock-data";

interface MasterProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

type TabId = "profile" | "services" | "schedule";

const DAY_NAMES = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

interface DaySchedule {
  custom: boolean;
  start: string;
  end: string;
  enabled: boolean;
}

export default function MasterProfileDialog({ open, onClose }: MasterProfileDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>("profile");

  // Profile state
  const [name, setName] = useState("AirFix");
  const [phone, setPhone] = useState("+357 99 000000");
  const [country] = useState("Кипр");
  const [currency] = useState("EUR");

  // Services state
  const [services, setServices] = useState<MockService[]>([...MOCK_SERVICES]);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Schedule state
  const [workPattern] = useState("Каждый день");
  const [workStart, setWorkStart] = useState("08:00");
  const [workEnd, setWorkEnd] = useState("22:00");
  const [hasBreak, setHasBreak] = useState(false);
  const [daysOff] = useState("нет выходных");
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>(
    DAY_NAMES.map(() => ({
      custom: false,
      start: "08:00",
      end: "22:00",
      enabled: true,
    })),
  );

  if (!open) return null;

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

  const handleServiceChange = (id: string, field: keyof MockService, value: string | number) => {
    setServices(
      services.map((s) =>
        s.id === id ? { ...s, [field]: value } : s,
      ),
    );
  };

  const handleDayToggle = (index: number) => {
    const updated = [...daySchedules];
    updated[index] = { ...updated[index], custom: !updated[index].custom };
    setDaySchedules(updated);
  };

  const handleDayScheduleChange = (index: number, field: "start" | "end", value: string) => {
    const updated = [...daySchedules];
    updated[index] = { ...updated[index], [field]: value };
    setDaySchedules(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-2">
          <h2 className="flex-1 text-base font-semibold">Профиль мастера</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-indigo-500"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeTab === "profile" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Страна</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  {country}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Валюта</label>
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
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg group"
                >
                  {/* Drag handle */}
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
                        onChange={(e) => handleServiceChange(service.id, "name", e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={service.duration_minutes}
                          onChange={(e) => handleServiceChange(service.id, "duration_minutes", Number(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="мин"
                        />
                        <input
                          type="number"
                          value={service.price}
                          onChange={(e) => handleServiceChange(service.id, "price", Number(e.target.value))}
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
                        <div className="text-sm text-gray-900 truncate">{service.name}</div>
                        <div className="text-xs text-gray-500">
                          {service.duration_minutes} мин / {service.price} EUR
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingServiceId(service.id)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteService(service.id)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
              {/* Work pattern */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Рабочий график
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  {workPattern}
                </div>
              </div>

              {/* Working hours */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Время работы с</label>
                  <input
                    type="time"
                    value={workStart}
                    onChange={(e) => setWorkStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">до</label>
                  <input
                    type="time"
                    value={workEnd}
                    onChange={(e) => setWorkEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Break toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Перерыв</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {hasBreak ? "Есть" : "Без перерыва"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHasBreak(!hasBreak)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      hasBreak ? "bg-indigo-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        hasBreak ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Days off */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Выходные дни
                </label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
                  {daysOff}
                </div>
              </div>

              {/* Per-day schedule */}
              <div>
                <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
                  Расписание по дням
                </div>
                <div className="space-y-2">
                  {DAY_NAMES.map((day, i) => (
                    <div key={day} className="border border-gray-200 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{day}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">Особое расписание</span>
                          <button
                            type="button"
                            onClick={() => handleDayToggle(i)}
                            className={`relative w-9 h-5 rounded-full transition-colors ${
                              daySchedules[i].custom ? "bg-indigo-600" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                daySchedules[i].custom ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                      {daySchedules[i].custom && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input
                            type="time"
                            value={daySchedules[i].start}
                            onChange={(e) => handleDayScheduleChange(i, "start", e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <input
                            type="time"
                            value={daySchedules[i].end}
                            onChange={(e) => handleDayScheduleChange(i, "end", e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center">
          <button
            onClick={onClose}
            className="flex-1 text-center text-sm text-gray-600 hover:text-gray-900"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
