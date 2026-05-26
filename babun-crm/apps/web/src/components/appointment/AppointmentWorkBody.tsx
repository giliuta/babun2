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

import type { MutableRefObject } from "react";
import type {
  Appointment,
  AppointmentPayment,
  AppointmentService,
  AppointmentSource,
  Discount,
} from "@babun/shared/local/appointments";
import type { AppointmentPhotoRecord } from "@babun/shared/db/repositories/appointment-photos";
import type { Client, ClientTag, Location } from "@babun/shared/local/clients";
import type { Service } from "@babun/shared/local/services";
import { IOSSwitch } from "@/components/ui";
import { CalendarClock } from "@babun/shared/icons";

import ClientBlock from "./ClientBlock";
import ClientHistoryStrip from "./ClientHistoryStrip";
import LocationsBlock from "./LocationsBlock";
import ServicesBlock from "./ServicesBlock";
import IncomeBlock from "./IncomeBlock";
import PaymentBlock from "./PaymentBlock";
import CommentBlock from "./CommentBlock";
import PhotoBlock from "./PhotoBlock";
import SourceBlock from "./SourceBlock";
import CancelToggleBlock from "./CancelToggleBlock";
import type { AppointmentSheetMode } from "./AppointmentSheet";

interface AppointmentWorkBodyProps {
  liveMode: AppointmentSheetMode;
  readonly: boolean;

  client: Client | null;
  recentClientsResolved: Client[];
  clientTags: ClientTag[];
  setClientId: (id: string | null) => void;
  setLocationId: (id: string | null) => void;
  setClientSheet: (open: boolean) => void;
  setClientSheetCreate: (open: boolean) => void;
  setClientMenuOpen: (open: boolean) => void;

  appointment: Appointment;
  otherApts: Appointment[];
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
  setClientId,
  setLocationId,
  setClientSheet,
  setClientSheetCreate,
  setClientMenuOpen,
  appointment,
  otherApts,
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
  showPayment,
  paymentTotal,
  onPay,
  onReschedule,
}: AppointmentWorkBodyProps) {
  return (
    <>
      <ClientBlock
        client={client}
        readonly={readonly}
        onPick={() => {
          setClientSheetCreate(false);
          setClientSheet(true);
        }}
        onCreate={() => {
          setClientSheetCreate(true);
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
          // The original v696 only patched the full ClientSheet
          // callback; picking a recent client (the one-tap shortcut)
          // skipped door-code prefill. Guard is the same: only fire
          // when the comment is currently empty.
          const locationNote = primary?.note?.trim();
          if (locationNote && !comment.trim()) {
            setComment(locationNote);
          }
        }}
      />

      {client && (
        <ClientHistoryStrip
          clientId={client.id}
          excludeAppointmentId={appointment.id}
          appointments={otherApts}
          catalog={catalog}
        />
      )}

      {client && (
        <LocationsBlock
          client={client}
          selectedLocationId={locationId}
          readOnly={readonly}
          addressNote={addressNote}
          onSelectLocation={setLocationId}
          onAddressNoteChange={setAddressNote}
          placeholder={addressPlaceholder}
        />
      )}

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

      {/* Оплата — блок появляется только у существующих записей (после
          создания), на фиксированном месте под «Доход». Оплата
          завершает запись (handlePay). */}
      {showPayment && <PaymentBlock total={paymentTotal} onPay={onPay} />}

      {/* Комментарий всегда над «Подробнее» — это первое, что диспетчер
          слышит по телефону («домофон 25, синяя дверь»). */}
      <CommentBlock value={comment} readonly={readonly} onChange={setComment} />

      <details
        className="group px-4 pt-3"
        // v700 — auto-open «Подробнее» for existing records and for
        // fresh clients (created within 24 h) so the dispatcher actually
        // sets an acquisition source on first contact.
        open={
          liveMode === "edit" ||
          (client?.created_at != null &&
            Date.now() - new Date(client.created_at).getTime() <
              24 * 60 * 60 * 1000)
        }
      >
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
        </div>
      </details>

      {/* Перенести — для существующих запланированных записей. */}
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

      {/* Отмена — для существующих не-завершённых записей. Для уже
          отменённой запись тумблер показывает текущую причину. */}
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
