"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Camera,
  CalendarClock,
  Coffee,
  Briefcase,
  Navigation as NavigationIcon,
  Moon,
  Plane,
} from "lucide-react";
import type { EventPreset } from "@/lib/event-presets";

// Lucide icon components keyed by the preset's `icon` string. Replaces
// the inline emoji rendering (☕💼🧭🌙✈️) with system-style line icons
// — cleaner on iOS and respects the user's "no emojis" directive.
const EVENT_ICONS: Record<EventPreset["icon"], React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  coffee: Coffee,
  briefcase: Briefcase,
  navigation: NavigationIcon,
  moon: Moon,
  plane: Plane,
};
import type {
  Appointment,
  AppointmentPayment,
  AppointmentPhoto,
  AppointmentService,
  Discount,
} from "@/lib/appointments";
import { loadAppointments } from "@/lib/appointments";
import type { Client, Location } from "@/lib/clients";
import type { Master, Team } from "@/lib/masters";
import { getTeamDisplayName } from "@/lib/masters";
import type { Service, ServiceCategory } from "@/lib/services";
import { pricePerUnit } from "@/lib/services";
import { EVENT_PRESETS } from "@/lib/event-presets";
import { getCityColor, CITY_LIST } from "@/lib/day-cities";
import { formatEUR } from "@/lib/money";
import {
  appointmentTotal,
  totalDuration as calcDuration,
} from "@/lib/finance/appointment-calc";
import ClientPickerSheet from "@/components/appointments/sheet/ClientPickerSheet";
import ServicePickerSheet from "@/components/appointments/sheet/ServicePickerSheet";
import { IOSSwitch } from "@/components/ui";

import TimeBlock from "./TimeBlock";
import ClientBlock from "./ClientBlock";
import LocationsBlock from "./LocationsBlock";
import ServicesBlock from "./ServicesBlock";
import IncomeBlock from "./IncomeBlock";
import CommentBlock from "./CommentBlock";
import PhotoBlock from "./PhotoBlock";
import ClientActionMenu from "./ClientActionMenu";
import SendMessagePopup from "./SendMessagePopup";
import ClientProfileView from "@/components/clients/ClientProfileView";
import { useRouter } from "next/navigation";
import { loadChats } from "@/lib/chats";
import PaymentBlock from "./PaymentBlock";
import { buildShareUrl } from "@/lib/share-link";
import { createRecurring } from "@/lib/recurring";
import RepeatReminderSheet from "./RepeatReminderSheet";
import { loadCompany } from "@/lib/finance/company";
// jspdf + invoice builder are heavy (~350 kB combined). Load them on
// demand when the dispatcher actually taps "Скачать счёт" instead of
// shipping the module in the main dashboard bundle.

export type AppointmentSheetMode = "create" | "view" | "done" | "edit";

interface AppointmentSheetProps {
  open: boolean;
  onClose: () => void;
  mode: AppointmentSheetMode;
  /** Для create: seed из тапа по слоту. Для view/done — полная запись. */
  appointment: Appointment;
  clients: Client[];
  recentClientIds: string[];
  teams: Team[];
  activeTeam: Team | null;
  /** Masters — used to derive brigade display name ("Юра + Даня · Пафос"). */
  masters?: Master[];
  /** Каталог услуг для выбора и сопоставления id → service. */
  catalog: Service[];
  /** Категории услуг для группировки в пикере. */
  categories: ServiceCategory[];
  cityForDate: (dateKey: string) => string;
  onSave: (apt: Appointment) => void;
  onCancelAppointment: (apt: Appointment) => void;
  /** Sprint 025 STORY-005: header ↻ button opens parent's RescheduleSheet. */
  onReschedule?: (apt: Appointment) => void;
  /** Sprint 025 STORY-005: header ✓ button triggers parent's PaymentSheet. */
  onCompleteQuick?: (apt: Appointment) => void;
}

type Kind = "work" | "event";

