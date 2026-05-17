"use client";

/**
 * AppointmentWorkBody — the scroll-body branch rendered when the
 * sheet is in work-record mode (kind === "work"). Hosts every block
 * the dispatcher fills in for a client visit:
 *
 *   Client → ClientHistoryStrip → Locations → Services → Income →
 *   <details>Подробнее{Source, SMS-toggle, Comment, Photos}</details>
 *   → readonly cancel reason → cancel toggle
 *
 * Lifted out of AppointmentSheet (Sprint #4 §9 step 8, v629). State
 * stays in AppointmentSheet; this component only renders and forwards
 * callbacks.
 */

import type { ReactNode, MutableRefObject } from "react";
import type {
  Appointment,
  AppointmentService,
  AppointmentSource,
  Discount,
} from "@babun/shared/local/appointments";
import type { AppointmentPhotoRecord } from "@babun/shared/db/repositories/appointment-photos";
import type { Client, Location } from "@babun/shared/local/clients";
import type { Service } from "@babun/shared/local/services";
import { IOSSwitch } from "@/components/ui";

import ClientBlock from "./ClientBlock";
import ClientHistoryStrip from "./ClientHistoryStrip";
import LocationsBlock from "./LocationsBlock";
import ServicesBlock from "./ServicesBlock";
import IncomeBlock from "./IncomeBlock";
import CommentBlock from "./CommentBlock";
import PhotoBlock from "./PhotoBlock";
import SourceBlock from "./SourceBlock";
import CancelToggleBlock from "./CancelToggleBlock";
import type { AppointmentSheetMode } from "./AppointmentSheet";

interface AppointmentWorkBodyProps {
  // Mode / readonly flags
  liveMode: AppointmentSheetMode;
  isEditable: boolean;
  readonly: boolean;

  // Client
  client: Client | null;
  recentClientsResolved: Client[];
  setClientId: (id: string | null) => void;
  setLocationId: (id: string | null) => void;
  setClientSheet: (open: boolean) => void;
  setClientMenuOpen: (open: boolean) => void;

  // Client history strip
  appointment: Appointment;
  otherApts: Appointment[];
  catalog: Service[];

  // Location
  locationId: string | null;
  addressNote: string;
  setAddressNote: (next: string) => void;
  anonymousAddress: string;
  setAnonymousAddress: (next: string) => void;
  addressPlaceholder: string;
  selectedLocation: Location | null;

  // Services / Income
  appointmentServices: AppointmentService[];
  globalDiscount: Discount | null;
  popularServices: Service[];
  setAppointmentServices: (next: AppointmentService[]) => void;
  setGlobalDiscount: (next: Discount | null) => void;
  setAskClientFirst: (open: boolean) => void;
  setServicePickerOpen: (open: boolean) => void;
  clientId: string | null;

  // Подробнее: source / sms / comment / photos
  source: AppointmentSource | null;
  setSource: (next: AppointmentSource | null) => void;
  lastUsedSource: AppointmentSource | null;
  setLastUsedSource: (next: AppointmentSource | null) => void;
  smsEnabled: boolean;
  setSmsEnabled: (next: boolean) => void;
  comment: string;
  setComment: (next: string) => void;
  photos: AppointmentPhotoRecord[];
  setPhotos: (next: AppointmentPhotoRecord[]) => void;
  tenantId: string;
  photoScrollRef: MutableRefObject<HTMLDivElement | null>;

  // Cancel toggle
  cancelFlag: boolean;
  setCancelFlag: (next: boolean) => void;
  cancelReason: string;
  setCancelReason: (next: string) => void;

  // PaymentBlock or other view-mode-only blocks slot via children.
  viewBlocks?: ReactNode;
}

