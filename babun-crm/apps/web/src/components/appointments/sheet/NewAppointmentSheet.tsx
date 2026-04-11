"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAppointments,
  useTeams,
  useServices,
  useClients,
} from "@/app/dashboard/layout";
import type { Appointment } from "@/lib/appointments";
import type { Client } from "@/lib/clients";
import {
  type DraftClient,
  loadDraftClients,
} from "@/lib/draft-clients";
import ClientPickerSheet from "./ClientPickerSheet";
import ServicePickerSheet from "./ServicePickerSheet";
import TimePickerSheet from "./TimePickerSheet";

interface NewAppointmentSheetProps {
  initial: Appointment;
  mode: "new" | "edit";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "Не выбрано";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const days = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  const months = [
    "янв", "фев", "мар", "апр", "май", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function timeDiffMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(((total % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
  const mm = (((total % 60) + 60) % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export default function NewAppointmentSheet({
  initial,
  mode,
}: NewAppointmentSheetProps) {
  const router = useRouter();
  const { upsertAppointment, deleteAppointment, appointments } = useAppointments();
  const { teams } = useTeams();
  const { services, categories } = useServices();
  const { clients } = useClients();

  const [date, setDate] = useState(initial.date);
  const [timeStart, setTimeStart] = useState(initial.time_start);
  const [durationMinutes, setDurationMinutes] = useState(
    Math.max(15, timeDiffMinutes(initial.time_start, initial.time_end) || 60)
  );
  const [clientId, setClientId] = useState<string | null>(initial.client_id);
  const [teamId, setTeamId] = useState<string | null>(initial.team_id);
  const [serviceIds, setServiceIds] = useState<string[]>(initial.service_ids);

  const [timeSheet, setTimeSheet] = useState(false);
  const [clientSheet, setClientSheet] = useState(false);
  const [serviceSheet, setServiceSheet] = useState(false);
  const [savePulse, setSavePulse] = useState<null | "client" | "service">(null);

  const [draftClients, setDraftClients] = useState<DraftClient[]>([]);
  useEffect(() => {
    setDraftClients(loadDraftClients());
  }, [clientSheet]);

  const allClients = useMemo<(Client | DraftClient)[]>(
    () => [...clients, ...draftClients],
    [clients, draftClients]
  );

  const selectedClient = useMemo(
    () => allClients.find((c) => c.id === clientId) ?? null,
    [allClients, clientId]
  );

  const selectedServices = useMemo(
    () =>
      serviceIds
        .map((id) => services.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [serviceIds, services]
  );

  // Auto-total from services
  const totalAmount = useMemo(
    () => selectedServices.reduce((acc, s) => acc + s.price, 0),
    [selectedServices]
  );

  // Duration follows selected services
  useEffect(() => {
    const totalMin = selectedServices.reduce((acc, s) => acc + s.duration_minutes, 0);
    if (totalMin > 0) setDurationMinutes(totalMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceIds.join(",")]);

  // Default team = first active if none picked
  useEffect(() => {
    if (!teamId && teams.length > 0) {
      const firstActive = teams.find((t) => t.active);
      if (firstActive) setTeamId(firstActive.id);
    }
  }, [teamId, teams]);

  // Recent client ids: from appointments sorted by most recent first
  const recentClientIds = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const sorted = [...appointments].sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at)
    );
    for (const apt of sorted) {
      if (apt.client_id && !seen.has(apt.client_id)) {
        seen.add(apt.client_id);
        out.push(apt.client_id);
        if (out.length >= 10) break;
      }
    }
    return out;
  }, [appointments]);

  const timeEnd = addMinutesToTime(timeStart, durationMinutes);
  const canSave = Boolean(clientId && serviceIds.length > 0);

  const handleSave = () => {
    if (!canSave) {
      if (!clientId) {
        setSavePulse("client");
        setTimeout(() => setSavePulse(null), 600);
      } else {
        setSavePulse("service");
        setTimeout(() => setSavePulse(null), 600);
      }
      return;
    }
    const now = new Date().toISOString();
    const apt: Appointment = {
      ...initial,
      date,
      time_start: timeStart,
      time_end: timeEnd,
      client_id: clientId,
      team_id: teamId,
      service_ids: serviceIds,
      total_amount: totalAmount,
      custom_total: false,
      updated_at: now,
      created_at: initial.created_at || now,
    };
    upsertAppointment(apt);
    router.push("/dashboard");
  };

  const handleCancel = () => router.push("/dashboard");

  const handleDelete = () => {
    if (typeof window !== "undefined" && !window.confirm("Удалить запись?")) return;
    deleteAppointment(initial.id);
    router.push("/dashboard");
  };

  return (
    <>
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-4 bg-indigo-600 text-white"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
          paddingBottom: "0.75rem",
        }}
      >
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Закрыть"
          className="w-10 h-10 -ml-2 flex items-center justify-center active:scale-95"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold flex-1">
          {mode === "new" ? "Новая запись" : "Запись"}
        </h1>
        {mode === "edit" && (
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Удалить"
            className="w-10 h-10 flex items-center justify-center active:scale-95 text-white/80 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div
        className="flex-1 overflow-y-auto bg-gray-50"
        style={{ paddingBottom: "8rem" }}
      >
        <div className="p-3 space-y-2.5 max-w-xl mx-auto">
          {/* TIME card */}
          <button
            type="button"
            onClick={() => setTimeSheet(true)}
            className="w-full bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3 active:bg-gray-50"
          >
            <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-xl">
              ⏰
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs text-gray-500">Время</div>
              <div className="text-base font-semibold text-gray-900 truncate">
                {formatDateLabel(date)} · {timeStart} → {timeEnd}
              </div>
              <div className="text-xs text-gray-500">{durationMinutes} мин</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* CLIENT card */}
          <div
            className={`w-full bg-white rounded-2xl border flex items-stretch transition ${
              savePulse === "client"
                ? "border-red-400 animate-pulse"
                : selectedClient
                  ? "border-gray-200"
                  : "border-dashed border-gray-300"
            }`}
          >
            <button
              type="button"
              onClick={() => setClientSheet(true)}
              className="flex-1 min-w-0 p-4 flex items-center gap-3 text-left active:bg-gray-50 rounded-l-2xl"
            >
              {selectedClient ? (
                <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-base flex-shrink-0">
                  {initials(selectedClient.full_name)}
                </div>
              ) : (
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                  👤
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-500">Клиент</div>
                {selectedClient ? (
                  <>
                    <div className="text-base font-semibold text-gray-900 truncate">
                      {selectedClient.full_name}
                    </div>
                    {selectedClient.phone && (
                      <div className="text-xs text-gray-500 truncate">
                        {selectedClient.phone}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-base font-semibold text-gray-400">
                    Выбрать клиента
                  </div>
                )}
              </div>
              {!selectedClient?.phone && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </button>
            {selectedClient?.phone && (
              <a
                href={`tel:${selectedClient.phone.replace(/\s+/g, "")}`}
                aria-label="Позвонить"
                className="flex-shrink-0 w-14 flex items-center justify-center border-l border-gray-200 text-emerald-600 active:bg-emerald-50 rounded-r-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </a>
            )}
          </div>

          {/* SERVICE card */}
          <button
            type="button"
            onClick={() => setServiceSheet(true)}
            className={`w-full bg-white rounded-2xl border p-4 flex items-center gap-3 active:bg-gray-50 transition ${
              savePulse === "service"
                ? "border-red-400 animate-pulse"
                : selectedServices.length > 0
                  ? "border-gray-200"
                  : "border-dashed border-gray-300"
            }`}
          >
            <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-xl">
              🔧
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-xs text-gray-500">Услуги</div>
              {selectedServices.length > 0 ? (
                <div className="text-base font-semibold text-gray-900 truncate">
                  {selectedServices.map((s) => s.name).join(", ")}
                </div>
              ) : (
                <div className="text-base font-semibold text-gray-400">
                  Выбрать услуги
                </div>
              )}
            </div>
            {totalAmount > 0 && (
              <div className="text-lg font-bold text-indigo-600 flex-shrink-0 ml-1">
                {totalAmount}€
              </div>
            )}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 ml-1">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sticky save button */}
      <div
        className="fixed left-0 right-0 bottom-0 px-3 pt-2 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent z-40"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <button
          type="button"
          onClick={handleSave}
          className={`w-full h-14 rounded-2xl font-semibold text-base shadow-lg active:scale-[0.98] transition ${
            canSave
              ? "bg-indigo-600 text-white"
              : "bg-gray-300 text-gray-500"
          }`}
        >
          {mode === "new" ? "Сохранить" : "Сохранить изменения"}
        </button>
      </div>

      {/* Sheets */}
      <TimePickerSheet
        open={timeSheet}
        onClose={() => setTimeSheet(false)}
        date={date}
        timeStart={timeStart}
        durationMinutes={durationMinutes}
        onConfirm={(next) => {
          setDate(next.date);
          setTimeStart(next.timeStart);
          setDurationMinutes(next.durationMinutes);
        }}
      />

      <ClientPickerSheet
        open={clientSheet}
        onClose={() => setClientSheet(false)}
        onSelect={(c) => setClientId(c.id)}
        clients={clients}
        draftClients={draftClients}
        recentClientIds={recentClientIds}
      />

      <ServicePickerSheet
        open={serviceSheet}
        onClose={() => setServiceSheet(false)}
        services={services}
        categories={categories}
        initialSelectedIds={serviceIds}
        onConfirm={(ids) => setServiceIds(ids)}
      />
    </>
  );
}
