"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { CalendarClock } from "@babun/shared/icons";
import type {
  Appointment,
  AppointmentPayment,
  // STORY-049 — AppointmentPhoto removed from imports; the sheet
  // hydrates `AppointmentPhotoRecord[]` from the appointment-photos
  // repo on open.
  AppointmentService,
  AppointmentSource,
  Discount,
} from "@babun/shared/local/appointments";
import { loadAppointments } from "@babun/shared/local/appointments";
import {
  listPhotosForAppointment,
  type AppointmentPhotoRecord,
} from "@babun/shared/db/repositories/appointment-photos";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import type { Client, Location } from "@babun/shared/local/clients";
import type { Master, Team } from "@babun/shared/local/masters";
import { getTeamDisplayName } from "@babun/shared/local/masters";
import type { Service, ServiceCategory } from "@babun/shared/local/services";
import {
  buildSavedWorkAppointment,
  buildCompletedAppointment,
} from "@/lib/appointment-builders";
// Beta #53 (CRM Core brief) — loyalty tier auto-apply on client pick.
import { useLoyaltyAutoApply } from "@/hooks/useLoyaltyAutoApply";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { getCityColor, CITY_LIST } from "@babun/shared/local/day-cities";
import { formatEUR } from "@babun/shared/common/utils/money";
import {
  appointmentTotal,
  totalDuration as calcDuration,
} from "@babun/shared/local/finance/appointment-calc";
import { formatShortDate } from "./ClientHistoryStrip";
import OverlapWarning from "./OverlapWarning";
import EventForm from "@/components/event/EventForm";
import AppointmentWorkBody from "./AppointmentWorkBody";
import AppointmentSubSheets from "./AppointmentSubSheets";
import { SegmentSwitchConfirmDialog } from "./AppointmentConfirmDialogs";
import TimePopup from "./TimePopup";
import AppointmentHeader from "./AppointmentHeader";
import AppointmentSaveButton from "./AppointmentSaveButton";
import PaymentBlock from "./PaymentBlock";
import { createRecurringReminder } from "@babun/shared/db/repositories/recurring-reminders";
// jspdf + invoice builder are heavy (~350 kB combined). Load them on
// demand when the dispatcher actually taps "Скачать счёт" instead of
// shipping the module in the main dashboard bundle.

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
  /** Beta #53 (CRM Core brief) — completed-visit count per client.
   *  When provided, the sheet auto-applies the loyalty discount
   *  matching `tierForVisits(visitsForClient(clientId), loyalty)`
   *  on client selection. Optional so existing callers compile. */
  visitsForClient?: (clientId: string) => number;
  /** Masters — used to derive brigade display name ("Юра + Даня · Пафос"). */
  masters?: Master[];
  /** Каталог услуг для выбора и сопоставления id → service. */
  catalog: Service[];
  /** Категории услуг для группировки в пикере. */
  categories: ServiceCategory[];
  cityForDate: (dateKey: string) => string;
  onSave: (apt: Appointment) => void;
  onCancelAppointment: (apt: Appointment) => void;
  /** Sprint 025 STORY-005: header ↻ button opens parent's RescheduleSheet. */
  onReschedule?: (apt: Appointment) => void;
  /** Sprint 025 STORY-005: header ✓ button triggers parent's PaymentSheet. */
  onCompleteQuick?: (apt: Appointment) => void;
  /** Sprint 033 Phase I37 — personal-calendar mode. Forces kind="event",
   *  hides the Клиент/Событие segment toggle, and tells inner blocks
   *  this is a private note (client/services sections are irrelevant). */
  personalMode?: boolean;
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
  recentClientIds,
  activeTeam,
  visitsForClient,
  masters,
  catalog,
  categories,
  cityForDate,
  onSave,
  onCancelAppointment,
  onReschedule,
  onCompleteQuick,
  personalMode = false,
}: AppointmentSheetProps) {
  const toast = useToast();
  // Локальный mode-state: позволяет переключаться в 'edit' из 'view'
  // при тапе на «Редактировать» в AdminActions без перекомпоновки
  // sheet родителем.
  const [liveMode, setLiveMode] = useState<AppointmentSheetMode>(mode);
  useEffect(() => setLiveMode(mode), [mode, appointment.id]);

  const [kind, setKind] = useState<Kind>(
    personalMode ||
      appointment.kind === "event" ||
      appointment.kind === "personal"
      ? "event"
      : "work",
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
  const [addressNote, setAddressNote] = useState(appointment.address_note ?? "");
  // v607 P0 #5 — anonymous (no-client) address. Lives on apt.address.
  // Seeded from the appointment record so re-opening a no-client draft
  // keeps the address visible.
  const [anonymousAddress, setAnonymousAddress] = useState(
    appointment.client_id ? "" : appointment.address ?? ""
  );
  const [cancelFlag, setCancelFlag] = useState(appointment.status === "cancelled");
  const [cancelReason, setCancelReason] = useState(appointment.cancel_reason ?? "");
  const [source, setSource] = useState<AppointmentSource | null>(appointment.source ?? null);
  // v611 P1 §19 — remember the last source the operator picked so the
  // chip appears first + outlined in the next create flow. Stored in
  // localStorage (tenant-agnostic — a single-master UX choice).
  const [lastUsedSource, setLastUsedSource] = useState<AppointmentSource | null>(
    () => {
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem("babun.lastSource");
      return raw && (raw as AppointmentSource) ? (raw as AppointmentSource) : null;
    }
  );
  // v617 P1 §17 — single time chip in caption opens a popup with the
  // date+time+duration editors. The inline cluster is removed from
  // body so it stays focused on client / services.
  const [timePopupOpen, setTimePopupOpen] = useState(false);
  // v619 — data-loss guard: EventForm reports its dirty state up so
  // the [Клиент/Событие] segment toggle can warn before dropping the
  // draft. EventForm's internal close-confirm already protects
  // backdrop/Esc; this protects the segment-toggle exit path.
  const [eventFormDirty, setEventFormDirty] = useState(false);
  const [segmentSwitchConfirm, setSegmentSwitchConfirm] = useState(false);
  // v617 P1 §20 — swipe-down dirty-guard. Track touch on the modal
  // container; if the operator drags down past 90 px and the scroll
  // body is at the top, treat it as a close-attempt (which routes
  // through the dirty check just like the backdrop / Esc / ✕ paths).
  const swipeStartY = useRef<number | null>(null);
  const swipeDeltaY = useRef<number>(0);
  // STORY-049 — photos hydrate from Supabase Storage via the
  // appointment-photos repo (effect below). Initial render shows
  // an empty list; thumbnails fade in once the fetch resolves.
  const [photos, setPhotos] = useState<AppointmentPhotoRecord[]>([]);
  const tenantId = useTenantId();
  const [smsEnabled, setSmsEnabled] = useState(appointment.reminder_enabled);
  const [eventLabel, setEventLabel] = useState(appointment.comment || "");
  // v616 P2 — operator-picked event accent override. null = derive from
  // the preset name (legacy behaviour). When set, beats the preset's
  // intrinsic colour on save.
  const [eventColorOverride, setEventColorOverride] = useState<string | null>(
    appointment.color_override ?? null,
  );
  const [clientSheet, setClientSheet] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [askClientFirst, setAskClientFirst] = useState(false);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [sendMsgOpen, setSendMsgOpen] = useState(false);
  const [clientProfileOpen, setClientProfileOpen] = useState(false);
  const [repeatSheetOpen, setRepeatSheetOpen] = useState(false);

  // Body scroll lock + Esc close for the main sheet. v628 §9 step 7
  // extracted into useBodyScrollLock hook. `attemptClose` is declared
  // below; wrap in a getter so the temporal-dead-zone reference works.
  useBodyScrollLock({ open, onEsc: () => attemptClose() });
  // documentElement lock when TimePopup is open — `body.style.overflow:
  // hidden` alone doesn't stop iOS Safari from panning the sheet's
  // inner overflow-y-auto container.
  useBodyScrollLock({
    open: timePopupOpen,
    onEsc: () => setTimePopupOpen(false),
    target: "html",
  });

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
    setAddressNote(appointment.address_note ?? "");
    setAnonymousAddress(appointment.client_id ? "" : appointment.address ?? "");
    setCancelFlag(appointment.status === "cancelled");
    setCancelReason(appointment.cancel_reason ?? "");
    setSource(appointment.source ?? null);
    // STORY-049 — refresh photo list when the appointment id changes.
    setPhotos([]);
    if (appointment.id) {
      const supabase = getSupabaseBrowser();
      void listPhotosForAppointment(supabase, appointment.id)
        .then(setPhotos)
        .catch(() => {
          // Quiet failure — sheet is functional without photos.
        });
    }
    setEventLabel(appointment.comment || "");
    setEventColorOverride(appointment.color_override ?? null);
    setDurationTouched(false);
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

  // v611 P1 §13 — resolve the top-5 recent client ids into real
  // records so ClientBlock can render the avatar chip strip without
  // doing its own lookup. Filtered against the current `clients`
  // list so a deleted-but-still-listed id doesn't render a "?" chip.
  const recentClientsResolved = useMemo<Client[]>(() => {
    const byId = new Map(clients.map((c) => [c.id, c]));
    const out: Client[] = [];
    for (const id of recentClientIds) {
      const c = byId.get(id);
      if (c) out.push(c);
      if (out.length >= 5) break;
    }
    return out;
  }, [clients, recentClientIds]);


  // Beta #53 — auto-apply loyalty tier discount on client pick.
  useLoyaltyAutoApply({
    clientId,
    visitsForClient,
    globalDiscount,
    setGlobalDiscount,
  });

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

  // v607 P0 #5 — without a client, the address lives on the appointment
  // row directly (anonymousAddress). With a client, the picked location
  // wins as before.
  const address = client
    ? selectedLocation?.address ?? appointment.address ?? ""
    : anonymousAddress.trim();

  const city = cityForDate(dateKey);
  const cityColor = city ? getCityColor(city) : "#64748b";
  // v607 P0 #5 — placeholder hint follows the day's city-tag so an
  // operator tapping a slot in a "ПТ = ЛИМ" column sees
  // "Лимассол, ул. ..." instead of the generic prompt.
  const addressPlaceholder = city
    ? `${city}, ул. …`
    : "Адрес или Google Maps ссылка";

  // Рассчитанный итог / длительность для sticky-кнопки + time end.
  const price = appointmentTotal(appointmentServices, globalDiscount);

  // Double-booking detection — only warn; don't block. Reads once from
  // storage per change of the time / date / team inputs. Two overlapping
  // records happen by accident in HVAC often (two brigade leads answer
  // the same call independently); the banner catches it before save.
  // Load the appointment list once when the sheet opens, not on every
  // input keystroke. `loadAppointments` is a synchronous localStorage
  // read — cheap but redundant — and with the list pinned to state we
  // also get the conflict record reference for tap-to-open below.
  const [otherApts, setOtherApts] = useState<Appointment[]>([]);
  useEffect(() => {
    if (!open) return;
    setOtherApts(loadAppointments().filter((a) => a.id !== appointment.id));
  }, [open, appointment.id]);

  // v611 P0 §1.6 — top-3 most-used services across the tenant's
  // appointment history. Lives here because it needs `otherApts`
  // (loaded above for the double-booking check), so we reuse it.
  const popularServices = useMemo<Service[]>(() => {
    const freq = new Map<string, number>();
    for (const a of otherApts) {
      for (const id of a.service_ids) freq.set(id, (freq.get(id) ?? 0) + 1);
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => catalog.find((s) => s.id === id))
      .filter((s): s is Service => Boolean(s))
      .slice(0, 3);
  }, [otherApts, catalog]);

  const overlapConflict = useMemo<Appointment | null>(() => {
    if (!activeTeam || kind === "event") return null;
    if (!timeStart || !timeEnd || timeStart >= timeEnd) return null;
    for (const other of otherApts) {
      if (other.status === "cancelled") continue;
      if (other.date !== dateKey) continue;
      if (other.team_id !== activeTeam.id) continue;
      // Overlap if ranges intersect (half-open interval).
      if (timeStart < other.time_end && other.time_start < timeEnd) {
        return other;
      }
    }
    return null;
  }, [activeTeam, dateKey, kind, otherApts, timeEnd, timeStart]);

  const overlapWarning = overlapConflict
    ? (() => {
        const who = overlapConflict.client_id
          ? clients.find((c) => c.id === overlapConflict.client_id)?.full_name ??
            "Запись"
          : overlapConflict.comment || "Запись";
        return `${overlapConflict.time_start}–${overlapConflict.time_end} · ${who}`;
      })()
    : null;
  const totalDur = calcDuration(appointmentServices);

  const isEditable = liveMode === "create" || liveMode === "edit";

  // v616 P1 §14/§15 — `durationTouched` flag. When the operator picks
  // a duration explicitly (chip row below), service-list changes stop
  // auto-extending the end time. Reset implicitly when the sheet
  // opens for a new appointment.
  const [durationTouched, setDurationTouched] = useState(false);

  // Live end-time recalc: end ≥ start + Σ service durations. Grows only
  // — a manually-extended end is never shrunk back. Off in view/done
  // (readonly), for personal events, and once `durationTouched` is
  // set (the operator chose a duration deliberately). Clamps at 23:59
  // to avoid wrap-around; a visit that crosses midnight should be
  // booked as two records.
  useEffect(() => {
    if (!isEditable || kind === "event") return;
    if (durationTouched) return;
    if (totalDur <= 0) return;
    const [sh, sm] = timeStart.split(":").map(Number);
    const [eh, em] = timeEnd.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const requiredEnd = Math.min(23 * 60 + 59, startMin + totalDur);
    if (requiredEnd > endMin) {
      const nh = Math.floor(requiredEnd / 60);
      const nm = requiredEnd % 60;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeEnd(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`);
    }
  }, [isEditable, kind, totalDur, timeStart, timeEnd, durationTouched]);

  // Apply an explicit duration in minutes — sets end_time and locks
  // out the live-recalc effect above. Clamps at 23:59.
  const applyDuration = (mins: number) => {
    const [sh, sm] = timeStart.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = Math.min(23 * 60 + 59, startMin + mins);
    setTimeEnd(
      `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`,
    );
    setDurationTouched(true);
  };

  // Current live duration (minutes between start and end).
  const liveDurationMins = (() => {
    const [sh, sm] = timeStart.split(":").map(Number);
    const [eh, em] = timeEnd.split(":").map(Number);
    return Math.max(0, eh * 60 + em - (sh * 60 + sm));
  })();
  const readonly = !isEditable;
  const isEventMode = kind === "event";

  // Sprint #4 P0 §4 — seed appointment for EventForm when event-mode
  // is active. Merges current AppointmentSheet time/date/label state
  // onto the incoming appointment record so EventForm opens pre-filled.
  // Memoised on the fields that EventForm reads; appointment.id as
  // reset-key keeps it in sync when the sheet reopens for a new record.
  const eventSeed = useMemo<Appointment>(() => ({
    ...appointment,
    date: dateKey,
    time_start: timeStart,
    time_end: timeEnd,
    kind: "event",
    comment: eventLabel,
    color_override: eventColorOverride,
    team_id: activeTeam?.id ?? null,
    master_id: null,
  }), [appointment.id, dateKey, timeStart, timeEnd, eventLabel, eventColorOverride]); // eslint-disable-line react-hooks/exhaustive-deps

  // STORY-009: show "Юра + Даня · Пафос" instead of the cookie-name
  // "Y&D" when masters are available. Falls back to team.name otherwise.
  const teamLabel = activeTeam
    ? masters && masters.length > 0
      ? getTeamDisplayName(activeTeam, masters)
      : activeTeam.name
    : "—";

  // Sprint 025 STORY-005: header quick actions (✓ / 📷 / ↻). Visible
  // only in view mode for records that are still actionable (scheduled
  // or in-progress). Completed / cancelled records already show the
  // status badge in the header slot so these don't appear.
  const photoScrollRef = useRef<HTMLDivElement | null>(null);
  const showQuickActions =
    liveMode === "view" &&
    !isEventMode &&
    appointment.status !== "completed" &&
    appointment.status !== "cancelled";
  const scrollToPhotos = () => {
    photoScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // v607 P0 #3 — Источник заявки больше не блокирует создание. KPI
  // «20 секунд на мотороллере» важнее аналитического gap'а; источник
  // переехал в свёрнутую секцию «Подробнее», по умолчанию null.
  // Минимум для work-записи: клиент + хотя бы одна услуга.
  const canSave = isEventMode
    ? Boolean(eventLabel.trim())
    : Boolean(clientId && appointmentServices.length > 0);

  // v607 P0 #1.8 — live preview button text. Shows date · time ·
  // duration · price when ready; lists what's missing otherwise so the
  // operator doesn't have to scroll up to find the gap.
  const missingParts: string[] = [];
  if (!isEventMode) {
    if (!clientId) missingParts.push("клиента");
    if (appointmentServices.length === 0) missingParts.push("услугу");
  } else if (!eventLabel.trim()) {
    missingParts.push("название");
  }
  const savePreviewLabel = (() => {
    if (!canSave) {
      return missingParts.length > 0
        ? `Заполните: ${missingParts.join(", ")} →`
        : (liveMode === "edit" ? "Сохранить" : "Создать запись");
    }
    if (isEventMode) {
      return liveMode === "edit" ? "Сохранить событие" : "Создать событие";
    }
    const shortDate = formatShortDate(dateKey);
    const verb = liveMode === "edit" ? "Сохранить" : "Создать";
    return `✓ ${verb} · ${shortDate} ${timeStart} · ${totalDur}мин · ${formatEUR(price)}`;
  })();

  // Whether the user has entered anything worth protecting on close.
  // v619 — data-loss audit P1: previously the check only caught
  // {clientId, services, comment}. Operators routinely typed address,
  // address notes, source, discount, cancel-reason then closed the
  // sheet only to discover the data was gone. Now we check every
  // field that handleCreate reads from state.
  //
  // For create-mode: any non-default value is "dirty".
  // For edit-mode: dirty if any field differs from the loaded record.
  const isCreate = liveMode === "create";
  const eventDirty = isEventMode && (
    isCreate
      ? Boolean(eventLabel.trim()) || eventColorOverride !== null
      : Boolean(
          eventLabel.trim() !== (appointment.comment ?? "").trim() ||
          eventColorOverride !== (appointment.color_override ?? null) ||
          dateKey !== appointment.date ||
          timeStart !== appointment.time_start ||
          timeEnd !== appointment.time_end,
        )
  );
  const workDirty = !isEventMode && (
    isCreate
      ? Boolean(
          clientId ||
          appointmentServices.length > 0 ||
          comment.trim() ||
          anonymousAddress.trim() ||
          addressNote.trim() ||
          source !== null ||
          globalDiscount !== null,
        )
      : Boolean(
          clientId !== appointment.client_id ||
          comment.trim() !== (appointment.comment ?? "").trim() ||
          addressNote.trim() !== (appointment.address_note ?? "").trim() ||
          source !== (appointment.source ?? null) ||
          cancelFlag !== (appointment.status === "cancelled") ||
          cancelReason.trim() !== (appointment.cancel_reason ?? "").trim() ||
          dateKey !== appointment.date ||
          timeStart !== appointment.time_start ||
          timeEnd !== appointment.time_end ||
          // Service list / discount changes — a shallow id+qty signature.
          JSON.stringify(appointmentServices.map((s) => [s.serviceId, s.quantity, s.pricePerUnit])) !==
            JSON.stringify((appointment.services ?? []).map((s) => [s.serviceId, s.quantity, s.pricePerUnit])) ||
          JSON.stringify(globalDiscount ?? null) !== JSON.stringify(appointment.global_discount ?? null),
        )
  );
  const isDirty = isEditable && (eventDirty || workDirty);

  if (!open) return null;

  // ─── Handlers ─────────────────────────────────────────────────────

  const attemptClose = () => {
    if (!isDirty) {
      onClose();
      return;
    }
    setCloseConfirm(true);
  };

  // Event-mode branch is DEAD CODE since EventForm.onSave routes events
  // directly — isEventMode is always false here (EventForm owns its own
  // submit path). Work mode only.
  const handleCreate = () => {
    if (!client || appointmentServices.length === 0) return;
    const saved = buildSavedWorkAppointment({
      appointment,
      client,
      appointmentServices,
      globalDiscount,
      dateKey,
      timeStart,
      timeEnd,
      locationId,
      activeTeamId: activeTeam?.id ?? null,
      comment,
      address,
      addressNote,
      source,
      cancelFlag,
      cancelReason,
      smsEnabled,
      liveMode,
    });
    onSave(saved);
  };

  const handlePay = (payment: AppointmentPayment) => {
    onSave(buildCompletedAppointment(appointment, payment));
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={attemptClose}
    >
      <div
        // STORY-056 — desktop cap at 720 px so the modal reads as a
        // proper dialog instead of a fullscreen takeover on a 1080-px
        // monitor (92 vh = 994 px). Mobile keeps 92 vh.
        // v617 P1 §20 — swipe-down dirty-guard: drag the sheet
        // downward by ≥90 px while the body is scrolled to the top
        // and we route through attemptClose (same as backdrop/Esc).
        className="w-full max-w-lg bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col lg:max-h-[720px]"
        style={{ height: "92vh" }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          const target = e.target as HTMLElement;
          const scroller = target.closest("[data-appt-scroll]") as HTMLElement | null;
          // Only arm the gesture if the scrollable body is at the top
          // — otherwise the user is mid-scroll and downward drags
          // should pan the list, not close the sheet.
          if (scroller && scroller.scrollTop > 0) {
            swipeStartY.current = null;
            return;
          }
          swipeStartY.current = e.touches[0]?.clientY ?? null;
          swipeDeltaY.current = 0;
        }}
        onTouchMove={(e) => {
          if (swipeStartY.current === null) return;
          swipeDeltaY.current = (e.touches[0]?.clientY ?? swipeStartY.current) - swipeStartY.current;
        }}
        onTouchEnd={() => {
          const delta = swipeDeltaY.current;
          swipeStartY.current = null;
          swipeDeltaY.current = 0;
          if (delta >= 90) attemptClose();
        }}
      >

        <AppointmentHeader
          liveMode={liveMode}
          personalMode={personalMode}
          kind={kind}
          eventFormDirty={eventFormDirty}
          doneBadge={doneBadge}
          showQuickActions={showQuickActions}
          onCompleteQuick={onCompleteQuick}
          onReschedule={onReschedule}
          appointment={appointment}
          scrollToPhotos={scrollToPhotos}
          setKind={setKind}
          setSegmentSwitchConfirm={setSegmentSwitchConfirm}
          attemptClose={attemptClose}
        />

        {/* Scroll body */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-4" data-appt-scroll>
          {/* City/team caption + v617 P1 §17 single time chip. Chip
              shows date · time · duration and opens the time popup on
              tap. City is still edited from the calendar day header. */}
          <div className="px-4 py-2 bg-[var(--surface-grouped)] border-b border-[var(--separator)] flex items-center gap-2 text-[13px] flex-wrap">
            {city && (
              <span
                className="font-semibold flex-shrink-0"
                style={{ color: cityColor }}
              >
                {city}
              </span>
            )}
            {city && <span className="text-[var(--label-tertiary)]">·</span>}
            <span className="text-[var(--label)] flex-shrink-0">{teamLabel}</span>
            <button
              type="button"
              onClick={() => setTimePopupOpen(true)}
              disabled={readonly}
              className={`ml-auto flex-shrink-0 inline-flex items-center gap-1.5 px-3 h-10 rounded-full text-[13px] font-semibold tabular-nums transition active:scale-[0.97] ${
                readonly
                  ? "bg-[var(--fill-tertiary)] text-[var(--label-secondary)] cursor-default"
                  : "bg-[var(--surface-card)] text-[var(--label)] border border-[var(--separator)] active:bg-[var(--fill-quaternary)]"
              }`}
              aria-label="Изменить время"
            >
              <CalendarClock size={14} strokeWidth={2} />
              {formatShortDate(dateKey)} · {timeStart}
              {liveDurationMins > 0 && ` · ${liveDurationMins}м`}
            </button>
          </div>

          {/* v617 P1 §17 — quick chips + TimeBlock + duration row
              moved into the time popup at the bottom of this file. */}
          {overlapConflict && overlapWarning && isEditable && !isEventMode && (
            <OverlapWarning
              conflict={overlapConflict}
              summary={overlapWarning}
              catalog={catalog}
              clients={clients}
            />
          )}

          {/* Event mode body — Sprint #4 P0 §4: unified EventForm overlay.
              Renders above the AppointmentSheet chrome when the operator
              picks "Событие" in the segment toggle. EventForm takes the
              event seed (time/date/label pre-filled), saves via the sheet's
              onSave, and closes back to this sheet on discard (create mode
              switches the segment back to "work"; edit mode closes the outer
              sheet). */}
          {isEventMode && isEditable && (
            <EventForm
              open
              onClose={() => {
                if (liveMode === "create") {
                  // Switch back to work tab so AppointmentSheet stays open.
                  setKind("work");
                  setEventFormDirty(false);
                } else {
                  onClose();
                }
              }}
              mode={liveMode === "edit" ? "edit" : "create"}
              event={eventSeed}
              context="team"
              onSave={(evt) => {
                onSave(evt);
                onClose();
              }}
              onDirtyChange={setEventFormDirty}
            />
          )}
          {!isEventMode && (
            <AppointmentWorkBody
              liveMode={liveMode}
              isEditable={isEditable}
              readonly={readonly}
              client={client}
              recentClientsResolved={recentClientsResolved}
              setClientId={setClientId}
              setLocationId={setLocationId}
              setClientSheet={setClientSheet}
              setClientMenuOpen={setClientMenuOpen}
              appointment={appointment}
              otherApts={otherApts}
              catalog={catalog}
              locationId={locationId}
              addressNote={addressNote}
              setAddressNote={setAddressNote}
              anonymousAddress={anonymousAddress}
              setAnonymousAddress={setAnonymousAddress}
              addressPlaceholder={addressPlaceholder}
              selectedLocation={selectedLocation}
              appointmentServices={appointmentServices}
              globalDiscount={globalDiscount}
              popularServices={popularServices}
              setAppointmentServices={setAppointmentServices}
              setGlobalDiscount={setGlobalDiscount}
              setAskClientFirst={setAskClientFirst}
              setServicePickerOpen={setServicePickerOpen}
              clientId={clientId}
              source={source}
              setSource={setSource}
              lastUsedSource={lastUsedSource}
              setLastUsedSource={setLastUsedSource}
              smsEnabled={smsEnabled}
              setSmsEnabled={setSmsEnabled}
              comment={comment}
              setComment={setComment}
              photos={photos}
              setPhotos={setPhotos}
              tenantId={tenantId}
              photoScrollRef={photoScrollRef}
              cancelFlag={cancelFlag}
              setCancelFlag={setCancelFlag}
              cancelReason={cancelReason}
              setCancelReason={setCancelReason}
              viewBlocks={
                liveMode === "view" ? (
                  <PaymentBlock total={appointment.total_amount} onPay={handlePay} />
                ) : null
              }
            />
          )}
        </div>

        {isEditable && !isEventMode && (
          <AppointmentSaveButton
            canSave={canSave}
            label={savePreviewLabel}
            onSave={handleCreate}
          />
        )}
      </div>

      {/* v625 §9 step 2 — all portal-level pickers/dialogs/overlays
          live in AppointmentSubSheets. State stays here; the wrapper
          just renders + forwards callbacks. */}
      <AppointmentSubSheets
        clientSheet={clientSheet}
        setClientSheet={setClientSheet}
        clients={clients}
        recentClientIds={recentClientIds}
        onClientSelect={(c) => {
          setClientId(c.id);
          const locs = c.locations;
          const primary = locs.find((l) => l.isPrimary) ?? locs[0] ?? null;
          setLocationId(primary?.id ?? null);
        }}
        servicePickerOpen={servicePickerOpen}
        setServicePickerOpen={setServicePickerOpen}
        catalog={catalog}
        categories={categories}
        activeTeam={activeTeam}
        appointmentServices={appointmentServices}
        onServicesConfirm={setAppointmentServices}
        client={client}
        closeConfirm={closeConfirm}
        setCloseConfirm={setCloseConfirm}
        liveMode={liveMode}
        canSave={canSave}
        onClose={onClose}
        onSaveAndClose={handleCreate}
        askClientFirst={askClientFirst}
        setAskClientFirst={setAskClientFirst}
        clientMenuOpen={clientMenuOpen}
        setClientMenuOpen={setClientMenuOpen}
        setClientProfileOpen={setClientProfileOpen}
        setSendMsgOpen={setSendMsgOpen}
        setRepeatSheetOpen={setRepeatSheetOpen}
        appointment={appointment}
        isEventMode={isEventMode}
        photos={photos}
        dateKey={dateKey}
        timeStart={timeStart}
        timeEnd={timeEnd}
        address={address}
        price={price}
        sendMsgOpen={sendMsgOpen}
        repeatSheetOpen={repeatSheetOpen}
        onRepeatConfirm={(months, note) => {
          if (!client) return;
          const serviceSummary = appointmentServices
            .map((l) => catalog.find((s) => s.id === l.serviceId)?.name)
            .filter((n): n is string => Boolean(n))
            .join(" · ");
          const supabase = getSupabaseBrowser();
          void createRecurringReminder(supabase, tenantId, {
            client_id: client.id,
            client_name: client.full_name,
            phone: client.phone ?? "",
            team_id: activeTeam?.id ?? null,
            service_ids: appointmentServices.map((l) => l.serviceId),
            service_summary: serviceSummary,
            last_date: appointment.date,
            interval_months: months,
            note,
          }).then(() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new Event("babun:recurring-changed"));
            }
          }).catch((err) => {
            console.warn("STORY-050: createRecurringReminder failed", err);
          });
        }}
        clientProfileOpen={clientProfileOpen}
      />

      <SegmentSwitchConfirmDialog
        open={segmentSwitchConfirm}
        onCancel={() => setSegmentSwitchConfirm(false)}
        onDiscard={() => {
          setSegmentSwitchConfirm(false);
          setEventFormDirty(false);
          setKind("work");
        }}
      />

      <TimePopup
        open={timePopupOpen}
        onClose={() => setTimePopupOpen(false)}
        liveMode={liveMode}
        isEventMode={isEventMode}
        isEditable={isEditable}
        readonly={readonly}
        activeTeam={activeTeam}
        dateKey={dateKey}
        timeStart={timeStart}
        timeEnd={timeEnd}
        totalDur={totalDur}
        durationTouched={durationTouched}
        liveDurationMins={liveDurationMins}
        setDateKey={setDateKey}
        setTimeStart={setTimeStart}
        setTimeEnd={setTimeEnd}
        applyDuration={applyDuration}
      />


      {/* Keep reference list silenced */}
      <div className="hidden">{CITY_LIST.length}</div>
    </div>
  );
}
