"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Appointment,
  AppointmentPayment,
  AppointmentService,
  Discount,
} from "@/lib/appointments";
import type { Client, Location } from "@/lib/clients";
import type { Team } from "@/lib/masters";
import type { Service } from "@/lib/services";
import { pricePerUnit } from "@/lib/services";
import { EVENT_PRESETS } from "@/lib/event-presets";
import { getCityColor, CITY_LIST } from "@/lib/day-cities";
import { formatEUR } from "@/lib/money";
import {
  appointmentTotal,
  totalDuration as calcDuration,
} from "@/lib/finance/appointment-calc";
import ClientPickerSheet from "@/components/appointments/sheet/ClientPickerSheet";
import type { DraftClient } from "@/lib/draft-clients";

import TimeBlock from "./TimeBlock";
import CompactWheelPicker from "./CompactWheelPicker";
import CityPicker from "./CityPicker";
import ClientBlock from "./ClientBlock";
import LocationPicker from "./LocationPicker";
import AddressBlock from "./AddressBlock";
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
  draftClients: DraftClient[];
  recentClientIds: string[];
  teams: Team[];
  activeTeam: Team | null;
  /** Каталог услуг для выбора и сопоставления id → service. */
  catalog: Service[];
  cityForDate: (dateKey: string) => string;
  onSave: (apt: Appointment) => void;
  onCancelAppointment: (apt: Appointment) => void;
  onCityChange: (dateKey: string, city: string) => void;
}

type Kind = "work" | "event";

