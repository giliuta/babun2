"use client";

// STORY-056 — Work-mode body of the unified EventSheet.
// Reuses existing AppointmentSheet sub-blocks (ClientBlock,
// LocationsBlock, ServicesBlock, IncomeBlock, SourceBlock,
// CommentBlock) so dispatcher behaviour stays identical to the old
// AppointmentSheet create/edit branches. Photos / payments /
// repeat-reminder / invoice live in AppointmentDetailsSheet (view/done
// only) and are intentionally out of scope here.

import { useState } from "react";
import type {
  AppointmentService,
  AppointmentSource,
  Discount,
} from "@babun/shared/local/appointments";
import type { Client } from "@babun/shared/local/clients";
import type { Service } from "@babun/shared/local/services";

import ClientBlock from "@/components/appointment/ClientBlock";
import LocationsBlock from "@/components/appointment/LocationsBlock";
import ServicesBlock from "@/components/appointment/ServicesBlock";
import IncomeBlock from "@/components/appointment/IncomeBlock";
import SourceBlock from "@/components/appointment/SourceBlock";
import CommentBlock from "@/components/appointment/CommentBlock";

import EventTimePicker from "./EventTimePicker";

export interface WorkBodyProps {
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  setDateKey: (s: string) => void;
  setTimeStart: (s: string) => void;
  setTimeEnd: (s: string) => void;
  source: AppointmentSource | null;
  setSource: (s: AppointmentSource | null) => void;
  client: Client | null;
  clientId: string | null;
  setClientId: (s: string | null) => void;
  locationId: string | null;
  setLocationId: (s: string | null) => void;
  addressNote: string;
  setAddressNote: (s: string) => void;
  services: AppointmentService[];
  setServices: (s: AppointmentService[]) => void;
  globalDiscount: Discount | null;
  setGlobalDiscount: (d: Discount | null) => void;
  catalog: Service[];
  comment: string;
  setComment: (s: string) => void;
  cityLabel: string;
  cityColor: string | null;
  teamLabel: string | null;
  onPickClient: () => void;
  onPickService: () => void;
}

export default function EventSheetWorkBody(p: WorkBodyProps) {
  return (
    <>
      {(p.cityLabel || p.teamLabel) && (
        <div className="px-4 py-2 bg-[var(--surface-grouped)] border-b border-[var(--separator)] flex items-center gap-2 text-[13px]">
          {p.cityLabel && (
            <span className="font-semibold flex-shrink-0" style={{ color: p.cityColor ?? undefined }}>
              {p.cityLabel}
            </span>
          )}
          {p.cityLabel && p.teamLabel && <span className="text-[var(--label-tertiary)]">·</span>}
          {p.teamLabel && <span className="text-[var(--label)] flex-shrink-0">{p.teamLabel}</span>}
        </div>
      )}

      <SimpleTimeRow
        dateKey={p.dateKey}
        timeStart={p.timeStart}
        timeEnd={p.timeEnd}
        onChange={(next) => {
          p.setDateKey(next.date);
          p.setTimeStart(next.timeStart);
          p.setTimeEnd(next.timeEnd);
        }}
      />

      <SourceBlock value={p.source} readonly={false} onChange={p.setSource} />

      <ClientBlock
        client={p.client}
        readonly={false}
        onPick={p.onPickClient}
        onChange={() => p.setClientId(null)}
      />

      <LocationsBlock
        client={p.client}
        selectedLocationId={p.locationId}
        readOnly={false}
        addressNote={p.addressNote}
        onSelectLocation={p.setLocationId}
        onAddressNoteChange={p.setAddressNote}
      />

      <ServicesBlock
        services={p.services}
        globalDiscount={p.globalDiscount}
        catalog={p.catalog}
        readonly={false}
        onServicesChange={p.setServices}
        onOpenPicker={p.onPickService}
      />

      <IncomeBlock
        services={p.services}
        globalDiscount={p.globalDiscount}
        catalog={p.catalog}
        readonly={false}
        onServicesChange={p.setServices}
        onGlobalDiscountChange={p.setGlobalDiscount}
      />

      <CommentBlock value={p.comment} readonly={false} onChange={p.setComment} />
    </>
  );
}

function SimpleTimeRow({
  dateKey,
  timeStart,
  timeEnd,
  onChange,
}: {
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  onChange: (next: { date: string; timeStart: string; timeEnd: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-4 py-3 active:bg-[var(--fill-quaternary)] transition border-b border-[var(--separator)]"
      >
        <div className="text-[15px] text-[var(--label)]">
          {formatDateTime(dateKey, timeStart, timeEnd)}
        </div>
        <span className="text-[var(--label-tertiary)] text-[13px]">›</span>
      </button>
      <EventTimePicker
        open={open}
        onClose={() => setOpen(false)}
        value={{ date: dateKey, timeStart, timeEnd }}
        onConfirm={onChange}
      />
    </>
  );
}

function formatDateTime(dateKey: string, timeStart: string, timeEnd: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const dateLabel = Number.isFinite(dt.getTime())
    ? dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    : dateKey;
  const [sh, sm] = timeStart.split(":").map(Number);
  const [eh, em] = timeEnd.split(":").map(Number);
  const dur = Math.max(0, eh * 60 + em - (sh * 60 + sm));
  return `${dateLabel} · ${timeStart} → ${timeEnd} (${dur} мин)`;
}
