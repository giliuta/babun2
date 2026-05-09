"use client";

// STORY-056 — Unified create/edit sheet for both work appointments
// and personal events. Replaces:
//   • AppointmentSheet's create + edit branches (view/done now live
//     in AppointmentDetailsSheet)
//   • PersonalEventSheet (entirely)
//
// Top-bar in mode='create' shows the Личное · Работа toggle; in
// mode='edit' the toggle is replaced with a static badge for the
// current kind (changing kind on an existing record is intentionally
// blocked — payments/photos belong to a kind, not to an arbitrary
// event).
//
// Body is split into EventSheetEventBody (kind='event') and
// EventSheetWorkBody (kind='work') to keep this file under the
// 400-line golden-rule budget.

import { useEffect, useMemo, useState } from "react";
import { Trash2, X as XIcon } from "@babun/shared/icons";
import type {
  Appointment,
  AppointmentService,
  AppointmentSource,
  Discount,
  PersonalEventRepeat,
} from "@babun/shared/local/appointments";
import type { Client } from "@babun/shared/local/clients";
import type { Master, Team } from "@babun/shared/local/masters";
import type { Service, ServiceCategory } from "@babun/shared/local/services";
import { getCityColor } from "@babun/shared/local/day-cities";
import { getTeamDisplayName } from "@babun/shared/local/masters";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import { getSupabaseBrowser } from "@/lib/supabase/client";

import ClientPickerSheet from "@/components/appointments/sheet/ClientPickerSheet";
import ServicePickerSheet from "@/components/appointments/sheet/ServicePickerSheet";

import EventTimePicker from "./EventTimePicker";
import EventPushPicker from "./EventPushPicker";
import EventRepeatPicker from "./EventRepeatPicker";
import EventSheetEventBody from "./EventSheetEventBody";
import EventSheetWorkBody from "./EventSheetWorkBody";

import {
  SYSTEM_PRESETS,
  applyPreset,
  type EventPreset,
} from "@/lib/eventPresets";
import { listEventTemplates, templateToPreset } from "@/lib/eventTemplates";
import {
  buildEventPayload,
  buildWorkPayload,
  servicesToIds,
  idsToServices,
} from "./EventSheetHelpers";

type Kind = "work" | "event";

export interface EventSheetProps {
  open: boolean;
  mode: "create" | "edit";
  defaultKind: Kind;
  appointment: Appointment;
  clients: Client[];
  recentClientIds: string[];
  teams: Team[];
  activeTeam: Team | null;
  masters?: Master[];
  catalog: Service[];
  categories: ServiceCategory[];
  cityForDate: (dateKey: string) => string;
  onClose: () => void;
  onSave: (apt: Appointment) => void;
  onDelete?: (apt: Appointment) => void;
}

const DEFAULT_COLOR = "#6366F1";
const NO_REPEAT: PersonalEventRepeat = { kind: "none" };

