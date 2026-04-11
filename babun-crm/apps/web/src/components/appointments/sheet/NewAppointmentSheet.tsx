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
  type AppointmentExpense,
} from "@/lib/appointments";
import type { Client } from "@/lib/clients";
import {
  type DraftClient,
  loadDraftClients,
} from "@/lib/draft-clients";
import { generateId } from "@/lib/masters";
import { buildMapUrl, parseAddress, resolveMapLink } from "@/lib/map-links";
import ClientPickerSheet from "./ClientPickerSheet";
import ServicePickerSheet from "./ServicePickerSheet";
import DateWheelModal from "./DateWheelModal";
import TimeWheelModal from "./TimeWheelModal";
import TeamPickerSheet from "./TeamPickerSheet";
import FinanceSheet from "./FinanceSheet";

interface NewAppointmentSheetProps {
  initial: Appointment;
  mode: "new" | "edit";
  // Optional callback; when provided the sheet uses it instead of routing
  // back to /dashboard. Lets the calendar render the sheet inline as a
  // modal and keep itself mounted.
  onClose?: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatDateFull(dateStr: string): string {
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium uppercase tracking-wider text-gray-400 px-4 pt-2 pb-0.5">
      {children}
    </div>
  );
}

function IconSquare({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold"
      style={{ backgroundColor: color }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-100" />;
}

export default function NewAppointmentSheet({
  initial,
  mode,
  onClose,
}: NewAppointmentSheetProps) {
  const router = useRouter();
  const { upsertAppointment, deleteAppointment, appointments } = useAppointments();
  const { teams } = useTeams();
  const { services, categories } = useServices();
  const { clients } = useClients();

  const [date, setDate] = useState(initial.date);
  const [timeStart, setTimeStart] = useState(initial.time_start);
  const [clientId, setClientId] = useState<string | null>(initial.client_id);
  const [teamId, setTeamId] = useState<string | null>(initial.team_id);
  const [serviceIds, setServiceIds] = useState<string[]>(initial.service_ids);
  const [comment, setComment] = useState(initial.comment);
  const [address, setAddress] = useState(initial.address);
  const [addressLat, setAddressLat] = useState<number | null>(initial.address_lat);
  const [addressLng, setAddressLng] = useState<number | null>(initial.address_lng);
  const [resolving, setResolving] = useState(false);
  const [cancelled, setCancelled] = useState(initial.status === "cancelled");
  const [photos, setPhotos] = useState<AppointmentPhoto[]>(initial.photos ?? []);
  const [discount, setDiscount] = useState(initial.discount_amount ?? 0);
  const [expenses, setExpenses] = useState<AppointmentExpense[]>(
    initial.expenses ?? []
  );
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>(
    initial.service_price_overrides ?? {}
  );

  const [dateModal, setDateModal] = useState(false);
  const [timeModal, setTimeModal] = useState(false);
  const [clientSheet, setClientSheet] = useState(false);
  const [serviceSheet, setServiceSheet] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const [financeSheet, setFinanceSheet] = useState(false);
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

  // Count occurrences of each service id (duplicates = quantity).
  const serviceQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const id of serviceIds) map[id] = (map[id] ?? 0) + 1;
    return map;
  }, [serviceIds]);

  // Group selected services for display: [{service, qty}, ...] in original order.
  const groupedServices = useMemo(() => {
    const seen = new Set<string>();
    const out: { service: NonNullable<ReturnType<typeof services.find>>; qty: number }[] = [];
    for (const id of serviceIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const s = services.find((x) => x.id === id);
      if (s) out.push({ service: s, qty: serviceQuantities[id] });
    }
    return out;
  }, [serviceIds, services, serviceQuantities]);

  // Duration + subtotal come entirely from selected services.
  const totalDurationMinutes = useMemo(
    () =>
      groupedServices.reduce(
        (sum, { service, qty }) => sum + service.duration_minutes * qty,
        0
      ),
    [groupedServices]
  );

  const subtotal = useMemo(
    () =>
      groupedServices.reduce((sum, { service, qty }) => {
        const unit =
          priceOverrides[service.id] !== undefined
            ? priceOverrides[service.id]
            : service.price;
        return sum + unit * qty;
      }, 0),
    [groupedServices, priceOverrides]
  );

  const effectiveDuration = totalDurationMinutes > 0 ? totalDurationMinutes : 60;
  const timeEnd = addMinutesToTime(timeStart, effectiveDuration);

  const clampedDiscount = Math.min(discount, subtotal);
  const totalAmount = Math.max(0, subtotal - clampedDiscount);
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses]
  );
  const profit = totalAmount - totalExpenses;

  // Default team = first active if none picked
  useEffect(() => {
    if (!teamId && teams.length > 0) {
      const firstActive = teams.find((t) => t.active);
      if (firstActive) setTeamId(firstActive.id);
    }
  }, [teamId, teams]);

  // Resolve map links to coordinates whenever the address changes. Parses
  // inline coordinates synchronously; URLs that need server resolution
  // kick off a debounced fetch to /api/resolve-map-link.
  useEffect(() => {
    const parsed = parseAddress(address);
    if (parsed.coords) {
      setAddressLat(parsed.coords.lat);
      setAddressLng(parsed.coords.lng);
      setResolving(false);
      return;
    }
    if (!parsed.isUrl) {
      setAddressLat(null);
      setAddressLng(null);
      setResolving(false);
      return;
    }
    // It's a URL without inline coords — ask the server to resolve it.
    setResolving(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const coords = await resolveMapLink(parsed.raw);
      if (cancelled) return;
      if (coords) {
        setAddressLat(coords.lat);
        setAddressLng(coords.lng);
      } else {
        setAddressLat(null);
        setAddressLng(null);
      }
      setResolving(false);
    }, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [address]);

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

  // Event mode (kind === "event") replaces the work-appointment form
  // with a much simpler "personal event" screen — just master/date/time
  // and an event title stored in the comment field.
  const isEvent = initial.kind === "event";
  const canSave = isEvent
    ? comment.trim().length > 0
    : Boolean(clientId && serviceIds.length > 0);
  const currentTeam = teams.find((t) => t.id === teamId);
  const headerBg = isEvent ? "bg-orange-600" : "bg-indigo-600";
  const headerTitle = isEvent ? "Событие" : "Запись клиента";

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
      discount_amount: clampedDiscount,
      expenses,
      service_price_overrides: priceOverrides,
      comment,
      address,
      address_lat: addressLat,
      address_lng: addressLng,
      photos,
      status: cancelled
        ? "cancelled"
        : initial.status === "cancelled"
          ? "scheduled"
          : initial.status,
      updated_at: now,
      created_at: initial.created_at || now,
    };
    upsertAppointment(apt);
    if (onClose) onClose();
    else router.push("/dashboard");
  };

  const handleClose = () => {
    if (onClose) onClose();
    else router.push("/dashboard");
  };

  const handleDelete = () => {
    if (typeof window !== "undefined" && !window.confirm("Удалить запись?")) return;
    deleteAppointment(initial.id);
    if (onClose) onClose();
    else router.push("/dashboard");
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

  return (
    <>
      {/* Header — purple for appointments, orange for personal events */}
      <div
        className={`flex-shrink-0 flex items-center gap-2 px-3 text-white ${headerBg}`}
        style={{
          paddingTop: "calc(env(safe-area-inset-top) + 0.55rem)",
          paddingBottom: "0.55rem",
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Назад"
          className="w-9 h-9 flex items-center justify-center active:scale-95"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 className="text-[14px] font-medium flex-1 truncate">{headerTitle}</h1>
        {currentTeam && (
          <button
            type="button"
            onClick={() => setTeamSheetOpen(true)}
            className="text-[11px] font-medium bg-white/15 px-2 py-1 rounded-md active:bg-white/25 flex items-center gap-1"
          >
            {currentTeam.name}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
        {mode === "edit" && (
          <button
            type="button"
            onClick={handleDelete}
            aria-label="Удалить"
            className="w-9 h-9 flex items-center justify-center active:scale-95 text-white/85"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      {/* Body */}
      <div
        className="flex-1 overflow-y-auto bg-white"
        style={{ paddingBottom: "5rem" }}
      >
        {/* Дата */}
        <Label>Дата</Label>
        <button
          type="button"
          onClick={() => setDateModal(true)}
          className="w-full flex items-center gap-3 px-4 py-1.5 active:bg-gray-50"
        >
          <IconSquare color="#7c3aed">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </IconSquare>
          <div className="flex-1 min-w-0 text-left text-[13px] font-medium text-gray-900 truncate">
            {formatDateFull(date)}
          </div>
        </button>
        <Divider />

        {/* Время */}
        <Label>Время</Label>
        <button
          type="button"
          onClick={() => setTimeModal(true)}
          className="w-full flex items-center gap-3 px-4 py-1.5 active:bg-gray-50"
        >
          <IconSquare color="#7c3aed">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </IconSquare>
          <div className="flex-1 min-w-0 text-left text-[13px] text-gray-900">
            <span className="text-gray-500">с </span>
            <span className="font-medium tabular-nums">{timeStart}</span>
            <span className="text-gray-500"> до </span>
            <span className="font-medium tabular-nums">{timeEnd}</span>
          </div>
        </button>
        <Divider />

        {isEvent && (
          <>
            <Label>Название события</Label>
            <div className="px-4 py-2">
              <input
                type="text"
                autoFocus
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Название события"
                className="w-full h-10 text-[14px] text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
              />
            </div>
            <Divider />

            <Label>Напоминания</Label>
            <div className="px-4 py-2 text-[12px] text-gray-400">
              Скоро
            </div>
            <Divider />
          </>
        )}

        {!isEvent && (
          <>
        {/* Клиент */}
        <Label>Клиент</Label>
        <div
          className={`flex items-stretch transition ${
            savePulse === "client" ? "bg-red-50" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => setClientSheet(true)}
            className="flex-1 min-w-0 flex items-center gap-3 px-4 py-1.5 text-left active:bg-gray-50"
          >
            {selectedClient ? (
              <IconSquare color="#f59e0b">
                {initials(selectedClient.full_name).slice(0, 1)}
              </IconSquare>
            ) : (
              <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              {selectedClient ? (
                <>
                  <div className="text-[13px] font-medium text-gray-900 truncate leading-tight">
                    {selectedClient.full_name}
                  </div>
                  {selectedClient.phone && (
                    <div className="text-[11px] text-gray-500 truncate leading-tight">
                      {selectedClient.phone}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[13px] text-gray-400">Выбрать клиента</div>
              )}
            </div>
          </button>
          {selectedClient?.phone && (
            <a
              href={`tel:${selectedClient.phone.replace(/\s+/g, "")}`}
              aria-label="Позвонить"
              className="w-11 flex items-center justify-center text-emerald-600 active:bg-emerald-50"
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </a>
          )}
        </div>
        <Divider />

        {/* Адрес */}
        <Label>Адрес</Label>
        <div className="flex items-center gap-2 px-4 py-1.5">
          <IconSquare color="#ef4444">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </IconSquare>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Адрес или ссылка"
            className="flex-1 min-w-0 h-8 text-[13px] text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
          />
          {address.trim() && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {resolving && (
                <div
                  className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-1"
                  aria-label="Resolving..."
                />
              )}
              <a
                href={
                  buildMapUrl(
                    "google",
                    address,
                    addressLat !== null && addressLng !== null
                      ? { lat: addressLat, lng: addressLng }
                      : null
                  ) ?? "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Google Maps"
                className="w-8 h-8 rounded-md flex items-center justify-center text-white text-[11px] font-bold active:scale-95"
                style={{ backgroundColor: "#ea4335" }}
              >
                G
              </a>
              <a
                href={
                  buildMapUrl(
                    "apple",
                    address,
                    addressLat !== null && addressLng !== null
                      ? { lat: addressLat, lng: addressLng }
                      : null
                  ) ?? "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Apple Maps"
                className="w-8 h-8 rounded-md flex items-center justify-center text-white text-[11px] font-bold active:scale-95"
                style={{ backgroundColor: "#1d1d1f" }}
              >
                A
              </a>
              <a
                href={
                  buildMapUrl(
                    "waze",
                    address,
                    addressLat !== null && addressLng !== null
                      ? { lat: addressLat, lng: addressLng }
                      : null
                  ) ?? "#"
                }
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Waze"
                className="w-8 h-8 rounded-md flex items-center justify-center text-white text-[11px] font-bold active:scale-95"
                style={{ backgroundColor: "#33ccff" }}
              >
                W
              </a>
            </div>
          )}
        </div>
        <Divider />

        {/* Услуги */}
        <Label>Услуги</Label>
        <button
          type="button"
          onClick={() => setServiceSheet(true)}
          className={`w-full flex items-start gap-3 px-4 py-1.5 text-left active:bg-gray-50 ${
            savePulse === "service" ? "bg-red-50" : ""
          }`}
        >
          <IconSquare color="#9ca3af">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </IconSquare>
          <div className="flex-1 min-w-0 pt-0.5">
            {groupedServices.length > 0 ? (
              <div className="text-[13px] text-gray-900 leading-snug">
                {groupedServices
                  .map(({ service, qty }) =>
                    qty > 1 ? `${service.name} ×${qty}` : service.name
                  )
                  .join(", ")}
              </div>
            ) : (
              <div className="text-[13px] text-gray-400">Выбрать услуги</div>
            )}
          </div>
        </button>
        <Divider />

        {/* Доходы и расходы */}
        <Label>Доходы и расходы</Label>
        <button
          type="button"
          onClick={() => subtotal > 0 && setFinanceSheet(true)}
          disabled={subtotal === 0}
          className="w-full flex items-center gap-3 px-4 py-1.5 text-left active:bg-gray-50 disabled:active:bg-transparent"
        >
          <IconSquare color="#7c3aed">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </IconSquare>
          <div className="flex-1 min-w-0 flex items-baseline gap-1">
            <span className="text-[18px] font-semibold text-sky-600 tabular-nums">
              {profit}
            </span>
            <span className="text-[11px] text-gray-400 uppercase">EUR</span>
            {(clampedDiscount > 0 || totalExpenses > 0) && (
              <span className="text-[11px] text-gray-400 ml-2 tabular-nums">
                из {subtotal}
              </span>
            )}
          </div>
          {subtotal > 0 && (
            <div className="text-[11px] flex items-center gap-1.5 flex-shrink-0">
              {clampedDiscount > 0 && (
                <span className="text-indigo-600 font-medium">
                  −{clampedDiscount}€
                </span>
              )}
              {totalExpenses > 0 && (
                <span className="text-red-600 font-medium">
                  −{totalExpenses}€
                </span>
              )}
              {clampedDiscount === 0 && totalExpenses === 0 && (
                <span className="text-indigo-600 font-medium">Изменить</span>
              )}
            </div>
          )}
        </button>
        <Divider />

        {/* Комментарий */}
        <Label>Комментарий</Label>
        <div className="flex items-start gap-3 px-4 py-1.5">
          <IconSquare color="#7c3aed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </IconSquare>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Что нужно сделать"
            rows={1}
            className="flex-1 min-h-[24px] text-[13px] text-gray-900 placeholder-gray-400 bg-transparent resize-none focus:outline-none leading-snug"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
        </div>
        <Divider />

        {/* Фото */}
        <Label>Фото {photos.length > 0 && `(${photos.length})`}</Label>
        <div className="px-4 py-1.5">
          <div className="flex items-center gap-2 overflow-x-auto">
            <label className="flex items-center justify-center w-12 h-12 rounded-md border border-dashed border-gray-300 text-gray-400 flex-shrink-0 cursor-pointer active:bg-gray-50">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
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
            {photos.map((p) => (
              <div
                key={p.id}
                className="relative w-12 h-12 rounded-md overflow-hidden flex-shrink-0 border border-gray-200"
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
                  className="absolute top-0 right-0 w-4 h-4 bg-black/60 text-white rounded-bl text-[10px] leading-none flex items-center justify-center"
                  aria-label="Удалить"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <Divider />
          </>
        )}

        {/* Отмена (edit only) */}
        {mode === "edit" && (
          <label className="w-full flex items-center gap-3 px-4 py-2 cursor-pointer">
            <IconSquare color={cancelled ? "#ef4444" : "#9ca3af"}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </IconSquare>
            <span className="flex-1 text-[13px] text-gray-900">
              {isEvent ? "Событие отменено" : "Запись отменена"}
            </span>
            <span
              className={`relative inline-block w-9 h-5 rounded-full transition ${
                cancelled
                  ? isEvent
                    ? "bg-orange-600"
                    : "bg-indigo-600"
                  : "bg-gray-300"
              }`}
            >
              <input
                type="checkbox"
                checked={cancelled}
                onChange={(e) => setCancelled(e.target.checked)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  cancelled ? "left-[1.1rem]" : "left-0.5"
                }`}
              />
            </span>
          </label>
        )}
      </div>

      {/* Floating save FAB */}
      <button
        type="button"
        onClick={handleSave}
        aria-label="Сохранить"
        className={`fixed right-4 w-14 h-14 rounded-full shadow-xl flex items-center justify-center active:scale-95 transition z-40 ${
          canSave
            ? isEvent
              ? "bg-orange-600 text-white"
              : "bg-indigo-600 text-white"
            : "bg-gray-300 text-gray-500"
        }`}
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>

      {/* Sheets */}
      <DateWheelModal
        open={dateModal}
        onClose={() => setDateModal(false)}
        value={date}
        onConfirm={(next) => setDate(next)}
      />

      <TimeWheelModal
        open={timeModal}
        onClose={() => setTimeModal(false)}
        value={timeStart}
        onConfirm={(next) => setTimeStart(next)}
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

      <TeamPickerSheet
        open={teamSheetOpen}
        onClose={() => setTeamSheetOpen(false)}
        teams={teams}
        selectedId={teamId}
        onSelect={(id) => setTeamId(id)}
      />

      <FinanceSheet
        open={financeSheet}
        onClose={() => setFinanceSheet(false)}
        services={groupedServices}
        discount={clampedDiscount}
        expenses={expenses}
        priceOverrides={priceOverrides}
        onConfirm={(next) => {
          setDiscount(next.discount);
          setExpenses(next.expenses);
          setPriceOverrides(next.priceOverrides);
        }}
      />
    </>
  );
}
