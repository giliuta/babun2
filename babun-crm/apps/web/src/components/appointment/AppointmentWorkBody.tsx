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
  liveMode: AppointmentSheetMode;
  isEditable: boolean;
  readonly: boolean;

  client: Client | null;
  recentClientsResolved: Client[];
  setClientId: (id: string | null) => void;
  setLocationId: (id: string | null) => void;
  setClientSheet: (open: boolean) => void;
  setClientMenuOpen: (open: boolean) => void;

  appointment: Appointment;
  otherApts: Appointment[];
  catalog: Service[];

  locationId: string | null;
  addressNote: string;
  setAddressNote: (next: string) => void;
  anonymousAddress: string;
  setAnonymousAddress: (next: string) => void;
  addressPlaceholder: string;
  selectedLocation: Location | null;

  appointmentServices: AppointmentService[];
  globalDiscount: Discount | null;
  popularServices: Service[];
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

      {/* STORY audit: Комментарий — это первое что диспетчер слышит
          от клиента по телефону («домофон 25, второй этаж, синяя
          дверь»). Раньше CommentBlock жил внутри Details accordion и
          был закрыт по умолчанию в create-mode — приходилось тапать
          «Подробнее», чтобы записать важную инфо. Теперь Comment
          выведен НАД accordion в editable-mode тоже, оставаясь дублёром
          внутри (для совместимости с старой видимостью). */}
      {isEditable && (
        <CommentBlock value={comment} readonly={readonly} onChange={setComment} />
      )}
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

            {/* CommentBlock уже отрендерен выше accordion (см. STORY
                audit) — дубль внутри details снят. */}

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
