"use client";

/**
 * AppointmentWorkBody — scroll-body branch for work-record mode.
 *
 * Renders ONE unified card with divide-y rows (Client / Object / Services /
 * Note / Photo) and extra rows at the bottom for Payment / Reschedule /
 * Cancel. All editing happens through centered popups — no inline inputs
 * inside the form body.
 */

import { useMemo, useState } from "react";
import type { MutableRefObject } from "react";
import type {
  Appointment,
  AppointmentPayment,
  AppointmentService,
  Discount,
} from "@babun/shared/local/appointments";
import type { AppointmentPhotoRecord } from "@babun/shared/db/repositories/appointment-photos";
import type { Client, ClientTag, Location } from "@babun/shared/local/clients";
import type { Service } from "@babun/shared/local/services";
import { CalendarClock, Navigation, Camera, Tag } from "@babun/shared/icons";
import {
  appointmentTotal,
  globalDiscountAmount,
  lineTotal,
  subtotal,
  totalDuration,
} from "@babun/shared/local/finance/appointment-calc";
import { formatEUR } from "@babun/shared/common/utils/money";
import { formatShortDate } from "./ClientHistoryStrip";

import AppointmentRow from "./AppointmentRow";
import NotePopup from "./NotePopup";
import PhotoPopup from "./PhotoPopup";
import PaymentBlock from "./PaymentBlock";
import CancelToggleBlock from "./CancelToggleBlock";
import IncomePopup from "./IncomePopup";
import MapNavPopup from "./MapNavPopup";
import LocationsBlock from "./LocationsBlock";
import type { AppointmentSheetMode } from "./AppointmentSheet";

interface ClientStats {
  visits: number;
  earned: number;
  lastVisitDate: string | null;
}

interface AppointmentWorkBodyProps {
  liveMode: AppointmentSheetMode;
  readonly: boolean;

  client: Client | null;
  recentClientsResolved: Client[];
  clientTags: ClientTag[];
  clientStats?: ClientStats;
  setClientId: (id: string | null) => void;
  setLocationId: (id: string | null) => void;
  setClientSheet: (open: boolean) => void;
  setClientSheetCreate: (open: boolean) => void;
  setClientMenuOpen: (open: boolean) => void;

  appointment: Appointment;
  catalog: Service[];

  locationId: string | null;
  addressNote: string;
  setAddressNote: (next: string) => void;
  addressPlaceholder: string;
  selectedLocation: Location | null;

  appointmentServices: AppointmentService[];
  globalDiscount: Discount | null;
  setAppointmentServices: (next: AppointmentService[]) => void;
  setGlobalDiscount: React.Dispatch<React.SetStateAction<Discount | null>>;
  setAskClientFirst: (open: boolean) => void;
  setServicePickerOpen: (open: boolean) => void;
  clientId: string | null;

  comment: string;
  setComment: (next: string) => void;
  photos: AppointmentPhotoRecord[];
  setPhotos: (next: AppointmentPhotoRecord[]) => void;
  tenantId: string;
  photoScrollRef: MutableRefObject<HTMLDivElement | null>;

  cancelFlag: boolean;
  setCancelFlag: (next: boolean) => void;
  cancelReason: string;
  setCancelReason: (next: string) => void;

  showPayment: boolean;
  paymentTotal: number;
  onPay: (payment: AppointmentPayment) => void;
  onReschedule?: () => void;
}

