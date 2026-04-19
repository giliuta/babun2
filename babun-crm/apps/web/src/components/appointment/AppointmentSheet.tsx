"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Appointment,
  AppointmentPayment,
  AppointmentService,
  Discount,
} from "@/lib/appointments";
import type { Client, Location } from "@/lib/clients";
import { upsertClient } from "@/lib/clients";
import type { Team } from "@/lib/masters";
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

import TimeBlock from "./TimeBlock";
import ClientBlock from "./ClientBlock";
import LocationsBlock from "./LocationsBlock";
import ServicesBlock from "./ServicesBlock";
import CommentBlock from "./CommentBlock";
import QuickActions from "./QuickActions";
import PaymentBlock from "./PaymentBlock";
import AdminActions from "./AdminActions";

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
  /** Каталог услуг для выбора и сопоставления id → service. */
  catalog: Service[];
  /** Категории услуг для группировки в пикере. */
  categories: ServiceCategory[];
  cityForDate: (dateKey: string) => string;
  onSave: (apt: Appointment) => void;
  onCancelAppointment: (apt: Appointment) => void;
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
  catalog,
  categories,
  cityForDate,
  onSave,
  onCancelAppointment,
}: AppointmentSheetProps) {
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
  const [smsEnabled, setSmsEnabled] = useState(appointment.reminder_enabled);
  const [eventLabel, setEventLabel] = useState(appointment.comment || "");
  const [clientSheet, setClientSheet] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [bottomWarning, setBottomWarning] = useState<string | null>(null);

  // STORY-005: auto-open ClientPicker once per create-session so the
  // dispatcher lands straight in the picker. Guarded by a ref so
  // closing the picker via X doesn't reopen it; the ref is cleared
  // whenever the sheet is reused for a different appointment.
  const clientPickerAutoOpenedRef = useRef(false);
  useEffect(() => {
    if (
      liveMode === "create" &&
      kind === "work" &&
      !clientId &&
      !clientPickerAutoOpenedRef.current
    ) {
      clientPickerAutoOpenedRef.current = true;
      // Whole point of this effect is to reactively open the picker on
      // entering create+work; ref guard prevents cascading renders.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClientSheet(true);
    }
  }, [liveMode, kind, clientId]);
  useEffect(() => {
    clientPickerAutoOpenedRef.current = false;
  }, [appointment.id]);

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
  const totalDur = calcDuration(appointmentServices);

  const isEditable = liveMode === "create" || liveMode === "edit";
  const readonly = !isEditable;
  const isEventMode = kind === "event";
  const teamLabel = activeTeam?.name ?? "—";

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
      time_end:
        liveMode === "create" && duration > 0
          ? (() => {
              const [h, m] = timeStart.split(":").map(Number);
              const endMin = h * 60 + m + duration;
              const eh = Math.floor(endMin / 60) % 24;
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
      reminder_enabled: smsEnabled && Boolean((client as Client).phone),
      kind: "work",
      // Не сбрасываем completed статус в edit.
      status:
        liveMode === "edit" ? appointment.status : "scheduled",
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

  const handleAdminCancel = () => {
    onCancelAppointment(appointment);
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
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={attemptClose}
    >
      <div
        className="w-full lg:max-w-lg bg-white rounded-t-3xl lg:rounded-3xl lg:mb-8 shadow-2xl flex flex-col"
        style={{ height: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grabber */}
        <div className="flex-shrink-0 flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex-shrink-0 px-4 pb-2 flex items-center justify-between gap-2">
          {liveMode === "create" ? (
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-[13px] font-semibold">
              {(["work", "event"] as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`px-4 py-1.5 rounded-lg transition ${
                    kind === k
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  {k === "work" ? "Клиент" : "Событие"}
                </button>
              ))}
            </div>
          ) : liveMode === "edit" ? (
            <div className="flex-1 text-[14px] font-semibold text-violet-700">
              Редактирование
            </div>
          ) : liveMode === "done" ? (
            <div className="flex-1 text-[13px] font-semibold text-emerald-700 truncate">
              {doneBadge}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Закрыть"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 active:bg-slate-100"
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
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-2 text-[13px]">
            {city && (
              <span
                className="font-semibold flex-shrink-0"
                style={{ color: cityColor }}
              >
                {city}
              </span>
            )}
            {city && <span className="text-slate-400">·</span>}
            <span className="text-slate-700 flex-shrink-0">{teamLabel}</span>
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

          {/* Event mode body */}
          {isEventMode && isEditable ? (
            <div className="px-4 pt-4 space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                        const endMin = h * 60 + m + p.duration;
                        const eh = Math.floor(endMin / 60) % 24;
                        const em = endMin % 60;
                        setTimeEnd(`${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`);
                      }
                    }}
                    className="py-3 rounded-xl border-2 border-slate-200 bg-white text-[12px] font-semibold text-slate-800 active:scale-[0.98]"
                    style={eventLabel === p.label ? { borderColor: p.color, background: `${p.color}14` } : undefined}
                  >
                    <div className="text-[18px] mb-0.5">
                      {p.icon === "coffee" ? "☕" : p.icon === "briefcase" ? "💼" : p.icon === "navigation" ? "🧭" : p.icon === "moon" ? "🌙" : "✈️"}
                    </div>
                    {p.label}
                  </button>
                ))}
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Название
                </div>
                <input
                  type="text"
                  value={eventLabel}
                  onChange={(e) => setEventLabel(e.target.value)}
                  placeholder="Событие"
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-[15px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
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
              />

              {client && (
                <LocationsBlock
                  client={client}
                  selectedLocationId={locationId}
                  readOnly={readonly}
                  onSelectLocation={setLocationId}
                  onSaveLocation={(loc) => {
                    // Upsert-by-id: if the id already lives on the
                    // client the entry gets replaced (edit flow),
                    // otherwise it's appended (add flow). Both paths
                    // persist via upsertClient → babun:clients-changed
                    // so the client's record page sees the same data.
                    const existing = client.locations.some(
                      (l) => l.id === loc.id
                    );
                    const nextLocations = existing
                      ? client.locations.map((l) =>
                          l.id === loc.id ? loc : l
                        )
                      : [...client.locations, loc];
                    const nextClient: Client = {
                      ...client,
                      locations: nextLocations,
                    };
                    upsertClient(nextClient);
                    setLocationId(loc.id);
                  }}
                />
              )}

              <ServicesBlock
                services={appointmentServices}
                globalDiscount={globalDiscount}
                catalog={catalog}
                readonly={readonly}
                requiresClient={!clientId}
                onServicesChange={setAppointmentServices}
                onGlobalDiscountChange={setGlobalDiscount}
                onOpenPicker={() => setServicePickerOpen(true)}
              />

              <CommentBlock
                value={comment}
                readonly={readonly}
                onChange={setComment}
              />

              {/* SMS toggle только в create */}
              {isEditable && client && client.phone && (
                <div className="px-4 pt-4 flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-semibold text-slate-800">
                      SMS-напоминание
                    </div>
                    <div className="text-[11px] text-slate-500">
                      за сутки и за час до визита
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSmsEnabled((v) => !v)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${
                      smsEnabled ? "bg-violet-600" : "bg-slate-300"
                    }`}
                    aria-pressed={smsEnabled}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        smsEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              )}
            </>
          )}

          {/* View/Done actions — отображаются только когда не
              редактируем. В edit всё поведение как в create. */}
          {(liveMode === "view" || liveMode === "done") && (
            <>
              <QuickActions
                phone={client?.phone}
                address={address}
              />
              {liveMode === "view" && (
                <PaymentBlock total={appointment.total_amount} onPay={handlePay} />
              )}
              <AdminActions
                canReschedule={liveMode === "view"}
                onEdit={() => setLiveMode("edit")}
                onReschedule={() => setLiveMode("edit")}
                onCancel={handleAdminCancel}
              />
            </>
          )}
        </div>

        {/* Sticky save: в create и в edit — single full-width button.
            Cancel lives as the header ✕; backdrop/Esc also prompt. */}
        {isEditable && (
          <div
            className="flex-shrink-0 px-4 pt-2 border-t border-slate-200"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)" }}
          >
            {bottomWarning && (
              <div className="mb-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-[13px] font-semibold text-rose-700 text-center">
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
              className={`w-full h-12 rounded-xl text-[14px] font-semibold transition ${
                canSave
                  ? "bg-violet-600 text-white active:scale-[0.99]"
                  : "bg-slate-300 text-slate-500"
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
      />

      {/* Close-confirmation modal — centered, minimalist, 2 buttons. */}
      {closeConfirm && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-5"
          onClick={() => setCloseConfirm(false)}
        >
          <div
            className="w-full max-w-[300px] bg-white rounded-2xl shadow-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center text-[16px] font-semibold text-slate-900 py-2">
              Сохранить запись?
            </div>
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={() => {
                  if (canSave) {
                    handleCreate();
                    setCloseConfirm(false);
                    return;
                  }
                  setCloseConfirm(false);
                  setBottomWarning("Заполните сначала данные");
                  window.setTimeout(() => setBottomWarning(null), 4000);
                }}
                className="w-full h-11 rounded-xl bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.99]"
              >
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => {
                  setCloseConfirm(false);
                  onClose();
                }}
                className="w-full h-11 rounded-xl bg-white border border-slate-200 text-[14px] font-semibold text-rose-600 active:bg-rose-50"
              >
                Не сохранять
              </button>
            </div>
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