// STORY-002-FINAL единый экран записи. Один layout, три режима.
// Внешний слой — bottom sheet 92vh. Сверху по mode:
//  - create: segment [Клиент / Событие] + sticky footer «Создать»
//  - view:   PaymentBlock + QuickActions + AdminActions
//  - done:   зелёный бейдж статуса + QuickActions + AdminActions
export default function AppointmentSheet({
  open,
  onClose,
  mode,
  appointment,
  clients,
  draftClients,
  recentClientIds,
  activeTeam,
  catalog,
  cityForDate,
  onSave,
  onCancelAppointment,
  onCityChange,
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
  const [showTimeEditor, setShowTimeEditor] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  // Wrapper around TimeBlock + inline pickers — pointerdown outside
  // this region collapses the time picker, mimicking an accordion.
  const timeAreaRef = useRef<HTMLDivElement>(null);
  const [clientSheet, setClientSheet] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);

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
      if (e.key === "Escape") onClose();
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
    setShowTimeEditor(false);
    setShowCityPicker(false);
  }, [open, appointment]);

  const client = useMemo(
    () =>
      clientId
        ? clients.find((c) => c.id === clientId) ??
          draftClients.find((c) => c.id === clientId) ??
          null
        : null,
    [clientId, clients, draftClients]
  );

  const clientLocations = useMemo<Location[]>(
    () => (client && "locations" in client ? (client as Client).locations : []),
    [client]
  );

  const selectedLocation = useMemo(() => {
    if (clientLocations.length === 0) return null;
    if (locationId)
      return clientLocations.find((l) => l.id === locationId) ?? clientLocations[0];
    return clientLocations.find((l) => l.isPrimary) ?? clientLocations[0];
  }, [clientLocations, locationId]);

  // Draft clients store address/acUnits inline (no Location[] yet) — fall
  // back to those so the one-visit A/C count suggestion still works.
  const draftClient = client && !("locations" in client) ? (client as DraftClient) : null;
  const address =
    selectedLocation?.address ?? draftClient?.address ?? appointment.address ?? "";
  const acUnits = selectedLocation?.acUnits ?? draftClient?.ac_units ?? 0;

  const city = cityForDate(dateKey);
  const cityColor = city ? getCityColor(city) : "#64748b";

  // Smart suggestion: если услуг ещё нет И у объекта есть блоки,
  // предлагаем «Чистка кондиционера × acUnits» из каталога.
  const cleaningService = useMemo(
    () => catalog.find((s) => s.id === "svc-clean") ?? null,
    [catalog]
  );
  const suggestion = useMemo(() => {
    if (appointmentServices.length > 0) return null;
    if (acUnits <= 0 || !cleaningService) return null;
    return { service: cleaningService, qty: Math.min(acUnits, 10) };
  }, [appointmentServices.length, acUnits, cleaningService]);

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

  if (!open) return null;

  // ─── Handlers ─────────────────────────────────────────────────────

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
    const isReal = "locations" in client;
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
      client_id: isReal ? client.id : null,
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
      onClick={onClose}
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
            onClick={onClose}
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
        <div
          className="flex-1 min-h-0 overflow-y-auto pb-4"
          onPointerDownCapture={(e) => {
            // Accordion behaviour: any tap outside the time row +
            // picker collapses it. Capture phase so we react even when
            // the inner element stops propagation.
            if (!showTimeEditor && !showCityPicker) return;
            const area = timeAreaRef.current;
            if (area && !area.contains(e.target as Node)) {
              setShowTimeEditor(false);
              setShowCityPicker(false);
            }
          }}
        >
          <div ref={timeAreaRef}>
            <TimeBlock
              appointment={{
                ...appointment,
                time_start: timeStart,
                time_end: timeEnd,
                date: dateKey,
              }}
              cityLabel={city}
              cityColor={cityColor}
              teamLabel={teamLabel}
              readonly={readonly}
              onOpenTimeEditor={() => {
                setShowTimeEditor((v) => !v);
                setShowCityPicker(false);
              }}
              onOpenCityPicker={() => {
                setShowCityPicker((v) => !v);
                setShowTimeEditor(false);
              }}
            />

            {showTimeEditor && isEditable && (
              <CompactWheelPicker
                date={dateKey}
                timeStart={timeStart}
                timeEnd={timeEnd}
                onChange={({ date: d, timeStart: s, timeEnd: e }) => {
                  setDateKey(d);
                  setTimeStart(s);
                  setTimeEnd(e);
                }}
              />
            )}

            {showCityPicker && isEditable && (
              <CityPicker
                value={city}
                onPick={(c) => {
                  onCityChange(dateKey, c);
                  setShowCityPicker(false);
                }}
              />
            )}
          </div>

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

              <LocationPicker
                locations={clientLocations}
                selectedId={locationId}
                readonly={readonly}
                onSelect={setLocationId}
              />

              <AddressBlock address={address} />

              <ServicesBlock
                services={appointmentServices}
                globalDiscount={globalDiscount}
                catalog={catalog}
                readonly={readonly}
                onServicesChange={setAppointmentServices}
                onGlobalDiscountChange={setGlobalDiscount}
                onOpenPicker={() => setServicePickerOpen(true)}
              />

              {/* Smart suggestion — одна кнопка: применить Чистка × acUnits */}
              {isEditable && suggestion && (
                <div className="px-4 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      const s = suggestion.service;
                      const qty = suggestion.qty;
                      const ppu = pricePerUnit(s, qty);
                      setAppointmentServices([
                        {
                          serviceId: s.id,
                          quantity: qty,
                          pricePerUnit: ppu,
                          originalPrice: s.price,
                          totalPrice: qty * ppu,
                          duration: qty * s.duration_minutes,
                        },
                      ]);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left active:scale-[0.99]"
                    style={{
                      background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                    }}
                  >
                    <span className="text-white text-[16px]">✨</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-white/80">Рекомендуем</div>
                      <div className="text-[13px] font-semibold text-white truncate">
                        {suggestion.service.name} × {suggestion.qty}
                      </div>
                    </div>
                    <div className="text-[13px] font-bold text-white tabular-nums">
                      {formatEUR(
                        suggestion.qty *
                          pricePerUnit(suggestion.service, suggestion.qty)
                      )}
                    </div>
                  </button>
                </div>
              )}

              <CommentBlock
                value={comment}
                readonly={readonly}
                onChange={setComment}
              />

              {/* SMS toggle только в create */}
              {isEditable && client && "phone" in client && client.phone && (
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
                phone={client && "phone" in client ? client.phone : undefined}
                address={address}
              />
              {liveMode === "view" && (
                <PaymentBlock total={appointment.total_amount} onPay={handlePay} />
              )}
              <AdminActions
                canReschedule={liveMode === "view"}
                onEdit={() => setLiveMode("edit")}
                onReschedule={() => {
                  setLiveMode("edit");
                  setShowTimeEditor(true);
                }}
                onCancel={handleAdminCancel}
              />
            </>
          )}
        </div>

        {/* Sticky save: в create и в edit */}
        {isEditable && (
          <div
            className="flex-shrink-0 px-4 pt-2 border-t border-slate-200 flex gap-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)" }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-700 active:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canSave}
              className="flex-[2] h-12 rounded-xl bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.99] transition disabled:bg-slate-300 disabled:text-slate-500"
            >
              {(() => {
                if (!canSave) {
                  return isEventMode
                    ? "Введите название"
                    : "Выберите клиента и услугу";
                }
                if (liveMode === "edit") {
                  return `Сохранить · ${formatEUR(price)}`;
                }
                return isEventMode
                  ? "Создать событие"
                  : `Создать запись · ${formatEUR(price)}`;
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
          const locs = "locations" in c ? c.locations : [];
          const primary = locs.find((l) => l.isPrimary) ?? locs[0] ?? null;
          setLocationId(primary?.id ?? null);
          setClientSheet(false);
        }}
        clients={clients}
        draftClients={draftClients}
        recentClientIds={recentClientIds}
      />

      <CatalogPickerInline
        open={servicePickerOpen}
        onClose={() => setServicePickerOpen(false)}
        catalog={catalog}
        activeTeamId={activeTeam?.id ?? null}
        alreadyPickedIds={appointmentServices.map((s) => s.serviceId)}
        onPick={(svc) => {
          const line: AppointmentService = {
            serviceId: svc.id,
            quantity: 1,
            pricePerUnit: pricePerUnit(svc, 1),
            originalPrice: svc.price,
            totalPrice: svc.price,
            duration: svc.duration_minutes,
          };
          setAppointmentServices((prev) => [...prev, line]);
          setServicePickerOpen(false);
        }}
      />

      {/* Keep reference list silenced */}
      <div className="hidden">{CITY_LIST.length}</div>
    </div>
  );
}