export default function AppointmentWorkBody({
  liveMode,
  readonly,
  client,
  clientStats,
  setClientId,
  setLocationId,
  setClientSheet,
  setClientSheetCreate,
  setClientMenuOpen,
  appointment,
  catalog,
  locationId,
  addressNote,
  setAddressNote,
  addressPlaceholder,
  selectedLocation,
  appointmentServices,
  globalDiscount,
  setAppointmentServices,
  setGlobalDiscount,
  setAskClientFirst,
  setServicePickerOpen,
  clientId,
  comment,
  setComment,
  photos,
  setPhotos,
  tenantId,
  photoScrollRef,
  cancelFlag,
  setCancelFlag,
  cancelReason,
  setCancelReason,
  showPayment,
  paymentTotal,
  onPay,
  onReschedule,
}: AppointmentWorkBodyProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [photoPopupOpen, setPhotoPopupOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  // When true, LocationsBlock is rendered (hidden) so its editor popup fires.
  const [locationEditorTrigger, setLocationEditorTrigger] = useState(false);

  // Service catalog map
  const byId = useMemo(() => {
    const m = new Map<string, Service>();
    for (const s of catalog) m.set(s.id, s);
    return m;
  }, [catalog]);

  // --- Client section ---
  const clientName = client?.full_name ?? null;
  const clientPhone = client?.phone ?? null;

  const clientSub = (() => {
    if (!clientStats || clientStats.visits === 0) {
      return client ? "ещё не обслуживался" : undefined;
    }
    const n = clientStats.visits;
    const n100 = n % 100;
    const n10 = n % 10;
    const word =
      n100 >= 11 && n100 <= 19
        ? "визитов"
        : n10 === 1
          ? "визит"
          : n10 >= 2 && n10 <= 4
            ? "визита"
            : "визитов";
    const datePart = clientStats.lastVisitDate
      ? ` · был ${formatShortDate(clientStats.lastVisitDate)}`
      : "";
    return `${n} ${word} · ${formatEUR(clientStats.earned)}${datePart}`;
  })();

  const openClientPicker = () => {
    setClientSheetCreate(false);
    setClientSheet(true);
  };

  // --- Location section ---
  const navInput = selectedLocation?.mapUrl || selectedLocation?.address || "";
  const locationValue =
    selectedLocation?.address ||
    (selectedLocation?.mapUrl ? "Google Maps ссылка" : null);
  const locationSub = selectedLocation?.note?.trim() || undefined;
  const hasNav = Boolean(navInput);

  const openLocationEditor = () => {
    if (!client) {
      setAskClientFirst(true);
      return;
    }
    // Trigger the hidden LocationsBlock to open its editor.
    setLocationEditorTrigger(true);
  };

  // --- Services section ---
  const serviceCount = appointmentServices.length;
  const subTotal = subtotal(appointmentServices);
  const discAmt = globalDiscountAmount(appointmentServices, globalDiscount);
  const grandTotal = appointmentTotal(appointmentServices, globalDiscount);
  const dur = totalDuration(appointmentServices);

  const removeService = (idx: number) => {
    setAppointmentServices(appointmentServices.filter((_, i) => i !== idx));
  };

  const openServicePicker = () => {
    if (!clientId) {
      setAskClientFirst(true);
      return;
    }
    setServicePickerOpen(true);
  };

  // --- Photo section ---
  const photoCount = photos.length;
  const canUpload = liveMode !== "create";

  return (
    <div className="px-4 pt-3 pb-4">
      {/* ─── Unified card ─────────────────────────────────────────── */}
      <div className="rounded-[14px] border border-[var(--separator)] shadow-[var(--shadow-card)] bg-[var(--surface-card)] overflow-hidden divide-y divide-[var(--separator)]">

        {/* ── КЛИЕНТ ────────────────────────────────────────────── */}
        {(!readonly || client) && (
          <AppointmentRow
            label="КЛИЕНТ"
            value={clientName ?? "Выбрать клиента"}
            accent={!clientName}
            sub={clientSub}
            onTap={readonly ? undefined : openClientPicker}
            showChevron={!clientName && !readonly}
            rightAccessory={
              client ? (
                <div className="flex items-center gap-0.5">
                  {clientPhone && (
                    <a
                      href={`tel:${clientPhone.replace(/\D/g, "")}`}
                      aria-label="Позвонить"
                      onClick={(e) => e.stopPropagation()}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--system-green)] active:bg-[rgba(52,199,89,0.1)]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                      </svg>
                    </a>
                  )}
                  {!readonly && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClientMenuOpen(true);
                      }}
                      aria-label="Меню клиента"
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="5" cy="12" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="19" cy="12" r="2" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : undefined
            }
          />
        )}

        {/* ── ОБЪЕКТ ────────────────────────────────────────────── */}
        <AppointmentRow
          label="ОБЪЕКТ"
          value={
            locationValue ??
            (readonly ? "Не указан" : "Добавить объект")
          }
          accent={!locationValue && !readonly}
          sub={locationSub}
          onTap={readonly ? undefined : openLocationEditor}
          showChevron={!readonly}
          rightAccessory={
            hasNav && !readonly ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNavOpen(true);
                }}
                aria-label="Навигация"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--accent)] active:bg-[var(--accent-tint)]"
              >
                <Navigation size={16} strokeWidth={2} />
              </button>
            ) : undefined
          }
        />

        {/* ── УСЛУГИ ────────────────────────────────────────────── */}
        {serviceCount === 0 ? (
          <AppointmentRow
            label="УСЛУГИ"
            value={readonly ? "Не указаны" : "Выбрать услугу"}
            accent={!readonly}
            onTap={readonly ? undefined : openServicePicker}
          />
        ) : (
          <div className="px-4 pt-3 pb-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--label-tertiary)] mb-1.5">
              УСЛУГИ
            </div>
            {/* Service rows */}
            <div className="rounded-[10px] border border-[var(--separator)] overflow-hidden divide-y divide-[var(--separator)]">
              {appointmentServices.map((line, idx) => {
                const svc = byId.get(line.serviceId) ?? null;
                const lt = lineTotal(line);
                return (
                  <div
                    key={`${line.serviceId}-${idx}`}
                    role={readonly ? undefined : "button"}
                    tabIndex={readonly ? -1 : 0}
                    onClick={readonly ? undefined : openServicePicker}
                    onKeyDown={(e) => {
                      if (readonly) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openServicePicker();
                      }
                    }}
                    className="flex items-center gap-2 px-3 h-12 bg-[var(--surface-card)] active:bg-[var(--fill-quaternary)] transition"
                  >
                    <span className="flex-shrink-0 w-7 text-center text-[13px] font-bold text-[var(--accent)] tabular-nums">
                      ×{line.quantity}
                    </span>
                    <span className="flex-1 min-w-0 text-[15px] font-medium text-[var(--label)] truncate">
                      {svc?.name ?? "Услуга"}
                    </span>
                    <span className="flex-shrink-0 text-[14px] font-bold text-[var(--label)] tabular-nums">
                      {formatEUR(lt)}
                    </span>
                    {!readonly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeService(idx);
                        }}
                        aria-label="Убрать"
                        className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-tertiary)] active:text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
              {!readonly && (
                <button
                  type="button"
                  onClick={openServicePicker}
                  className="w-full flex items-center gap-2 px-3 h-10 text-left text-[14px] font-semibold text-[var(--accent)] bg-[var(--surface-card)] active:bg-[var(--fill-quaternary)] transition"
                >
                  <span className="flex-1">Выбрать ещё услугу</span>
                  <span className="text-[16px] leading-none">+</span>
                </button>
              )}
            </div>

            {/* Итого sub-row */}
            <div
              role={!readonly ? "button" : undefined}
              tabIndex={!readonly ? 0 : -1}
              onClick={!readonly ? () => setIncomeOpen(true) : undefined}
              onKeyDown={(e) => {
                if (readonly) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setIncomeOpen(true);
                }
              }}
              aria-label={!readonly ? "Редактировать цены и скидку" : undefined}
              className={`mt-2 px-3 py-2 rounded-[10px] bg-[var(--fill-quaternary)] ${
                !readonly ? "active:bg-[var(--fill-tertiary)] cursor-pointer" : ""
              }`}
            >
              {discAmt > 0 && (
                <>
                  <div className="flex items-center justify-between text-[11px] text-[var(--label-secondary)]">
                    <span>Подытог ({serviceCount} усл.)</span>
                    <span className="tabular-nums">{formatEUR(subTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--system-red)] font-semibold mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Tag size={11} strokeWidth={2} />
                      {globalDiscount?.type === "percent"
                        ? `−${globalDiscount.value}%`
                        : "Скидка"}
                      {globalDiscount?.reason && ` · ${globalDiscount.reason}`}
                    </span>
                    <span className="tabular-nums">−{formatEUR(discAmt)}</span>
                  </div>
                  <div className="h-px bg-[var(--separator)] my-1" />
                </>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold text-[var(--label)]">
                    Итого {formatEUR(grandTotal)}
                  </span>
                  <span className="text-[11px] text-[var(--label-secondary)] tabular-nums">
                    · {dur} мин
                  </span>
                </div>
                {!readonly && (
                  <span className="text-[var(--label-quaternary)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ЗАМЕТКА К ЗАПИСИ ──────────────────────────────────── */}
        <AppointmentRow
          label="ЗАМЕТКА К ЗАПИСИ"
          value={
            comment.trim()
              ? comment.split("\n")[0]!.slice(0, 80) +
                (comment.length > 80 ? "…" : "")
              : readonly
                ? "Нет заметки"
                : "Добавить заметку"
          }
          accent={!comment.trim() && !readonly}
          onTap={readonly ? undefined : () => setNoteOpen(true)}
        />

        {/* ── ФОТО ──────────────────────────────────────────────── */}
        {(!readonly || photoCount > 0) && (
          <div ref={photoScrollRef}>
            <AppointmentRow
              label="ФОТО"
              value={
                photoCount > 0
                  ? `${photoCount} фото`
                  : canUpload
                    ? "Добавить фото"
                    : "Добавить фото"
              }
              accent={photoCount === 0 && canUpload}
              hint={
                !canUpload && photoCount === 0
                  ? "Сохраните запись для добавления фото"
                  : undefined
              }
              onTap={canUpload || photoCount > 0 ? () => setPhotoPopupOpen(true) : undefined}
              showChevron={canUpload || photoCount > 0}
              rightAccessory={
                photoCount > 0 ? (
                  <span className="text-[12px] font-semibold text-[var(--label-secondary)] tabular-nums">
                    {photoCount} шт
                  </span>
                ) : (
                  <Camera size={16} strokeWidth={2} className="text-[var(--label-tertiary)]" />
                )
              }
            />
          </div>
        )}

        {/* ── ОПЛАТА ────────────────────────────────────────────── */}
        {showPayment && <PaymentBlock total={paymentTotal} onPay={onPay} />}
      </div>

      {/* ── ПЕРЕНЕСТИ — outside the card ───────────────────────────── */}
      {liveMode !== "create" &&
        appointment.status === "scheduled" &&
        onReschedule && (
          <div className="pt-3">
            <button
              type="button"
              onClick={onReschedule}
              className="w-full h-11 flex items-center justify-center gap-2 rounded-[14px] bg-[var(--surface-card)] border border-[var(--separator)] text-[15px] font-semibold text-[var(--system-orange)] active:bg-[var(--fill-quaternary)]"
            >
              <CalendarClock size={18} strokeWidth={2} />
              Перенести
            </button>
          </div>
        )}

      {/* ── ОТМЕНИТЬ ───────────────────────────────────────────────── */}
      {liveMode !== "create" && appointment.status !== "completed" && (
        <div className="pt-3">
          <CancelToggleBlock
            cancelFlag={cancelFlag}
            cancelReason={cancelReason}
            onFlagChange={setCancelFlag}
            onReasonChange={setCancelReason}
          />
        </div>
      )}

      {/* ─── Sub-popups ────────────────────────────────────────────── */}

      {/* Location editor — rendered headless so LocationsBlock manages
          all save-to-client logic internally. The div is zero-height,
          completely invisible; only its popup (z-[90]) is visible. */}
      {locationEditorTrigger && (
        <div className="h-0 overflow-hidden">
          <LocationsBlock
            client={client}
            selectedLocationId={locationId}
            readOnly={false}
            addressNote={addressNote}
            onSelectLocation={setLocationId}
            onAddressNoteChange={setAddressNote}
            placeholder={addressPlaceholder}
            onRequireClient={() => setAskClientFirst(true)}
          />
        </div>
      )}

      {/* Note popup */}
      <NotePopup
        open={noteOpen}
        value={comment}
        onSave={setComment}
        onClose={() => setNoteOpen(false)}
      />

      {/* Photo popup */}
      <PhotoPopup
        open={photoPopupOpen}
        photos={photos}
        readonly={readonly}
        tenantId={tenantId}
        appointmentId={appointment.id}
        locationLabel={selectedLocation?.label}
        onChange={setPhotos}
        onClose={() => setPhotoPopupOpen(false)}
      />

      {/* Income popup */}
      {incomeOpen && (
        <IncomePopup
          services={appointmentServices}
          byId={byId}
          globalDiscount={globalDiscount}
          onServicesChange={setAppointmentServices}
          onGlobalDiscountChange={setGlobalDiscount}
          onClose={() => setIncomeOpen(false)}
        />
      )}

      {/* Map nav popup */}
      <MapNavPopup
        open={navOpen}
        onClose={() => setNavOpen(false)}
        input={navInput}
      />
    </div>
  );
}
