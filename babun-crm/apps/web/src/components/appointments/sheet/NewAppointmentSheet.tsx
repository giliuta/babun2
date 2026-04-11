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
  type AppointmentPhoto,
} from "@/lib/appointments";
import type { Client } from "@/lib/clients";
import {
  type DraftClient,
  loadDraftClients,
} from "@/lib/draft-clients";
import { generateId } from "@/lib/masters";
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

function formatDateRu(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  const dow = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} г. (${dow[d.getDay()]})`;
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

// ─── Section helpers ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 px-4 pt-4 pb-1.5">
      {children}
    </div>
  );
}

// Icon squares shown on the left of each row — matches Bumpix's look.
function IconSquare({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold"
      style={{ backgroundColor: color }}
    >
      {children}
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────

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
  const [cancelled, setCancelled] = useState(initial.status === "cancelled");
  const [photos, setPhotos] = useState<AppointmentPhoto[]>(initial.photos ?? []);

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

  const totalAmount = useMemo(
    () => selectedServices.reduce((acc, s) => acc + s.price, 0),
    [selectedServices]
  );

  useEffect(() => {
    const totalMin = selectedServices.reduce((acc, s) => acc + s.duration_minutes, 0);
    if (totalMin > 0) setDurationMinutes(totalMin);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceIds.join(",")]);

  useEffect(() => {
    if (!teamId && teams.length > 0) {
      const firstActive = teams.find((t) => t.active);
      if (firstActive) setTeamId(firstActive.id);
    }
  }, [teamId, teams]);

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

  const currentTeam = teams.find((t) => t.id === teamId);

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
      comment,
      photos,
      status: cancelled ? "cancelled" : initial.status === "cancelled" ? "scheduled" : initial.status,
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

  const handleAddPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotos((prev) => [
        ...prev,
        {
          id: generateId("ph"),
          data_url: dataUrl,
          caption: "",
          uploaded_at: new Date().toISOString(),
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const TEAM_COLOR = "#f59e0b"; // amber — matches Bumpix's orange avatar

  return (
    <>
      {/* Purple header */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-3 bg-indigo-600 text-white"
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 0.65rem)",
          paddingBottom: "0.65rem",
        }}
      >
        <button
          type="button"
          onClick={handleCancel}
          aria-label="Назад"
          className="w-10 h-10 flex items-center justify-center active:scale-95"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[15px] font-medium flex-1 truncate">Запись клиента</h1>
        {mode === "edit" && (
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Удалить"
            className="w-10 h-10 flex items-center justify-center active:scale-95 text-white/85"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto bg-white"
        style={{ paddingBottom: "6rem" }}
      >
        {/* Мастер */}
        {currentTeam && (
          <>
            <SectionLabel>Мастер</SectionLabel>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <IconSquare color={TEAM_COLOR}>
                {currentTeam.name.slice(0, 1).toUpperCase()}
              </IconSquare>
              <div className="text-[14px] text-gray-900">{currentTeam.name}</div>
            </div>
            <div className="border-t border-gray-100" />
          </>
        )}

        {/* Дата */}
        <SectionLabel>Дата</SectionLabel>
        <button
          type="button"
          onClick={() => setTimeSheet(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-gray-50"
        >
          <IconSquare color="#7c3aed">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </IconSquare>
          <div className="text-[14px] text-gray-900 text-left flex-1">
            {formatDateRu(date)}
          </div>
        </button>
        <div className="border-t border-gray-100" />

        {/* Время */}
        <SectionLabel>Время</SectionLabel>
        <button
          type="button"
          onClick={() => setTimeSheet(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 active:bg-gray-50"
        >
          <IconSquare color="#7c3aed">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </IconSquare>
          <div className="text-[14px] text-gray-900 text-left flex-1">
            с <span className="font-medium">{timeStart}</span> до{" "}
            <span className="font-medium">{timeEnd}</span>
          </div>
        </button>
        <div className="border-t border-gray-100" />

        {/* Клиент */}
        <SectionLabel>Клиент</SectionLabel>
        <div
          className={`flex items-stretch transition ${
            savePulse === "client" ? "bg-red-50" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => setClientSheet(true)}
            className="flex-1 min-w-0 flex items-center gap-3 px-4 py-2.5 text-left active:bg-gray-50"
          >
            {selectedClient ? (
              <IconSquare color={TEAM_COLOR}>
                {initials(selectedClient.full_name).slice(0, 1)}
              </IconSquare>
            ) : (
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              {selectedClient ? (
                <>
                  <div className="text-[14px] font-medium text-gray-900 truncate">
                    {selectedClient.full_name}
                  </div>
                  {selectedClient.phone && (
                    <div className="text-[12px] text-gray-500 truncate">
                      {selectedClient.phone}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[14px] text-gray-400">Выбрать клиента</div>
              )}
            </div>
          </button>
          {selectedClient?.phone && (
            <a
              href={`tel:${selectedClient.phone.replace(/\s+/g, "")}`}
              aria-label="Позвонить"
              className="w-12 flex items-center justify-center text-emerald-600 active:bg-emerald-50"
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </a>
          )}
        </div>
        <div className="border-t border-gray-100" />

        {/* Услуги */}
        <SectionLabel>Услуги</SectionLabel>
        <button
          type="button"
          onClick={() => setServiceSheet(true)}
          className={`w-full flex items-start gap-3 px-4 py-2.5 text-left active:bg-gray-50 ${
            savePulse === "service" ? "bg-red-50" : ""
          }`}
        >
          <IconSquare color="#9ca3af">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </IconSquare>
          <div className="flex-1 min-w-0 pt-0.5">
            {selectedServices.length > 0 ? (
              <div className="text-[14px] text-gray-900 leading-snug">
                {selectedServices.map((s) => s.name).join(", ")}
              </div>
            ) : (
              <div className="text-[14px] text-gray-400">Выбрать услуги</div>
            )}
          </div>
        </button>
        <div className="border-t border-gray-100" />

        {/* Доход */}
        <SectionLabel>Доход</SectionLabel>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <IconSquare color="#7c3aed">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </IconSquare>
          <div className="flex items-baseline gap-1 flex-1">
            <span className="text-[20px] font-semibold text-gray-900 tabular-nums">
              {totalAmount}
            </span>
            <span className="text-[12px] text-gray-400 uppercase">EUR</span>
          </div>
        </div>
        <div className="border-t border-gray-100" />

        {/* Комментарий */}
        <SectionLabel>Комментарий</SectionLabel>
        <div className="flex items-start gap-3 px-4 py-2.5">
          <IconSquare color="#7c3aed">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </IconSquare>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Добавить комментарий"
            rows={1}
            className="flex-1 min-h-[32px] text-[14px] text-gray-900 placeholder-gray-400 bg-transparent resize-none focus:outline-none py-0.5"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
        </div>
        <div className="border-t border-gray-100" />

        {/* Фото */}
        <SectionLabel>Фото {photos.length > 0 && `(${photos.length})`}</SectionLabel>
        <div className="px-4 py-2.5">
          {photos.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.data_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setPhotos((prev) => prev.filter((x) => x.id !== p.id))
                    }
                    className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center text-[10px]"
                    aria-label="Удалить"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="flex items-center gap-3 cursor-pointer active:opacity-70">
            <IconSquare color="#9ca3af">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </IconSquare>
            <span className="text-[14px] text-indigo-600 font-medium">
              Добавить фото
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAddPhoto(file);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        <div className="border-t border-gray-100" />

        {/* Отмена записи */}
        {mode === "edit" && (
          <>
            <SectionLabel>Отмена записи</SectionLabel>
            <label className="w-full flex items-center gap-3 px-4 py-2.5 cursor-pointer">
              <IconSquare color={cancelled ? "#ef4444" : "#9ca3af"}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </IconSquare>
              <span className="flex-1 text-[14px] text-gray-900">
                Запись отменена
              </span>
              <span
                className={`relative inline-block w-10 h-6 rounded-full transition ${
                  cancelled ? "bg-indigo-600" : "bg-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={cancelled}
                  onChange={(e) => setCancelled(e.target.checked)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                    cancelled ? "left-4" : "left-0.5"
                  }`}
                />
              </span>
            </label>
          </>
        )}
      </div>

      {/* Floating save button (FAB) */}
      <button
        type="button"
        onClick={handleSave}
        aria-label="Сохранить"
        className={`fixed right-4 w-14 h-14 rounded-full shadow-xl flex items-center justify-center active:scale-95 transition z-40 ${
          canSave
            ? "bg-indigo-600 text-white"
            : "bg-gray-300 text-gray-500"
        }`}
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>

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