export default function EventSheet({
  open,
  mode,
  defaultKind,
  appointment,
  clients,
  recentClientIds,
  activeTeam,
  masters,
  catalog,
  categories,
  cityForDate,
  onClose,
  onSave,
  onDelete,
}: EventSheetProps) {
  const tenantId = useTenantId();

  const seedKind: Kind =
    mode === "edit"
      ? appointment.kind === "event" || appointment.kind === "personal"
        ? "event"
        : "work"
      : defaultKind;

  // ─── State ───────────────────────────────────────────────────────
  const [kind, setKind] = useState<Kind>(seedKind);
  const [dateKey, setDateKey] = useState(appointment.date);
  const [timeStart, setTimeStart] = useState(appointment.time_start);
  const [timeEnd, setTimeEnd] = useState(appointment.time_end);
  const [allDay, setAllDay] = useState(appointment.event_all_day ?? false);
  const [title, setTitle] = useState(appointment.comment ?? "");
  const [color, setColor] = useState(appointment.color_override ?? DEFAULT_COLOR);
  const [expanded, setExpanded] = useState(false);

  // Event-only
  const [notes, setNotes] = useState(appointment.event_notes ?? "");
  const [address, setAddress] = useState(appointment.address ?? "");
  const [url, setUrl] = useState(appointment.event_url ?? "");
  const [pushOffsetMin, setPushOffsetMin] = useState<number | null>(
    appointment.event_push_offsets && appointment.event_push_offsets.length > 0
      ? appointment.event_push_offsets[0]
      : null,
  );
  const [repeat, setRepeat] = useState<PersonalEventRepeat>(
    appointment.event_repeat ?? NO_REPEAT,
  );

  // Work-only
  const [clientId, setClientId] = useState<string | null>(appointment.client_id);
  const [locationId, setLocationId] = useState<string | null>(appointment.location_id);
  const [services, setServices] = useState<AppointmentService[]>(appointment.services ?? []);
  const [globalDiscount, setGlobalDiscount] = useState<Discount | null>(
    appointment.global_discount ?? null,
  );
  const [comment, setComment] = useState(appointment.comment ?? "");
  const [addressNote, setAddressNote] = useState(appointment.address_note ?? "");
  const [source, setSource] = useState<AppointmentSource | null>(appointment.source ?? null);

  // Picker visibility
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [pushPickerOpen, setPushPickerOpen] = useState(false);
  const [repeatPickerOpen, setRepeatPickerOpen] = useState(false);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);

  // Custom presets (event-mode)
  const [customPresets, setCustomPresets] = useState<EventPreset[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    setKind(seedKind);
    setDateKey(appointment.date);
    setTimeStart(appointment.time_start);
    setTimeEnd(appointment.time_end);
    setAllDay(appointment.event_all_day ?? false);
    setTitle(appointment.comment ?? "");
    setColor(appointment.color_override ?? DEFAULT_COLOR);
    setNotes(appointment.event_notes ?? "");
    setAddress(appointment.address ?? "");
    setUrl(appointment.event_url ?? "");
    setPushOffsetMin(
      appointment.event_push_offsets && appointment.event_push_offsets.length > 0
        ? appointment.event_push_offsets[0]
        : null,
    );
    setRepeat(appointment.event_repeat ?? NO_REPEAT);
    setClientId(appointment.client_id);
    setLocationId(appointment.location_id);
    setServices(appointment.services ?? []);
    setGlobalDiscount(appointment.global_discount ?? null);
    setComment(appointment.comment ?? "");
    setAddressNote(appointment.address_note ?? "");
    setSource(appointment.source ?? null);
    setExpanded(false);
  }, [open, appointment.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!open || kind !== "event") return;
    const supabase = getSupabaseBrowser();
    void listEventTemplates(supabase, tenantId)
      .then((templates) => setCustomPresets(templates.map(templateToPreset)))
      .catch(() => {
        // Silent — system presets still work without custom.
      });
  }, [open, kind, tenantId]);

  const presets = useMemo<EventPreset[]>(
    () => [...SYSTEM_PRESETS, ...customPresets],
    [customPresets],
  );

  // ─── Derived ─────────────────────────────────────────────────────
  const client = useMemo<Client | null>(
    () => (clientId ? clients.find((c) => c.id === clientId) ?? null : null),
    [clientId, clients],
  );
  const selectedLocation = useMemo(() => {
    const list = client?.locations ?? [];
    if (list.length === 0) return null;
    if (locationId) return list.find((l) => l.id === locationId) ?? list[0];
    return list.find((l) => l.isPrimary) ?? list[0];
  }, [client, locationId]);

  const canSave =
    kind === "event"
      ? Boolean(title.trim())
      : Boolean(clientId && services.length > 0);

  const city = cityForDate(dateKey);
  const cityColor = city ? getCityColor(city) : null;
  const teamLabel = activeTeam
    ? masters && masters.length > 0
      ? getTeamDisplayName(activeTeam, masters)
      : activeTeam.name
    : null;

  // ─── Handlers ────────────────────────────────────────────────────
  const handlePreset = (p: EventPreset) => {
    const patch = applyPreset(p, timeStart);
    setTitle(patch.title);
    setColor(patch.color);
    setTimeEnd(patch.timeEnd);
    setPushOffsetMin(patch.pushOffsetMin);
  };

  const handleSave = () => {
    if (!canSave) return;
    if (kind === "event") {
      onSave(
        buildEventPayload({
          appointment,
          dateKey,
          timeStart,
          timeEnd,
          allDay,
          title,
          color,
          notes,
          address,
          url,
          pushOffsetMin,
          repeat,
        }),
      );
      return;
    }
    onSave(
      buildWorkPayload({
        appointment,
        mode,
        dateKey,
        timeStart,
        timeEnd,
        client,
        clientId,
        selectedLocation,
        locationId,
        addressNote,
        services,
        globalDiscount,
        catalog,
        comment,
        source,
        activeTeamId: activeTeam?.id ?? null,
      }),
    );
  };

  if (!open) return null;

  // ─── Rendering ───────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden"
        style={{ height: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 h-14 border-b border-[var(--separator)]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <XIcon size={18} strokeWidth={2.5} />
          </button>

          {mode === "create" ? (
            <KindToggle kind={kind} onChange={setKind} />
          ) : (
            <span className="px-3 py-1 rounded-full bg-[var(--fill-tertiary)] text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
              {kind === "event" ? "Личное" : "Работа"}
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={`min-w-[60px] h-9 px-3 rounded-lg text-[15px] font-semibold transition ${
              canSave
                ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)] active:scale-[0.98]"
                : "text-[var(--label-tertiary)]"
            }`}
          >
            {mode === "edit" ? "Сохранить" : "Готово"}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {kind === "event" ? (
            <EventSheetEventBody
              title={title}
              setTitle={setTitle}
              color={color}
              setColor={setColor}
              dateKey={dateKey}
              timeStart={timeStart}
              timeEnd={timeEnd}
              allDay={allDay}
              setAllDay={setAllDay}
              notes={notes}
              setNotes={setNotes}
              address={address}
              setAddress={setAddress}
              url={url}
              setUrl={setUrl}
              pushOffsetMin={pushOffsetMin}
              repeat={repeat}
              expanded={expanded}
              setExpanded={setExpanded}
              presets={presets}
              onPreset={handlePreset}
              onOpenTimePicker={() => setTimePickerOpen(true)}
              onOpenPushPicker={() => setPushPickerOpen(true)}
              onOpenRepeatPicker={() => setRepeatPickerOpen(true)}
              autoFocusTitle={mode === "create"}
            />
          ) : (
            <EventSheetWorkBody
              dateKey={dateKey}
              timeStart={timeStart}
              timeEnd={timeEnd}
              setDateKey={setDateKey}
              setTimeStart={setTimeStart}
              setTimeEnd={setTimeEnd}
              source={source}
              setSource={setSource}
              client={client}
              clientId={clientId}
              setClientId={setClientId}
              setLocationId={setLocationId}
              locationId={locationId}
              addressNote={addressNote}
              setAddressNote={setAddressNote}
              services={services}
              setServices={setServices}
              globalDiscount={globalDiscount}
              setGlobalDiscount={setGlobalDiscount}
              catalog={catalog}
              comment={comment}
              setComment={setComment}
              cityLabel={city}
              cityColor={cityColor}
              teamLabel={teamLabel}
              onPickClient={() => setClientPickerOpen(true)}
              onPickService={() => setServicePickerOpen(true)}
            />
          )}
        </div>

        {!canSave && (
          <div className="flex-shrink-0 text-[11px] italic text-[var(--label-secondary)] px-4 pb-3 text-center">
            {kind === "event" ? "Введите название" : "Выберите клиента и услугу"}
          </div>
        )}

        {mode === "edit" && onDelete && (
          <div
            className="flex-shrink-0 px-3 border-t border-[var(--separator)] bg-[var(--surface-card)]"
            style={{ paddingTop: 10, paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)" }}
          >
            <button
              type="button"
              onClick={() => onDelete(appointment)}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-[var(--system-red)] bg-transparent active:bg-[rgba(255,59,48,0.08)]"
            >
              <Trash2 size={16} strokeWidth={2} />
              Удалить
            </button>
          </div>
        )}
      </div>

      {/* Pickers */}
      <EventTimePicker
        open={timePickerOpen}
        onClose={() => setTimePickerOpen(false)}
        value={{ date: dateKey, timeStart, timeEnd }}
        onConfirm={(next) => {
          setDateKey(next.date);
          setTimeStart(next.timeStart);
          setTimeEnd(next.timeEnd);
        }}
      />
      <EventPushPicker
        open={pushPickerOpen}
        onClose={() => setPushPickerOpen(false)}
        value={pushOffsetMin}
        onChange={setPushOffsetMin}
      />
      <EventRepeatPicker
        open={repeatPickerOpen}
        onClose={() => setRepeatPickerOpen(false)}
        value={repeat}
        onChange={setRepeat}
      />

      {kind === "work" && (
        <>
          <ClientPickerSheet
            open={clientPickerOpen}
            onClose={() => setClientPickerOpen(false)}
            onSelect={(c) => {
              setClientId(c.id);
              const primary = c.locations.find((l) => l.isPrimary) ?? c.locations[0] ?? null;
              setLocationId(primary?.id ?? null);
              setClientPickerOpen(false);
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
            initialSelectedIds={servicesToIds(services)}
            onConfirm={(ids) => setServices(idsToServices(ids, catalog, services))}
            clientName={client?.full_name ?? null}
            clientPhone={client?.phone ?? null}
          />
        </>
      )}
    </div>
  );
}

function KindToggle({ kind, onChange }: { kind: Kind; onChange: (k: Kind) => void }) {
  return (
    <div className="inline-flex rounded-[10px] bg-[var(--fill-tertiary)] p-1 text-[13px] font-semibold">
      {(["event", "work"] as Kind[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`px-4 py-1 rounded-[8px] transition ${
            kind === k
              ? "bg-[var(--surface-card)] text-[var(--label)] shadow-[var(--shadow-card)]"
              : "text-[var(--label-secondary)]"
          }`}
        >
          {k === "event" ? "Личное" : "Работа"}
        </button>
      ))}
    </div>
  );
}

