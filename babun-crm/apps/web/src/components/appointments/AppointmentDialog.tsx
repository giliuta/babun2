"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { MockAppointment } from "@/lib/mock-data";
import { MOCK_TEAMS, MOCK_CLIENTS, MOCK_SERVICES } from "@/lib/mock-data";

interface AppointmentDialogProps {
  appointment: MockAppointment | null;
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<MockAppointment>) => void;
  prefillDate?: string;
  prefillTime?: string;
  activeTeamId?: string;
}

export default function AppointmentDialog({
  appointment,
  open,
  onClose,
  onSave,
  prefillDate,
  prefillTime,
  activeTeamId,
}: AppointmentDialogProps) {
  const [formData, setFormData] = useState({
    client_name: "",
    client_phone: "",
    service_name: "",
    date: "",
    time_start: "",
    time_end: "",
    amount: 0,
    comment: "",
    team_id: "",
    address: "",
  });

  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);

  const isCreateMode = !appointment;

  useEffect(() => {
    if (appointment) {
      setFormData({
        client_name: appointment.client_name,
        client_phone: appointment.client_phone,
        service_name: appointment.service_name,
        date: appointment.date,
        time_start: appointment.time_start,
        time_end: appointment.time_end,
        amount: appointment.amount,
        comment: appointment.comment,
        team_id: appointment.team_id,
        address: "",
      });
      setClientSearch(appointment.client_name);
    } else if (open) {
      setFormData({
        client_name: "",
        client_phone: "",
        service_name: "",
        date: prefillDate || "",
        time_start: prefillTime || "",
        time_end: "",
        amount: 0,
        comment: "",
        team_id: activeTeamId || MOCK_TEAMS[0].id,
        address: "",
      });
      setClientSearch("");
    }
  }, [appointment, open, prefillDate, prefillTime, activeTeamId]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return MOCK_CLIENTS;
    const q = clientSearch.toLowerCase();
    return MOCK_CLIENTS.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.phone.includes(q),
    );
  }, [clientSearch]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleClientSelect = (client: typeof MOCK_CLIENTS[number]) => {
    setFormData({
      ...formData,
      client_name: client.full_name,
      client_phone: client.phone,
    });
    setClientSearch(client.full_name);
    setShowClientDropdown(false);
  };

  const handleServiceSelect = (service: typeof MOCK_SERVICES[number]) => {
    // Calculate end time based on service duration
    let timeEnd = formData.time_end;
    if (formData.time_start) {
      const [h, m] = formData.time_start.split(":").map(Number);
      const totalMinutes = h * 60 + m + service.duration_minutes;
      const endH = Math.floor(totalMinutes / 60);
      const endM = totalMinutes % 60;
      timeEnd = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    }
    setFormData({
      ...formData,
      service_name: service.name,
      amount: service.price,
      time_end: timeEnd,
    });
    setShowServiceDropdown(false);
  };

  const currentTeamName = MOCK_TEAMS.find((t) => t.id === formData.team_id)?.name || "Y&D";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {isCreateMode ? "Новая запись" : "Запись клиента"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Мастер */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Мастер
            </label>
            <select
              value={formData.team_id}
              onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            >
              {MOCK_TEAMS.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          {/* Дата */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Время */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Время от
              </label>
              <input
                type="time"
                value={formData.time_start}
                onChange={(e) =>
                  setFormData({ ...formData, time_start: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Время до
              </label>
              <input
                type="time"
                value={formData.time_end}
                onChange={(e) =>
                  setFormData({ ...formData, time_end: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Клиент — searchable dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Клиент
            </label>
            <input
              ref={clientInputRef}
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setFormData({ ...formData, client_name: e.target.value });
                setShowClientDropdown(true);
              }}
              onFocus={() => setShowClientDropdown(true)}
              placeholder="Имя клиента"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {showClientDropdown && filteredClients.length > 0 && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowClientDropdown(false)}
                />
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[200px] overflow-y-auto z-50">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleClientSelect(client)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="text-gray-900">{client.full_name}</span>
                      <span className="text-gray-400 text-xs">{client.phone}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Телефон */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Телефон
            </label>
            <input
              type="tel"
              value={formData.client_phone}
              onChange={(e) =>
                setFormData({ ...formData, client_phone: e.target.value })
              }
              placeholder="+357 99 000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Услуги — dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Услуги
            </label>
            <button
              type="button"
              onClick={() => setShowServiceDropdown(!showServiceDropdown)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white flex items-center justify-between"
            >
              <span className={formData.service_name ? "text-gray-900" : "text-gray-400"}>
                {formData.service_name || "Выберите услугу"}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showServiceDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowServiceDropdown(false)}
                />
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[250px] overflow-y-auto z-50">
                  {MOCK_SERVICES.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => handleServiceSelect(service)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="text-gray-900">{service.name}</span>
                      <span className="text-gray-400 text-xs">
                        {service.duration_minutes} мин / {service.price} EUR
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Доход */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Доход
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: Number(e.target.value) })
                }
                min={0}
                className="w-full px-3 py-2 pr-12 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                EUR
              </span>
            </div>
          </div>

          {/* Комментарий */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Комментарий
            </label>
            <textarea
              value={formData.comment}
              onChange={(e) =>
                setFormData({ ...formData, comment: e.target.value })
              }
              rows={3}
              placeholder="Дополнительная информация..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Адрес */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Адрес
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="Адрес или ссылка на Google Maps"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between pt-2">
            {!isCreateMode && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                Отмена записи
              </button>
            )}
            <div className={`flex items-center gap-3 ${isCreateMode ? "ml-auto" : ""}`}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Сохранить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