// Catalog-based service picker. Filtered by brigade and by a search
// query (name/category). Already-picked rows show a ✓ mark so the
// dispatcher sees what's in the appointment at a glance.
function CatalogPickerInline({
  open,
  onClose,
  onPick,
  catalog,
  activeTeamId,
  alreadyPickedIds,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (svc: Service) => void;
  catalog: Service[];
  activeTeamId: string | null;
  alreadyPickedIds: string[];
}) {
  const [query, setQuery] = useState("");

  // Reset search every time the picker opens so a stale query from the
  // previous use doesn't hide every item on the second visit.
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const forBrigade = useMemo(
    () =>
      catalog.filter((s) => {
        if (!s.is_active) return false;
        if (s.brigade_ids.length === 0) return true;
        if (!activeTeamId) return true;
        return s.brigade_ids.includes(activeTeamId);
      }),
    [catalog, activeTeamId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forBrigade;
    return forBrigade.filter((s) => s.name.toLowerCase().includes(q));
  }, [forBrigade, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full lg:max-w-md bg-white rounded-t-3xl lg:rounded-3xl lg:mb-8 shadow-2xl pb-6 max-h-[85vh] flex flex-col"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex justify-center pt-2">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="flex-shrink-0 px-5 pt-3 pb-1 flex items-baseline justify-between gap-2">
          <div className="text-[17px] font-semibold text-slate-900">
            Выбрать услугу
          </div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {filtered.length} из {forBrigade.length}
          </div>
        </div>
        <div className="flex-shrink-0 px-3 pt-2 pb-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: чистка, установка, ремонт…"
            className="w-full h-11 px-3 rounded-xl bg-slate-100 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pt-1 space-y-2">
          {filtered.map((s) => {
            const picked = alreadyPickedIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onPick(s)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 active:scale-[0.99] ${
                  picked ? "border-violet-500 bg-violet-50" : "border-slate-200 bg-white"
                }`}
              >
                <div
                  className="w-1 h-10 rounded-full flex-shrink-0"
                  style={{ background: s.color }}
                />
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[15px] font-semibold text-slate-900 truncate flex items-center gap-1.5">
                    {picked && <span className="text-violet-600">✓</span>}
                    {s.name}
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {s.duration_minutes} мин/шт
                    {s.bulk_threshold > 0 &&
                      s.bulk_price > 0 &&
                      ` · от ${s.bulk_threshold}шт → ${s.bulk_price}€`}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[15px] font-bold text-slate-800 tabular-nums">
                    {formatEUR(s.price)}
                  </div>
                  <div className="text-[10px] text-slate-500">за шт</div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && forBrigade.length > 0 && (
            <div className="text-center py-6 text-[13px] text-slate-500">
              По запросу «{query}» ничего не нашли.
            </div>
          )}
          {forBrigade.length === 0 && (
            <div className="text-center py-6 text-[13px] text-slate-500">
              У этой бригады нет активных услуг.
              <br />
              <Link
                href="/dashboard/services"
                onClick={onClose}
                className="text-violet-600 font-semibold"
              >
                Открыть «Услуги» →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