export default function AppointmentWorkBody({
  liveMode,
  isEditable,
  readonly,
  client,
  recentClientsResolved,
  setClientId,
  setLocationId,
  setClientSheet,
  setClientMenuOpen,
  appointment,
  otherApts,
  catalog,
  locationId,
  addressNote,
  setAddressNote,
  anonymousAddress,
  setAnonymousAddress,
  addressPlaceholder,
  appointmentServices,
  globalDiscount,
  popularServices,
  setAppointmentServices,
  setGlobalDiscount,
  setAskClientFirst,
  setServicePickerOpen,
  clientId,
  source,
  setSource,
  lastUsedSource,
  setLastUsedSource,
  smsEnabled,
  setSmsEnabled,
  comment,
  setComment,
  photos,
  setPhotos,
  tenantId,
  photoScrollRef,
  selectedLocation,
  cancelFlag,
  setCancelFlag,
  cancelReason,
  setCancelReason,
  viewBlocks,
}: AppointmentWorkBodyProps) {
  return (
    <>
      {/* v607 P0 #1 — block order: critical inputs up top, details
          collapsed. Order: Client → History → Location → Services →
          Income → <details>. */}
      <ClientBlock
        client={client}
        readonly={readonly}
        onPick={() => setClientSheet(true)}
        onChange={() => setClientId(null)}
        onMenu={client ? () => setClientMenuOpen(true) : undefined}
        recentClients={recentClientsResolved}
        onPickRecent={(c) => {
          setClientId(c.id);
          const locs = c.locations ?? [];
          const primary = locs.find((l) => l.isPrimary) ?? locs[0] ?? null;
          setLocationId(primary?.id ?? null);
        }}
      />

      {/* Brief 1 #23 — last 5 past visits inline so dispatcher sees
          prior work without leaving the sheet. */}
      {client && (
        <ClientHistoryStrip
          clientId={client.id}
          excludeAppointmentId={appointment.id}
          appointments={otherApts}
          catalog={catalog}
        />
      )}

      <LocationsBlock
        client={client}
        selectedLocationId={locationId}
        readOnly={readonly}
        addressNote={addressNote}
        onSelectLocation={setLocationId}
        onAddressNoteChange={setAddressNote}
        anonymousAddress={anonymousAddress}
        onAnonymousAddressChange={setAnonymousAddress}
        placeholder={addressPlaceholder}
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
        popularServices={popularServices}
      />

      <IncomeBlock
        services={appointmentServices}
        globalDiscount={globalDiscount}
        catalog={catalog}
        readonly={readonly}
        onServicesChange={setAppointmentServices}
        onGlobalDiscountChange={setGlobalDiscount}
      />

      {/* v607 P0 #1 — «Подробнее» collapsible. Closed by default in
          create; opened in edit so existing data stays visible. */}
      {isEditable ? (
        <details className="group px-4 pt-3" open={liveMode === "edit"}>
          <summary className="flex items-center justify-between cursor-pointer list-none px-3 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[13px] font-semibold text-[var(--label)]">
            <span>Подробнее</span>
            <span className="text-[var(--label-secondary)] text-[12px] group-open:rotate-180 transition">▾</span>
          </summary>
          <div className="pt-1 -mx-4">
            <SourceBlock
              value={source}
              readonly={readonly}
              onChange={(next) => {
                setSource(next);
                if (next && typeof window !== "undefined") {
                  window.localStorage.setItem("babun.lastSource", next);
                  setLastUsedSource(next);
                }
              }}
              lastUsed={lastUsedSource}
            />

            {client && client.phone && (
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

            <CommentBlock value={comment} readonly={readonly} onChange={setComment} />

            <div ref={photoScrollRef}>
              <PhotoBlock
                photos={photos}
                readonly={readonly}
                tenantId={tenantId}
                appointmentId={appointment.id}
                locationLabel={selectedLocation?.label}
                onChange={setPhotos}
              />
            </div>
          </div>
        </details>
      ) : (
        <>
          <SourceBlock value={source} readonly={readonly} onChange={setSource} />
          <CommentBlock value={comment} readonly={readonly} onChange={setComment} />
          <div ref={photoScrollRef}>
            <PhotoBlock
              photos={photos}
              readonly={readonly}
              tenantId={tenantId}
              appointmentId={appointment.id}
              locationLabel={selectedLocation?.label}
              onChange={setPhotos}
            />
          </div>
        </>
      )}

      {/* Readonly cancellation reason in view/done mode when the
          record is already cancelled. */}
      {!isEditable && appointment.status === "cancelled" && (
        <div className="px-4 pt-3">
          <div className="px-3 py-2 rounded-[14px] bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.2)] text-[13px] text-[var(--label)]">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--system-red)] mb-0.5">
              Запись отменена
            </div>
            <div>{appointment.cancel_reason?.trim() || "Причина не указана"}</div>
          </div>
        </div>
      )}

      {/* Cancel-appointment toggle. Only in edit mode for an
          existing-and-not-completed record. */}
      {appointment.status !== "completed" && liveMode === "edit" && (
        <CancelToggleBlock
          cancelFlag={cancelFlag}
          cancelReason={cancelReason}
          onFlagChange={setCancelFlag}
          onReasonChange={setCancelReason}
        />
      )}

      {viewBlocks}
    </>
  );
}
