"use client";

/**
 * AppointmentWorkBody — scroll-body branch for work-record mode.
 *
 * Each section is its own separate bordered card with fixed min-h-[76px]
 * so the layout never shifts when content changes. Detail editing
 * happens through centered popups — no inline inputs inside the form body.
 *
 * Card order: КЛИЕНТ → ОБЪЕКТ → УСЛУГИ → ДОХОД → НАВИГАЦИЯ →
 *             ЗАМЕТКА → ФОТО → (ОПЛАТА / ПЕРЕНЕСТИ / ОТМЕНА for existing)
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
import { CalendarClock } from "@babun/shared/icons";
import {
  appointmentTotal,
  totalDuration,
} from "@babun/shared/local/finance/appointment-calc";
import { formatEUR } from "@babun/shared/common/utils/money";
import { formatShortDate } from "./ClientHistoryStrip";

import NotePopup from "./NotePopup";
import PhotoPopup from "./PhotoPopup";
import PaymentBlock from "./PaymentBlock";
import CancelToggleBlock from "./CancelToggleBlock";
import IncomePopup from "./IncomePopup";
import MapNavPopup from "./MapNavPopup";
import LocationsBlock from "./LocationsBlock";
import ClientCard from "./ClientCard";
import ObjectCard from "./ObjectCard";
import ServicesCard from "./ServicesCard";
import IncomeCard from "./IncomeCard";
import NavigationCard from "./NavigationCard";
import NoteCard from "./NoteCard";
import PhotoCard from "./PhotoCard";
import SectionGroup from "./SectionGroup";
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
  setClientId: _setClientId,
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
  // Rendered headless so its editor popup fires on demand.
  const [locationEditorTrigger, setLocationEditorTrigger] = useState(false);

  const byId = useMemo(() => {
    const m = new Map<string, Service>();
    for (const s of catalog) m.set(s.id, s);
    return m;
  }, [catalog]);

  // ── Client ───────────────────────────────────────────────────────
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
        : n10 === 1 ? "визит"
        : n10 >= 2 && n10 <= 4 ? "визита"
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

  // ── Location ─────────────────────────────────────────────────────
  const navInput = selectedLocation?.mapUrl || selectedLocation?.address || "";
  const locationValue =
    selectedLocation?.address ||
    (selectedLocation?.mapUrl ? "Google Maps ссылка" : null);
  const locationSub = selectedLocation?.note?.trim() || undefined;
  const hasNav = Boolean(navInput);

  const openLocationEditor = () => {
    if (!client) { setAskClientFirst(true); return; }
    setLocationEditorTrigger(true);
  };

  // ── Services ─────────────────────────────────────────────────────
  const serviceCount = appointmentServices.length;
  const firstServiceName =
    serviceCount > 0
      ? (byId.get(appointmentServices[0]!.serviceId)?.name ?? undefined)
      : undefined;

  const openServicePicker = () => {
    if (!clientId) { setAskClientFirst(true); return; }
    setServicePickerOpen(true);
  };

  // ── Income ───────────────────────────────────────────────────────
  const grandTotal = appointmentTotal(appointmentServices, globalDiscount);
  const dur = totalDuration(appointmentServices);

  // ── Photos ───────────────────────────────────────────────────────
  const photoCount = photos.length;
  const canUpload = liveMode !== "create";

  return (
    <div className="pb-4">
      {(!readonly || client) && (
        <SectionGroup>
          <ClientCard
            readonly={readonly}
            clientName={clientName}
            clientPhone={clientPhone}
            clientSub={clientSub}
            onTap={openClientPicker}
            onMenuOpen={() => setClientMenuOpen(true)}
          />
        </SectionGroup>
      )}

      <SectionGroup>
        <ObjectCard
          readonly={readonly}
          locationValue={locationValue}
          locationSub={locationSub}
          onTap={openLocationEditor}
        />
        <NavigationCard
          hasAddress={hasNav}
          onTap={() => setNavOpen(true)}
        />
      </SectionGroup>

      <SectionGroup>
        <ServicesCard
          readonly={readonly}
          serviceCount={serviceCount}
          firstServiceName={firstServiceName}
          onTap={openServicePicker}
        />
        <IncomeCard
          readonly={readonly}
          total={grandTotal}
          durationMinutes={dur}
          hasServices={serviceCount > 0}
          onTap={() => setIncomeOpen(true)}
        />
      </SectionGroup>

      <SectionGroup>
        <NoteCard
          readonly={readonly}
          comment={comment}
          onTap={() => setNoteOpen(true)}
        />
        <div ref={photoScrollRef}>
          <PhotoCard
            photoCount={photoCount}
            canUpload={canUpload}
            onTap={() => setPhotoPopupOpen(true)}
          />
        </div>
      </SectionGroup>

      {/* ОПЛАТА — existing records only */}
      {showPayment && (
        <div className="px-4 pt-3">
          <div className="rounded-[14px] border border-[var(--separator)] bg-[var(--surface-card)] shadow-[var(--shadow-card)] overflow-hidden">
            <PaymentBlock total={paymentTotal} onPay={onPay} />
          </div>
        </div>
      )}

      {/* ПЕРЕНЕСТИ */}
      {liveMode !== "create" &&
        appointment.status === "scheduled" &&
        onReschedule && (
          <div className="px-4 pt-3">
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

      {/* ОТМЕНИТЬ */}
      {liveMode !== "create" && appointment.status !== "completed" && (
        <div className="px-4 pt-3">
          <CancelToggleBlock
            cancelFlag={cancelFlag}
            cancelReason={cancelReason}
            onFlagChange={setCancelFlag}
            onReasonChange={setCancelReason}
          />
        </div>
      )}

      {/* Location editor — headless mount so LocationsBlock manages
          its own popup (z-[90]). Zero-height div stays invisible. */}
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

      <NotePopup
        open={noteOpen}
        value={comment}
        onSave={setComment}
        onClose={() => setNoteOpen(false)}
      />

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

      <MapNavPopup
        open={navOpen}
        onClose={() => setNavOpen(false)}
        input={navInput}
      />
    </div>
  );
}
