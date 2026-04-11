"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAppointments,
  useTeams,
  useServices,
  useClients,
} from "@/app/dashboard/layout";
import {
  type Appointment,
  type AppointmentStatus,
  STATUS_LABELS,
} from "@/lib/appointments";
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

const STATUS_ORDER: AppointmentStatus[] = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
];

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "border-indigo-500 bg-indigo-50 text-indigo-700",
  in_progress: "border-amber-500 bg-amber-50 text-amber-700",
  completed: "border-emerald-500 bg-emerald-50 text-emerald-700",
  cancelled: "border-gray-400 bg-gray-50 text-gray-600",
};

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
  const [comment, setComment] = useState(initial.comment);
  const [addressOverride, setAddressOverride] = useState(initial.address);
  const [status, setStatus] = useState<AppointmentStatus>(initial.status);
  const [prepaidAmount, setPrepaidAmount] = useState(initial.prepaid_amount);
  const [customTotal, setCustomTotal] = useState(initial.custom_total);
  const [totalAmount, setTotalAmount] = useState(initial.total_amount);

  const [showMore, setShowMore] = useState(false);
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

  // Auto total & duration from services unless customTotal is set
  useEffect(() => {
    if (customTotal) return;
    const sum = selectedServices.reduce((acc, s) => acc + s.price, 0);
    setTotalAmount(sum);
  }, [selectedServices, customTotal]);

  useEffect(() => {
    const totalMin = selectedServices.reduce((acc, s) => acc + s.duration_minutes, 0);
    if (totalMin > 0) setDurationMinutes(totalMin);
    // Only on service change
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

  const clientAddress = selectedClient && "address" in selectedClient
    ? (selectedClient as Client).address || ""
    : "";
  const effectiveAddress = addressOverride || clientAddress;
  const needsAddress = !effectiveAddress && selectedClient && !addressOverride;

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
      custom_total: customTotal,
      prepaid_amount: prepaidAmount,
      comment,
      address: addressOverride,
      status,
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
          <button
            type="button"
            onClick={() => setClientSheet(true)}
            className={`w-full bg-white rounded-2xl border p-4 flex items-center gap-3 active:bg-gray-50 transition ${
              savePulse === "client"
                ? "border-red-400 animate-pulse"
                : selectedClient
                  ? "border-gray-200"
                  : "border-dashed border-gray-300"
            }`}
          >
            {selectedClient ? (
              <div className="w-11 h-11 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-base">
                {initials(selectedClient.full_name)}
              </div>
            ) : (
              <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-xl">
                👤
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Address hint when client has none */}
          {needsAddress && (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="w-full text-left px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 active:bg-amber-100"
            >
              📍 У клиента нет адреса — добавить
            </button>
          )}

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
                <>
                  <div className="text-base font-semibold text-gray-900 truncate">
                    {selectedServices.map((s) => s.name).join(", ")}
                  </div>
                  <div className="text-xs text-gray-500">
                    {selectedServices.length} · {totalAmount}€
                  </div>
                </>
              ) : (
                <div className="text-base font-semibold text-gray-400">
                  Выбрать услуги
                </div>
              )}
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Comment inline */}
          <div className="bg-white rounded-2xl border border-gray-200 p-3">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Комментарий (что нужно сделать)"
              className="w-full px-2 py-2 text-base text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
            />
          </div>

          {/* Status (edit mode only) */}
          {mode === "edit" && (
            <div className="bg-white rounded-2xl border border-gray-200 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
                Статус
              </div>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_ORDER.map((s) => {
                  const active = status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`h-12 rounded-xl border-2 font-semibold text-sm active:scale-[0.97] transition ${
                        active
                          ? STATUS_COLORS[s]
                          : "border-gray-200 bg-white text-gray-600"
                      }`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* More toggle */}
          <button
            type="button"
            onClick={() => setShowMore((x) => !x)}
            className="w-full py-3 text-center text-sm font-medium text-indigo-600 active:scale-[0.98]"
          >
            {showMore ? "Свернуть" : "Ещё…"}
          </button>

          {showMore && (
            <div className="space-y-2.5">
              {/* Team */}
              {teams.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Бригада
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {teams
                      .filter((t) => t.active)
                      .map((t) => {
                        const active = teamId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setTeamId(t.id)}
                            className={`h-12 rounded-xl border-2 font-medium text-sm active:scale-[0.97] transition truncate px-2 ${
                              active
                                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                : "border-gray-200 bg-white text-gray-700"
                            }`}
                          >
                            {t.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Address override */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Адрес
                </div>
                <input
                  type="text"
                  value={addressOverride}
                  onChange={(e) => setAddressOverride(e.target.value)}
                  placeholder={clientAddress || "Улица, дом, квартира"}
                  className="w-full h-12 px-3 bg-gray-100 rounded-lg text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {clientAddress && !addressOverride && (
                  <div className="text-xs text-gray-500 mt-1.5">
                    По умолчанию: {clientAddress}
                  </div>
                )}
              </div>

              {/* Custom total */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Сумма
                  </div>
                  {customTotal && (
                    <button
                      type="button"
                      onClick={() => setCustomTotal(false)}
                      className="text-xs text-indigo-600"
                    >
                      Авто
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={totalAmount}
                    onChange={(e) => {
                      setCustomTotal(true);
                      setTotalAmount(Number(e.target.value) || 0);
                    }}
                    className="flex-1 h-12 px-3 bg-gray-100 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-base text-gray-500">€</span>
                </div>
              </div>

              {/* Prepaid */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  Аванс
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={prepaidAmount}
                    onChange={(e) => setPrepaidAmount(Number(e.target.value) || 0)}
                    className="flex-1 h-12 px-3 bg-gray-100 rounded-lg text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-base text-gray-500">€</span>
                </div>
              </div>
            </div>
          )}
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