// STORY-002-FINAL единый экран записи. Один layout, три режима.
// Внешний слой — bottom sheet 92vh. Сверху по mode:
//  - create: segment [Клиент / Событие] + sticky footer «Создать»
//  - view:   PaymentBlock + QuickActions + AdminActions
//  - done:   зелёный бейдж статуса + QuickActions + AdminActions
//
// TODO(STORY-013): файл 730+ строк — больше golden-rule 400. На этап
// декомпозиции планируется вынести: event-mode ветку (EVENT_PRESETS
// grid + название), SMS-toggle-секцию, handleCreate в отдельный
// builder, id↔AppointmentService helpers в @/lib/appointment-services.
export default function AppointmentSheet({
  open,
  onClose,
  mode,
  appointment,
  clients,
  recentClientIds,
  activeTeam,
  masters,
  catalog,
  categories,
  cityForDate,
  onSave,
  onCancelAppointment,
  onReschedule,
  onCompleteQuick,
}: AppointmentSheetProps) {
  const router = useRouter();
  // Локальный mode-state: позволяет переключаться в 'edit' из 'view'
  // при тапе на «Редактировать» в AdminActions без перекомпоновки
  // sheet родителем.
  const [liveMode, setLiveMode] = useState<AppointmentSheetMode>(mode);
  useEffect(() => setLiveMode(mode), [mode, appointment.id]);

  const [kind, setKind] = useState<Kind>(
    appointment.kind === "event" || appointment.kind === "personal"
      ? "event"
      : "work"
  );
  const [timeStart, setTimeStart] = useState(appointment.time_start);
  const [timeEnd, setTimeEnd] = useState(appointment.time_end);
  const [dateKey, setDateKey] = useState(appointment.date);
  const [clientId, setClientId] = useState<string | null>(appointment.client_id);
  const [locationId, setLocationId] = useState<string | null>(appointment.location_id);
  const [appointmentServices, setAppointmentServices] = useState<AppointmentService[]>(
    appointment.services ?? []
  );
  const [globalDiscount, setGlobalDiscount] = useState<Discount | null>(
    appointment.global_discount ?? null
  );
  const [comment, setComment] = useState(appointment.comment);
  const [addressNote, setAddressNote] = useState(appointment.address_note ?? "");
  const [cancelFlag, setCancelFlag] = useState(appointment.status === "cancelled");
  const [photos, setPhotos] = useState<AppointmentPhoto[]>(appointment.photos ?? []);
  const [smsEnabled, setSmsEnabled] = useState(appointment.reminder_enabled);
  const [eventLabel, setEventLabel] = useState(appointment.comment || "");
  const [clientSheet, setClientSheet] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [bottomWarning, setBottomWarning] = useState<string | null>(null);
  const [askClientFirst, setAskClientFirst] = useState(false);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [sendMsgOpen, setSendMsgOpen] = useState(false);
  const [clientProfileOpen, setClientProfileOpen] = useState(false);
  const [repeatSheetOpen, setRepeatSheetOpen] = useState(false);

  // body scroll lock + ESC close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Resolve initial preset from appointment.total_amount (для view/done
  // показываем как преднастроенный пресет).
  useEffect(() => {
    if (!open) return;
    setTimeStart(appointment.time_start);
    setTimeEnd(appointment.time_end);
    setDateKey(appointment.date);
    setClientId(appointment.client_id);
    setLocationId(appointment.location_id);
    setComment(appointment.comment);
    setAddressNote(appointment.address_note ?? "");
    setCancelFlag(appointment.status === "cancelled");
    setPhotos(appointment.photos ?? []);
    setEventLabel(appointment.comment || "");
    setSmsEnabled(appointment.reminder_enabled);
    setAppointmentServices(appointment.services ?? []);
    setGlobalDiscount(appointment.global_discount ?? null);
    setKind(
      appointment.kind === "event" || appointment.kind === "personal"
        ? "event"
        : "work"
    );
  }, [open, appointment]);

  const client = useMemo<Client | null>(
    () => (clientId ? clients.find((c) => c.id === clientId) ?? null : null),
    [clientId, clients]
  );

  const clientLocations = useMemo<Location[]>(
    () => client?.locations ?? [],
    [client]
  );

  const selectedLocation = useMemo(() => {
    if (clientLocations.length === 0) return null;
    if (locationId)
      return clientLocations.find((l) => l.id === locationId) ?? clientLocations[0];
    return clientLocations.find((l) => l.isPrimary) ?? clientLocations[0];
  }, [clientLocations, locationId]);

  const address = selectedLocation?.address ?? appointment.address ?? "";

  const city = cityForDate(dateKey);
  const cityColor = city ? getCityColor(city) : "#64748b";

  // Рассчитанный итог / длительность для sticky-кнопки + time end.
  const price = appointmentTotal(appointmentServices, globalDiscount);

  // Double-booking detection — only warn; don't block. Reads once from
  // storage per change of the time / date / team inputs. Two overlapping
  // records happen by accident in HVAC often (two brigade leads answer
  // the same call independently); the banner catches it before save.
  // Load the appointment list once when the sheet opens, not on every
  // input keystroke. `loadAppointments` is a synchronous localStorage
  // read — cheap but redundant — and with the list pinned to state we
  // also get the conflict record reference for tap-to-open below.
  const [otherApts, setOtherApts] = useState<Appointment[]>([]);
  useEffect(() => {
    if (!open) return;
    setOtherApts(loadAppointments().filter((a) => a.id !== appointment.id));
  }, [open, appointment.id]);

  const overlapConflict = useMemo<Appointment | null>(() => {
    if (!activeTeam || kind === "event") return null;
    if (!timeStart || !timeEnd || timeStart >= timeEnd) return null;
    for (const other of otherApts) {
      if (other.status === "cancelled") continue;
      if (other.date !== dateKey) continue;
      if (other.team_id !== activeTeam.id) continue;
      // Overlap if ranges intersect (half-open interval).
      if (timeStart < other.time_end && other.time_start < timeEnd) {
        return other;
      }
    }
    return null;
  }, [activeTeam, dateKey, kind, otherApts, timeEnd, timeStart]);

  const overlapWarning = overlapConflict
    ? (() => {
        const who = overlapConflict.client_id
          ? clients.find((c) => c.id === overlapConflict.client_id)?.full_name ??
            "Запись"
          : overlapConflict.comment || "Запись";
        return `${overlapConflict.time_start}–${overlapConflict.time_end} · ${who}`;
      })()
    : null;
  const totalDur = calcDuration(appointmentServices);

  const isEditable = liveMode === "create" || liveMode === "edit";
  const readonly = !isEditable;
  const isEventMode = kind === "event";
  // STORY-009: show "Юра + Даня · Пафос" instead of the cookie-name
  // "Y&D" when masters are available. Falls back to team.name otherwise.
  const teamLabel = activeTeam
    ? masters && masters.length > 0
      ? getTeamDisplayName(activeTeam, masters)
      : activeTeam.name
    : "—";

  // Sprint 025 STORY-005: header quick actions (✓ / 📷 / ↻). Visible
  // only in view mode for records that are still actionable (scheduled
  // or in-progress). Completed / cancelled records already show the
  // status badge in the header slot so these don't appear.
  const photoScrollRef = useRef<HTMLDivElement | null>(null);
  const showQuickActions =
    liveMode === "view" &&
    !isEventMode &&
    appointment.status !== "completed" &&
    appointment.status !== "cancelled";
  const scrollToPhotos = () => {
    photoScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // В create: обязателен preset + клиент. В edit: если услуга уже
  // стоит (total_amount > 0 и status), сохранение разрешено и без
  // нового preset-выбора — меняем только поля что отредактировали.
  const canSave = isEventMode
    ? Boolean(eventLabel.trim())
    : Boolean(clientId && appointmentServices.length > 0);

  // Whether the user has entered anything worth protecting on close.
  // Event mode uses eventLabel; work mode uses client + services + comment.
  const isDirty = isEditable && (isEventMode
    ? Boolean(eventLabel.trim())
    : Boolean(clientId || appointmentServices.length > 0 || comment.trim()));

  if (!open) return null;

  // ─── Handlers ─────────────────────────────────────────────────────

  const attemptClose = () => {
    if (!isDirty) {
      onClose();
      return;
    }
    setCloseConfirm(true);
  };

  const handleCreate = () => {
    if (isEventMode) {
      const base: Appointment = {
        ...appointment,
        date: dateKey,
        time_start: timeStart,
        time_end: timeEnd,
        kind: "event",
        comment: eventLabel.trim(),
        team_id: activeTeam?.id ?? null,
        color_override:
          EVENT_PRESETS.find((e) =>
            eventLabel.toLowerCase().startsWith(e.label.toLowerCase())
          )?.color ?? null,
        total_amount: 0,
        custom_total: true,
        status: "scheduled",
        updated_at: new Date().toISOString(),
      };
      onSave(base);
      return;
    }
    if (!client || appointmentServices.length === 0) return;
    const total = appointmentTotal(appointmentServices, globalDiscount);
    const duration = calcDuration(appointmentServices);
    const serviceNames = appointmentServices
      .map((l) => {
        const svc = catalog.find((s) => s.id === l.serviceId);
        return svc ? (l.quantity > 1 ? `x${l.quantity} ${svc.name}` : svc.name) : null;
      })
      .filter(Boolean)
      .join(", ");
    const finalComment = comment.trim()
      ? `${serviceNames} — ${comment.trim()}`
      : serviceNames;
    const saved: Appointment = {
      ...appointment,
      date: dateKey,
      time_start: timeStart,
      // Auto-extend time_end by total duration for новой записи.
      // Clamp at 23:59 instead of wrapping: a visit that spans midnight
      // should be booked as two records (cancellable separately), not
      // silently end at the same hour on the same day.
      time_end:
        liveMode === "create" && duration > 0
          ? (() => {
              const [h, m] = timeStart.split(":").map(Number);
              const endMin = Math.min(23 * 60 + 59, h * 60 + m + duration);
              const eh = Math.floor(endMin / 60);
              const em = endMin % 60;
              return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
            })()
          : timeEnd,
      client_id: client.id,
      location_id: locationId,
      team_id: activeTeam?.id ?? null,
      service_ids: appointmentServices.map((l) => l.serviceId),
      services: appointmentServices,
      global_discount: globalDiscount,
      total_duration: duration,
      total_amount: total,
      custom_total: true,
      comment: finalComment,
      address,
      address_note: addressNote.trim(),
      photos,
      reminder_enabled: smsEnabled && Boolean((client as Client).phone),
      kind: "work",
      // Cancel toggle wins over everything else. When the dispatcher
      // unchecks cancel on an already-cancelled record, restore it to
      // "scheduled" — otherwise the record stays cancelled silently and
      // the toggle looks broken (Sprint 017 fix).
      status: cancelFlag
        ? "cancelled"
        : liveMode === "edit"
          ? appointment.status === "cancelled"
            ? "scheduled"
            : appointment.status
          : "scheduled",
      updated_at: new Date().toISOString(),
    };
    onSave(saved);
  };

  const handlePay = (payment: AppointmentPayment) => {
    onSave({
      ...appointment,
      status: "completed",
      payment,
      total_amount: appointment.total_amount,
      updated_at: new Date().toISOString(),
    });
    onClose();
  };

  const doneBadge = (() => {
    if (mode !== "done" || !appointment.payment) return null;
    const p = appointment.payment;
    if (p.method === "cash") {
      return `✅ Выполнено · нал · ${formatEUR(p.cashAmount)}`;
    }
    if (p.method === "card") {
      return `✅ Выполнено · карта · ${formatEUR(p.cardAmount)}`;
    }
    if (p.method === "split") {
      return `✅ Выполнено · 💵 ${formatEUR(p.cashAmount)} + 💳 ${formatEUR(p.cardAmount)}`;
    }
    return `✅ Выполнено · 📄 счёт компании · ${formatEUR(appointment.total_amount)}`;
  })();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={attemptClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--surface-card)] rounded-[20px] shadow-2xl flex flex-col"
        style={{ height: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex-shrink-0 px-4 pb-2 flex items-center justify-between gap-2">
          {liveMode === "create" ? (
            <div className="inline-flex rounded-[10px] bg-[var(--fill-tertiary)] p-1 text-[13px] font-semibold">
              {(["work", "event"] as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`px-4 py-1.5 rounded-[8px] transition ${
                    kind === k
                      ? "bg-[var(--surface-card)] text-[var(--label)] shadow-sm"
                      : "text-[var(--label-secondary)]"
                  }`}
                >
                  {k === "work" ? "Клиент" : "Событие"}
                </button>
              ))}
            </div>
          ) : liveMode === "edit" ? (
            <div className="flex-1 text-[15px] font-semibold text-[var(--accent)]">
              Редактирование
            </div>
          ) : liveMode === "done" ? (
            <div className="flex-1 text-[13px] font-semibold text-[var(--system-green)] truncate">
              {doneBadge}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* Sprint 025 STORY-005 — one-tap shortcuts on open visits:
              ✓ complete, 📷 add photo, ↻ reschedule. They mirror the
              three actions the dispatcher reaches for most; the slower
              admin options still live in the ⋯ menu inside ClientBlock. */}
          {showQuickActions && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {onCompleteQuick && (
                <button
                  type="button"
                  onClick={() => onCompleteQuick(appointment)}
                  aria-label="Отметить выполненной"
                  title="Выполнено"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--system-green)] active:bg-[rgba(52,199,89,0.1)]"
                >
                  <Check size={20} strokeWidth={2.5} />
                </button>
              )}
              <button
                type="button"
                onClick={scrollToPhotos}
                aria-label="Перейти к фото"
                title="Фото"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--accent)] active:bg-[var(--accent-tint)]"
              >
                <Camera size={19} strokeWidth={2} />
              </button>
              {onReschedule && (
                <button
                  type="button"
                  onClick={() => onReschedule(appointment)}
                  aria-label="Перенести запись"
                  title="Перенести"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--system-orange)] active:bg-[rgba(255,149,0,0.1)]"
                >
                  <CalendarClock size={19} strokeWidth={2} />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={attemptClose}
            aria-label="Закрыть"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-4">
          {/* City/team caption — read-only info strip. No dropdown, no
              click. City is edited from the calendar day header. */}
          <div className="px-4 py-2 bg-[var(--surface-grouped)] border-b border-[var(--separator)] flex items-center gap-2 text-[13px]">
            {city && (
              <span
                className="font-semibold flex-shrink-0"
                style={{ color: cityColor }}
              >
                {city}
              </span>
            )}
            {city && <span className="text-[var(--label-tertiary)]">·</span>}
            <span className="text-[var(--label)] flex-shrink-0">{teamLabel}</span>
          </div>

          <TimeBlock
            date={dateKey}
            timeStart={timeStart}
            timeEnd={timeEnd}
            readOnly={readonly}
            onChange={({ date: d, timeStart: s, timeEnd: e }) => {
              setDateKey(d);
              setTimeStart(s);
              setTimeEnd(e);
            }}
          />

          {overlapConflict && overlapWarning && isEditable && !isEventMode && (
            <div className="px-4 pt-2">
              <details className="group rounded-[14px] bg-[rgba(255,149,0,0.08)] border border-[rgba(255,149,0,0.2)] text-[12px] text-[var(--label)]">
                <summary className="flex items-start gap-2 px-3 py-2 cursor-pointer list-none">
                  <span aria-hidden className="text-[var(--system-orange)]">⚠</span>
                  <div className="flex-1">
                    <div className="font-semibold">Пересечение с записью</div>
                    <div className="text-[var(--label-secondary)]">{overlapWarning}</div>
                  </div>
                  <span className="text-[var(--system-orange)] text-[12px] group-open:rotate-180 transition">
                    ▾
                  </span>
                </summary>
                <div className="px-3 pb-2 pt-0.5 text-[var(--label)] border-t border-[rgba(255,149,0,0.2)] space-y-0.5">
                  {(() => {
                    const cc = overlapConflict;
                    const serviceNames = cc.service_ids
                      .map((sid) => catalog.find((s) => s.id === sid)?.name)
                      .filter(Boolean)
                      .join(", ");
                    const phone = cc.client_id
                      ? clients.find((c) => c.id === cc.client_id)?.phone ?? ""
                      : "";
                    const statusLabel =
                      cc.status === "completed"
                        ? "выполнена"
                        : cc.status === "in_progress"
                          ? "в работе"
                          : "запланирована";
                    return (
                      <>
                        {serviceNames && (
                          <div className="truncate">Услуги: {serviceNames}</div>
                        )}
                        <div>Статус: {statusLabel}</div>
                        {phone && (
                          <a
                            href={`tel:${phone.replace(/\D/g, "")}`}
                            className="inline-flex items-center gap-1 font-semibold underline decoration-[var(--system-orange)] decoration-1 underline-offset-2 text-[var(--system-orange)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Позвонить {phone}
                          </a>
                        )}
                      </>
                    );
                  })()}
                </div>
              </details>
            </div>
          )}

          {/* Event mode body */}
          {isEventMode && isEditable ? (
            <div className="px-4 pt-4 space-y-3">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Тип события
              </div>
              <div className="grid grid-cols-3 gap-2">
                {EVENT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setEventLabel(p.label);
                      // Adjust end by duration; allDay = 8:00–20:00
                      if (p.allDay) {
                        setTimeStart("08:00");
                        setTimeEnd("20:00");
                      } else {
                        const [h, m] = timeStart.split(":").map(Number);
                        // Clamp at 23:59 rather than wrapping past midnight.
                        const endMin = Math.min(23 * 60 + 59, h * 60 + m + p.duration);
                        const eh = Math.floor(endMin / 60);
                        const em = endMin % 60;
                        setTimeEnd(`${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`);
                      }
                    }}
                    className="py-3 rounded-[14px] border border-[var(--separator)] bg-[var(--surface-card)] text-[13px] font-semibold text-[var(--label)] active:scale-[0.98] flex flex-col items-center gap-1"
                    style={eventLabel === p.label ? { borderColor: p.color, background: `${p.color}14` } : undefined}
                  >
                    {(() => {
                      const Icon = EVENT_ICONS[p.icon];
                      return (
                        <Icon
                          size={20}
                          strokeWidth={2}
                        />
                      );
                    })()}
                    {p.label}
                  </button>
                ))}
              </div>
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1.5">
                  Название
                </div>
                <input
                  type="text"
                  value={eventLabel}
                  onChange={(e) => setEventLabel(e.target.value)}
                  placeholder="Событие"
                  className="w-full h-11 px-3.5 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
                />
              </div>
            </div>
          ) : (
            <>
              <ClientBlock
                client={client}
                readonly={readonly}
                onPick={() => setClientSheet(true)}
                onChange={() => setClientId(null)}
                onMenu={client ? () => setClientMenuOpen(true) : undefined}
              />

              <LocationsBlock
                client={client}
                selectedLocationId={locationId}
                readOnly={readonly}
                addressNote={addressNote}
                onSelectLocation={setLocationId}
                onAddressNoteChange={setAddressNote}
              />

              <ServicesBlock
                services={appointmentServices}
                globalDiscount={globalDiscount}
                catalog={catalog}
                readonly={readonly}
                onServicesChange={setAppointmentServices}
                onOpenPicker={() => {
                  if (!clientId) {
                    setAskClientFirst(true);
                    return;
                  }
                  setServicePickerOpen(true);
                }}
              />

              <IncomeBlock
                services={appointmentServices}
                globalDiscount={globalDiscount}
                catalog={catalog}
                readonly={readonly}
                onServicesChange={setAppointmentServices}
                onGlobalDiscountChange={setGlobalDiscount}
              />

              <CommentBlock
                value={comment}
                readonly={readonly}
                onChange={setComment}
              />

              <div ref={photoScrollRef}>
                <PhotoBlock
                  photos={photos}
                  readonly={readonly}
                  locationLabel={selectedLocation?.label}
                  onChange={setPhotos}
                />
              </div>

              {/* Cancel-appointment toggle — always visible when the
                  appointment isn't already completed. Flipping on
                  marks status as cancelled on save; flipping off in
                  edit restores the previous status. */}
              {appointment.status !== "completed" && isEditable && (
                <div className="px-4 pt-3 flex items-center justify-between">
                  <div>
                    <div className="text-[15px] font-semibold text-[var(--label)]">
                      Запись отменена
                    </div>
                    <div className="text-[12px] text-[var(--label-secondary)]">
                      Клиент отказался от услуги
                    </div>
                  </div>
                  <IOSSwitch
                    checked={cancelFlag}
                    onChange={setCancelFlag}
                    ariaLabel="Запись отменена"
                  />
                </div>
              )}

              {/* SMS toggle только в create */}
              {isEditable && client && client.phone && (
                <div className="px-4 pt-4 flex items-center justify-between">
                  <div>
                    <div className="text-[15px] font-semibold text-[var(--label)]">
                      SMS-напоминание
                    </div>
                    <div className="text-[12px] text-[var(--label-secondary)]">
                      за сутки и за час до визита
                    </div>
                  </div>
                  <IOSSwitch
                    checked={smsEnabled}
                    onChange={setSmsEnabled}
                    ariaLabel="SMS-напоминание"
                  />
                </div>
              )}
            </>
          )}

          {/* View-mode payment entry (scheduled → completed).
              QuickActions + AdminActions removed — the ⋯ in the client
              header carries those actions, and Call lives in-line as
              the green phone icon. Every block stays visible so the
              user sees the full record at a glance. */}
          {liveMode === "view" && (
            <PaymentBlock total={appointment.total_amount} onPay={handlePay} />
          )}
        </div>

        {/* Sticky save: в create и в edit — single full-width button.
            Cancel lives as the header ✕; backdrop/Esc also prompt. */}
        {isEditable && (
          <div
            className="flex-shrink-0 px-4 pt-2 border-t border-[var(--separator)]"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)" }}
          >
            {bottomWarning && (
              <div className="mb-2 px-3 py-2 rounded-[10px] bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.2)] text-[13px] font-semibold text-[var(--system-red)] text-center">
                {bottomWarning}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (!canSave) {
                  setBottomWarning("Заполните сначала данные");
                  window.setTimeout(() => setBottomWarning(null), 4000);
                  return;
                }
                handleCreate();
              }}
              className={`w-full h-11 rounded-[10px] text-[15px] font-semibold transition ${
                canSave
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)] active:scale-[0.99]"
                  : "bg-[var(--fill-primary)] text-[var(--label-tertiary)]"
              }`}
            >
              {(() => {
                if (liveMode === "edit") {
                  return canSave
                    ? `Сохранить · ${formatEUR(price)}`
                    : "Сохранить";
                }
                if (isEventMode) return "Создать событие";
                return canSave
                  ? `Создать запись · ${formatEUR(price)}`
                  : "Создать запись";
              })()}
            </button>
          </div>
        )}
      </div>

      {/* Sub-sheets */}
      <ClientPickerSheet
        open={clientSheet}
        onClose={() => setClientSheet(false)}
        onSelect={(c) => {
          setClientId(c.id);
          const locs = c.locations;
          const primary = locs.find((l) => l.isPrimary) ?? locs[0] ?? null;
          setLocationId(primary?.id ?? null);
          setClientSheet(false);
        }}
        clients={clients}
        recentClientIds={recentClientIds}
      />

      <ServicePickerSheet
        open={servicePickerOpen}
        onClose={() => setServicePickerOpen(false)}
        services={catalog}
        categories={categories}
        brigadeId={activeTeam?.id ?? null}
        initialSelectedIds={servicesToIds(appointmentServices)}
        onConfirm={(ids) => {
          setAppointmentServices(
            idsToServices(ids, catalog, appointmentServices)
          );
        }}
        clientName={client?.full_name ?? null}
        clientPhone={client?.phone ?? null}
      />

      {/* Close-confirmation modal — centered, minimalist, 2 buttons. */}
      {closeConfirm && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-5"
          onClick={() => setCloseConfirm(false)}
        >
          <div
            className="w-full max-w-[300px] bg-[var(--surface-card)] rounded-[20px] shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center text-[17px] font-semibold tracking-tight text-[var(--label)] py-2">
              Сохранить запись?
            </div>
            {!canSave && (
              <div className="px-1 pt-1 pb-2 text-center text-[12px] text-[var(--system-red)]">
                Не хватает данных для сохранения
              </div>
            )}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (!canSave) return;
                  handleCreate();
                  setCloseConfirm(false);
                }}
                disabled={!canSave}
                className={`w-full h-11 rounded-[10px] text-[15px] font-semibold transition ${
                  canSave
                    ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)] active:scale-[0.99]"
                    : "bg-[var(--fill-primary)] text-[var(--label-tertiary)] cursor-not-allowed"
                }`}
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => {
                  setCloseConfirm(false);
                  onClose();
                }}
                className="w-full h-11 rounded-[10px] bg-[var(--surface-card)] border border-[var(--separator)] text-[15px] font-semibold text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)]"
              >
                Не сохранять
              </button>
            </div>
          </div>
        </div>
      )}

      {/* "Pick client first?" prompt — fires when the dispatcher taps
          the service button before a client is set. Mirrors the common
          two-step flow. "Да" opens ClientPicker; "Нет" goes straight
          to the services. */}
      {askClientFirst && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-5"
          onClick={() => setAskClientFirst(false)}
        >
          <div
            className="w-full max-w-[300px] bg-[var(--surface-card)] rounded-[20px] shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center text-[15px] text-[var(--label)] py-2 px-1 leading-snug">
              Клиент для записи ещё не выбран.
              <br />
              Выбрать клиента сейчас?
            </div>
            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAskClientFirst(false);
                  setServicePickerOpen(true);
                }}
                className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[15px] font-medium text-[var(--label)] active:bg-[var(--fill-secondary)]"
              >
                Нет
              </button>
              <button
                type="button"
                onClick={() => {
                  setAskClientFirst(false);
                  setClientSheet(true);
                }}
                className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99]"
              >
                Да
              </button>
            </div>
          </div>
        </div>
      )}

      {client && (
        <ClientActionMenu
          open={clientMenuOpen}
          onClose={() => setClientMenuOpen(false)}
          client={client}
          onProfile={() => setClientProfileOpen(true)}
          onSendMessage={() => setSendMsgOpen(true)}
          onOpenChat={() => {
            const existing = loadChats().find((ch) => ch.client_id === client.id);
            if (existing) {
              router.push(`/dashboard/chats?chat_id=${existing.id}`);
            } else {
              router.push(`/dashboard/chats?client_id=${client.id}`);
            }
          }}
          onShare={async () => {
            const parts = [client.full_name];
            if (client.phone) parts.push(client.phone);
            const text = parts.join(" · ");
            if (typeof navigator !== "undefined" && navigator.share) {
              try {
                await navigator.share({ title: client.full_name, text });
              } catch {
                // user dismissed
              }
            } else if (typeof navigator !== "undefined" && navigator.clipboard) {
              try {
                await navigator.clipboard.writeText(text);
              } catch {
                // ignore
              }
            }
          }}
          onScheduleRepeat={
            appointment.status === "completed" && !isEventMode && client
              ? () => setRepeatSheetOpen(true)
              : undefined
          }
          onDownloadInvoice={
            appointment.status === "completed" && !isEventMode && client
              ? async () => {
                  // Dynamic import keeps jspdf (+ renderer) out of the
                  // initial bundle. First tap incurs a one-off chunk
                  // load; subsequent taps are cached.
                  const { generateInvoicePDF, downloadBlob } = await import(
                    "@/lib/finance/invoice"
                  );
                  const { blob, filename } = generateInvoicePDF({
                    appointment,
                    client,
                    services: catalog,
                    team: activeTeam,
                    company: loadCompany(),
                    includePhotos: (appointment.photos ?? []).length > 0,
                  });
                  downloadBlob(blob, filename);
                }
              : undefined
          }
          onShareAppointment={
            liveMode === "create" || isEventMode
              ? undefined
              : async () => {
                  const serviceNames = appointmentServices
                    .map((l) => catalog.find((s) => s.id === l.serviceId)?.name)
                    .filter((n): n is string => Boolean(n));
                  const origin =
                    typeof window !== "undefined" ? window.location.origin : "";
                  const url = buildShareUrl(origin, {
                    d: dateKey,
                    ts: timeStart,
                    te: timeEnd,
                    c: client.full_name,
                    s: serviceNames,
                    a: address || undefined,
                    b: activeTeam?.name,
                    t: Math.round(price),
                    st: appointment.status,
                  });
                  const title = `Запись ${dateKey} · ${timeStart}`;
                  if (typeof navigator !== "undefined" && navigator.share) {
                    try {
                      await navigator.share({ title, url });
                      return;
                    } catch {
                      // user dismissed — fall through to clipboard.
                    }
                  }
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    try {
                      await navigator.clipboard.writeText(url);
                      window.alert("Ссылка скопирована — отправьте клиенту");
                    } catch {
                      window.prompt("Ссылка:", url);
                    }
                  } else {
                    window.prompt("Ссылка:", url);
                  }
                }
          }
        />
      )}

      {client && (
        <SendMessagePopup
          open={sendMsgOpen}
          onClose={() => setSendMsgOpen(false)}
          phone={client.phone ?? null}
          clientName={client.full_name}
        />
      )}

      {client && (
        <RepeatReminderSheet
          open={repeatSheetOpen}
          clientName={client.full_name}
          serviceSummary={appointmentServices
            .map((l) => catalog.find((s) => s.id === l.serviceId)?.name)
            .filter(Boolean)
            .join(" · ")}
          lastDate={appointment.date}
          onClose={() => setRepeatSheetOpen(false)}
          onConfirm={(months, note) => {
            const serviceSummary = appointmentServices
              .map((l) => catalog.find((s) => s.id === l.serviceId)?.name)
              .filter((n): n is string => Boolean(n))
              .join(" · ");
            createRecurring({
              client_id: client.id,
              client_name: client.full_name,
              phone: client.phone ?? "",
              team_id: activeTeam?.id ?? null,
              service_ids: appointmentServices.map((l) => l.serviceId),
              service_summary: serviceSummary,
              last_date: appointment.date,
              interval_months: months,
              note,
            });
          }}
        />
      )}

      {/* Client profile overlay — rendered on top of the appointment
          sheet so picking ⋯ → Профиль doesn't navigate away. Tapping
          ← inside closes the overlay and leaves the draft intact. */}
      {clientProfileOpen && client && (
        <div
          className="fixed inset-0 z-[95] bg-[var(--surface-overlay)] backdrop-blur-[2px] flex items-center justify-center p-2"
          onClick={() => setClientProfileOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[var(--surface-card)] rounded-[20px] shadow-2xl flex flex-col overflow-hidden"
            style={{ height: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <ClientProfileView
              clientId={client.id}
              onBack={() => setClientProfileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Keep reference list silenced */}
      <div className="hidden">{CITY_LIST.length}</div>
    </div>
  );
}

// ─── id ↔ AppointmentService helpers ────────────────────────────────────
// ServicePickerSheet оперирует `string[]` с дубликатами (quantity = кол-во
// повторов id). AppointmentService[] нужен для корректного расчёта bulk
// price и per-line пользовательских переопределений цены. Эти две
// функции мостят два представления, сохраняя overrides из prev.

function servicesToIds(list: AppointmentService[]): string[] {
  const out: string[] = [];
  for (const s of list) {
    for (let i = 0; i < s.quantity; i++) out.push(s.serviceId);
  }
  return out;
}

function idsToServices(
  ids: string[],
  catalog: Service[],
  prev: AppointmentService[]
): AppointmentService[] {
  const byId = new Map<string, Service>();
  for (const svc of catalog) byId.set(svc.id, svc);
  const prevById = new Map<string, AppointmentService>();
  for (const line of prev) prevById.set(line.serviceId, line);

  const qty = new Map<string, number>();
  for (const id of ids) qty.set(id, (qty.get(id) ?? 0) + 1);

  const out: AppointmentService[] = [];
  // Сохраняем исходный порядок: сначала строки, которые уже были в prev
  // (это сохраняет ручные перестановки в UI), потом новые.
  const seen = new Set<string>();
  for (const line of prev) {
    const q = qty.get(line.serviceId);
    if (!q) continue;
    seen.add(line.serviceId);
    const svc = byId.get(line.serviceId);
    if (!svc) continue;
    // Если бригада не трогала цену (pricePerUnit === originalPrice),
    // пересчитываем с учётом bulk. Если трогала — сохраняем override.
    const userOverride = line.pricePerUnit !== line.originalPrice;
    const ppu = userOverride ? line.pricePerUnit : pricePerUnit(svc, q);
    out.push({
      ...line,
      quantity: q,
      pricePerUnit: ppu,
      originalPrice: svc.price,
      totalPrice: q * ppu,
      duration: q * svc.duration_minutes,
    });
  }
  for (const [id, q] of qty) {
    if (seen.has(id)) continue;
    const svc = byId.get(id);
    if (!svc) continue;
    const ppu = pricePerUnit(svc, q);
    out.push({
      serviceId: id,
      quantity: q,
      pricePerUnit: ppu,
      originalPrice: svc.price,
      totalPrice: q * ppu,
      duration: q * svc.duration_minutes,
    });
  }
  return out;
}

