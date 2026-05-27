"use client";

/**
 * AppointmentWorkBody — the scroll-body branch rendered when the
 * sheet is in work-record mode (kind === "work"). Hosts every block
 * the dispatcher fills in for a client visit:
 *
 *   Client(card+stats) → Locations(always) → Services(+Итого footer) →
 *   Payment → Comment → Photo → Reschedule → CancelToggle
 *
 * Source / SMS toggle removed (form-cleanup task).
 * ClientHistoryStrip removed; replaced by the stats row in ClientBlock.
 * PhotoBlock moved out of the former <details> accordion.
 *
 * Lifted out of AppointmentSheet (Sprint #4 §9 step 8, v629). State
 * stays in AppointmentSheet; this component only renders and forwards
 * callbacks.
 */

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

import ClientBlock from "./ClientBlock";
import LocationsBlock from "./LocationsBlock";
import ServicesBlock from "./ServicesBlock";
import PaymentBlock from "./PaymentBlock";
import CommentBlock from "./CommentBlock";
import PhotoBlock from "./PhotoBlock";
import CancelToggleBlock from "./CancelToggleBlock";
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
  /** Stats row for the filled ClientBlock card. Optional — omit when no client. */
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

  /** Payment block appears only AFTER creation (existing records). */
  showPayment: boolean;
  paymentTotal: number;
  onPay: (payment: AppointmentPayment) => void;
  /** Reschedule action for existing scheduled records. */
  onReschedule?: () => void;
}

export default function AppointmentWorkBody({
  liveMode,
  readonly,
  client,
  recentClientsResolved,
  clientTags,
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
  selectedLocation,
  cancelFlag,
  setCancelFlag,
  cancelReason,
  setCancelReason,
  showPayment,
  paymentTotal,
  onPay,
  onReschedule,
}: AppointmentWorkBodyProps) {
  return (
    <>
      {/* Block 1: Client card + stats row */}
      <ClientBlock
        client={client}
        readonly={readonly}
        stats={clientStats}
        onPick={() => {
          setClientSheetCreate(false);
          setClientSheet(true);
        }}
        onChange={() => setClientId(null)}
        onMenu={client ? () => setClientMenuOpen(true) : undefined}
        recentClients={recentClientsResolved}
        tags={clientTags}
        onPickRecent={(c) => {
          setClientId(c.id);
          const locs = c.locations ?? [];
          const primary = locs.find((l) => l.isPrimary) ?? locs[0] ?? null;
          setLocationId(primary?.id ?? null);
          // v701 — mirror the v696 prefill in the recent-chip path.
          // Only fire when the comment is currently empty.
          const locationNote = primary?.note?.trim();
          if (locationNote && !comment.trim()) {
            setComment(locationNote);
          }
        }}
      />

      {/* Block 2: Locations — always visible; intercepts add-tap when no
          client is selected and shows the «выберите клиента» prompt. */}
      <LocationsBlock
        client={client}
        selectedLocationId={locationId}
        readOnly={readonly}
        addressNote={addressNote}
        onSelectLocation={setLocationId}
        onAddressNoteChange={setAddressNote}
        placeholder={addressPlaceholder}
        onRequireClient={() => setAskClientFirst(true)}
      />

      {/* Block 3: Services + Итого footer (income popup lives inside ServicesBlock) */}
      <ServicesBlock
        services={appointmentServices}
        globalDiscount={globalDiscount}
        catalog={catalog}
        readonly={readonly}
        onServicesChange={setAppointmentServices}
        onGlobalDiscountChange={setGlobalDiscount}
        onOpenPicker={() => {
          if (!clientId) {
            setAskClientFirst(true);
            return;
          }
          setServicePickerOpen(true);
        }}
      />

      {/* Block 4: Payment — only for existing records (after creation). */}
      {showPayment && <PaymentBlock total={paymentTotal} onPay={onPay} />}

      {/* Block 5: Appointment note (per-visit brigade comment). */}
      <CommentBlock value={comment} readonly={readonly} onChange={setComment} />

      {/* Block 6: Photos — standalone, no accordion wrapper. */}
      <div ref={photoScrollRef}>
        <PhotoBlock
          photos={photos}
          readonly={readonly}
          tenantId={tenantId}
          appointmentId={appointment.id}
          locationLabel={selectedLocation?.label}
          onChange={setPhotos}
          canUpload={liveMode !== "create"}
        />
      </div>

      {/* Block 7: Reschedule — for existing scheduled records. */}
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

      {/* Block 8: Cancel toggle — for existing non-completed records. */}
      {liveMode !== "create" && appointment.status !== "completed" && (
        <CancelToggleBlock
          cancelFlag={cancelFlag}
          cancelReason={cancelReason}
          onFlagChange={setCancelFlag}
          onReasonChange={setCancelReason}
        />
      )}
    </>
  );
}
