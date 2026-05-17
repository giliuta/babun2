"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  Check,
  Camera,
  CalendarClock,
} from "@babun/shared/icons";
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
import { servicesToIds, idsToServices } from "@/lib/appointment-services";
import {
  buildSavedWorkAppointment,
  buildCompletedAppointment,
} from "@/lib/appointment-builders";
// Beta #53 (CRM Core brief) — loyalty tier auto-apply on client pick.
import { loadLoyalty, tierForVisits } from "@babun/shared/local/loyalty";
import { getCityColor, CITY_LIST } from "@babun/shared/local/day-cities";
import { formatEUR } from "@babun/shared/common/utils/money";
import {
  appointmentTotal,
  totalDuration as calcDuration,
} from "@babun/shared/local/finance/appointment-calc";
import ClientPickerSheet from "@/components/appointments/sheet/ClientPickerSheet";
import ServicePickerSheet from "@/components/appointments/sheet/ServicePickerSheet";
import { IOSSwitch } from "@/components/ui";

import TimeBlock from "./TimeBlock";
import ClientBlock from "./ClientBlock";
import LocationsBlock from "./LocationsBlock";
import ServicesBlock from "./ServicesBlock";
import IncomeBlock from "./IncomeBlock";
import CommentBlock from "./CommentBlock";
import PhotoBlock from "./PhotoBlock";
import SourceBlock from "./SourceBlock";
import ClientHistoryStrip, { formatShortDate } from "./ClientHistoryStrip";
import OverlapWarning from "./OverlapWarning";
import EventForm from "@/components/event/EventForm";
import CancelToggleBlock from "./CancelToggleBlock";
import { CloseConfirmDialog, AskClientFirstDialog } from "./AppointmentConfirmDialogs";
import ClientActionMenu from "./ClientActionMenu";
import SendMessagePopup from "./SendMessagePopup";
import ClientProfileView from "@/components/clients/ClientProfileView";
import { useRouter } from "next/navigation";
import { loadChats } from "@babun/shared/local/chats";
import PaymentBlock from "./PaymentBlock";
import { buildShareUrl } from "@babun/shared/common/utils/share-link";
import { createRecurringReminder } from "@babun/shared/db/repositories/recurring-reminders";
import RepeatReminderSheet from "./RepeatReminderSheet";
import { loadCompany } from "@babun/shared/local/finance/company";
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
  const router = useRouter();
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
  // Beta #53 — track whether the current globalDiscount came from
  // the auto-apply path (so we can replace it on a client switch)
  // vs a manual edit (which wins and stays put).
  const [loyaltyApplied, setLoyaltyApplied] = useState<{
    clientId: string;
    percent: number;
  } | null>(null);
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
  const [bottomWarning, setBottomWarning] = useState<string | null>(null);
  const [askClientFirst, setAskClientFirst] = useState(false);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [sendMsgOpen, setSendMsgOpen] = useState(false);
  const [clientProfileOpen, setClientProfileOpen] = useState(false);
  const [repeatSheetOpen, setRepeatSheetOpen] = useState(false);

  // body scroll lock + ESC close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
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


  // Beta #53 (CRM Core brief) — auto-apply loyalty discount when
  // the operator picks a client. Reads tier on every clientId
  // change; replaces only auto-applied discounts so a manual edit
  // («скидка постоянному = 8%, индивидуально») is preserved.
  useEffect(() => {
    if (!visitsForClient || !clientId) {
      // Drop a stale auto-applied discount when the client is cleared.
      if (loyaltyApplied !== null) {
        setGlobalDiscount((current) =>
          current?.type === "percent" && current.value === loyaltyApplied.percent
            ? null
            : current,
        );
        setLoyaltyApplied(null);
      }
      return;
    }
    const visits = visitsForClient(clientId);
    const tier = tierForVisits(visits, loadLoyalty());
    if (!tier) {
      // Client doesn't qualify (or program is off) — drop the
      // previously auto-applied tier if any.
      if (loyaltyApplied !== null) {
        setGlobalDiscount((current) =>
          current?.type === "percent" && current.value === loyaltyApplied.percent
            ? null
            : current,
        );
        setLoyaltyApplied(null);
      }
      return;
    }
    // Apply the tier discount. Skip when the operator has already
    // typed a non-loyalty discount we shouldn't overwrite.
    setGlobalDiscount((current) => {
      const wasAutoApplied =
        loyaltyApplied?.clientId === clientId &&
        current?.type === "percent" &&
        current.value === loyaltyApplied.percent;
      if (!current || wasAutoApplied) {
        return {
          type: "percent",
          value: tier.percent,
          reason: tier.label,
        };
      }
      return current; // manual edit wins
    });
    setLoyaltyApplied({ clientId, percent: tier.percent });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, visitsForClient]);

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
  // Event mode uses eventLabel; work mode uses client + services + comment.
  const isDirty = isEditable && (isEventMode
    ? Boolean(eventLabel.trim())
    : Boolean(clientId || appointmentServices.length > 0 || comment.trim()));

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

        {/* Header */}
        <div className="flex-shrink-0 px-4 pb-2 flex items-center justify-between gap-2">
          {liveMode === "create" ? (
            personalMode ? (
              // Personal calendar — always event; no segment toggle.
              <div className="inline-flex items-center h-8 px-3 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] text-[13px] font-semibold">
                Личное событие
              </div>
            ) : (
              <div className="inline-flex rounded-[10px] bg-[var(--fill-tertiary)] p-1 text-[13px] font-semibold">
                {(["work", "event"] as Kind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`px-4 py-1.5 rounded-[8px] transition ${
                      kind === k
                        ? "bg-[var(--surface-card)] text-[var(--label)] shadow-[var(--shadow-card)]"
                        : "text-[var(--label-secondary)]"
                    }`}
                  >
                    {k === "work" ? "Клиент" : "Событие"}
                  </button>
                ))}
              </div>
            )
          ) : liveMode === "edit" ? (
            <div className="flex-1 text-[15px] font-semibold text-[var(--accent)]">
              Редактирование
            </div>
          ) : liveMode === "done" ? (
            <div className="flex-1 text-[13px] font-semibold text-[var(--system-green)] truncate">
              {doneBadge}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {/* Sprint 025 STORY-005 — one-tap shortcuts on open visits:
              ✓ complete, 📷 add photo, ↻ reschedule. They mirror the
              three actions the dispatcher reaches for most; the slower
              admin options still live in the ⋯ menu inside ClientBlock. */}
          {showQuickActions && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {onCompleteQuick && (
                <button
                  type="button"
                  onClick={() => onCompleteQuick(appointment)}
                  aria-label="Отметить выполненной"
                  title="Выполнено"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--system-green)] active:bg-[rgba(52,199,89,0.1)]"
                >
                  <Check size={20} strokeWidth={2.5} />
                </button>
              )}
              <button
                type="button"
                onClick={scrollToPhotos}
                aria-label="Перейти к фото"
                title="Фото"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--accent)] active:bg-[var(--accent-tint)]"
              >
                <Camera size={19} strokeWidth={2} />
              </button>
              {onReschedule && (
                <button
                  type="button"
                  onClick={() => onReschedule(appointment)}
                  aria-label="Перенести запись"
                  title="Перенести"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--system-orange)] active:bg-[rgba(255,149,0,0.1)]"
                >
                  <CalendarClock size={19} strokeWidth={2} />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={attemptClose}
            aria-label="Закрыть"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

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
              className={`ml-auto flex-shrink-0 inline-flex items-center gap-1.5 px-3 h-7 rounded-full text-[12px] font-semibold tabular-nums transition active:scale-[0.97] ${
                readonly
                  ? "bg-[var(--fill-tertiary)] text-[var(--label-secondary)] cursor-default"
                  : "bg-[var(--surface-card)] text-[var(--label)] border border-[var(--separator)] active:bg-[var(--fill-quaternary)]"
              }`}
              aria-label="Изменить время"
            >
              <CalendarClock size={12} strokeWidth={2} />
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
            />
          )}
          {!isEventMode && (
            <>
              {/* v607 P0 #1 — block order: critical inputs up top,
                  details collapsed. Order: Client → History →
                  Location → Services → Income → <details>. Source,
                  comment, photos, SMS, brigade live inside the
                  collapsible so an "20 sec on a scooter" booking
                  only touches the top half of the sheet. */}
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

              {/* Brief 1 #23 — last 5 past visits inline so dispatcher
                  sees prior work without leaving the sheet. */}
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

              {/* v607 P0 #1 — «Подробнее» collapsible. Closed by
                  default in create-mode to keep the form short.
                  Opened by default in view/edit so existing data is
                  visible without an extra tap. */}
              {isEditable ? (
                <details
                  className="group px-4 pt-3"
                  open={liveMode === "edit"}
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

                    <CommentBlock
                      value={comment}
                      readonly={readonly}
                      onChange={setComment}
                    />

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
                  <SourceBlock
                    value={source}
                    readonly={readonly}
                    onChange={setSource}
                  />
                  <CommentBlock
                    value={comment}
                    readonly={readonly}
                    onChange={setComment}
                  />
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

              {/* Readonly cancellation reason in view/done mode when
                  record is already cancelled. Reuses the same red tint
                  as the editable version below. */}
              {!isEditable && appointment.status === "cancelled" && (
                <div className="px-4 pt-3">
                  <div className="px-3 py-2 rounded-[14px] bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.2)] text-[13px] text-[var(--label)]">
                    <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--system-red)] mb-0.5">
                      Запись отменена
                    </div>
                    <div>
                      {appointment.cancel_reason?.trim() || "Причина не указана"}
                    </div>
                  </div>
                </div>
              )}

              {/* Cancel-appointment toggle. v607 P0 #2 — only relevant
                  for an existing record; in create mode we can't cancel
                  something that doesn't exist yet. Visible in edit mode
                  whenever the record isn't already completed. */}
              {appointment.status !== "completed" && liveMode === "edit" && (
                <CancelToggleBlock
                  cancelFlag={cancelFlag}
                  cancelReason={cancelReason}
                  onFlagChange={setCancelFlag}
                  onReasonChange={setCancelReason}
                />
              )}

            </>
          )}

          {/* View-mode payment entry (scheduled → completed).
              QuickActions + AdminActions removed — the ⋯ in the client
              header carries those actions, and Call lives in-line as
              the green phone icon. Every block stays visible so the
              user sees the full record at a glance. */}
          {liveMode === "view" && (
            <PaymentBlock total={appointment.total_amount} onPay={handlePay} />
          )}
        </div>

        {/* Sticky save: в create и в edit — single full-width button.
            Cancel lives as the header ✕; backdrop/Esc also prompt.
            v615 P1 §16 — backdrop-blur so scrolled content shows
            through softly instead of a hard cut.
            Sprint #4 P0 §4: hidden in event mode — EventForm has its
            own overlay and sticky footer. */}
        {isEditable && !isEventMode && (
          <div
            className="flex-shrink-0 px-4 pt-2 border-t border-[var(--separator)] sticky bottom-0 z-10 backdrop-blur-[12px]"
            style={{
              paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)",
              background: "color-mix(in srgb, var(--surface-card) 80%, transparent)",
            }}
          >
            {bottomWarning && (
              <div className="mb-2 px-3 py-2 rounded-[10px] bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.2)] text-[13px] font-semibold text-[var(--system-red)] text-center">
                {bottomWarning}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (!canSave) {
                  setBottomWarning("Заполните сначала данные");
                  window.setTimeout(() => setBottomWarning(null), 4000);
                  return;
                }
                handleCreate();
              }}
              data-testid="appointment-sheet-save"
              className={`w-full h-11 rounded-[10px] text-[15px] font-semibold transition ${
                canSave
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)] active:scale-[0.99]"
                  : "bg-[var(--fill-primary)] text-[var(--label-tertiary)]"
              }`}
            >
              {savePreviewLabel}
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
          const locs = c.locations;
          const primary = locs.find((l) => l.isPrimary) ?? locs[0] ?? null;
          setLocationId(primary?.id ?? null);
          setClientSheet(false);
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
        initialSelectedIds={servicesToIds(appointmentServices)}
        onConfirm={(ids) => {
          setAppointmentServices(
            idsToServices(ids, catalog, appointmentServices)
          );
        }}
        clientName={client?.full_name ?? null}
        clientPhone={client?.phone ?? null}
      />

      <CloseConfirmDialog
        open={closeConfirm}
        mode={liveMode}
        canSave={canSave}
        onCancel={() => setCloseConfirm(false)}
        onDiscard={() => {
          setCloseConfirm(false);
          onClose();
        }}
        onSave={() => {
          if (!canSave) return;
          handleCreate();
          setCloseConfirm(false);
        }}
      />

      <AskClientFirstDialog
        open={askClientFirst}
        onCancel={() => setAskClientFirst(false)}
        onContinue={() => {
          setAskClientFirst(false);
          setServicePickerOpen(true);
        }}
        onPickClient={() => {
          setAskClientFirst(false);
          setClientSheet(true);
        }}
      />

      {/* v617 P1 §17 — time popup. Hosts the full date+time+duration
          editing surface: quick chips, TimeBlock wheels, duration
          chip row. State is mutated live by inner editors so closing
          is a no-op (no commit/cancel split). */}
      {timePopupOpen && (
        <div
          className="fixed inset-0 z-[92] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
          onClick={() => setTimePopupOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between border-b border-[var(--separator)]">
              <span className="text-[13px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Время записи
              </span>
              <button
                type="button"
                onClick={() => setTimePopupOpen(false)}
                className="px-3 h-8 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.99]"
              >
                Готово
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pb-3">
              {liveMode === "create" && !isEventMode && (
                <div className="px-4 pt-3 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                  {(() => {
                    const step = activeTeam?.default_slot_minutes ?? 30;
                    const dur = totalDur > 0 ? totalDur : step;
                    const fmtKey = (d: Date) =>
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                    const fmtTime = (mins: number) => {
                      const clamped = Math.min(23 * 60 + 59, Math.max(0, mins));
                      return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
                    };
                    const apply = (d: Date, startMin: number) => {
                      setDateKey(fmtKey(d));
                      setTimeStart(fmtTime(startMin));
                      setTimeEnd(fmtTime(startMin + dur));
                    };
                    const now = new Date();
                    const nowMins = now.getHours() * 60 + now.getMinutes();
                    const nextSlot = Math.ceil((nowMins + 1) / step) * step;
                    const tomorrow = new Date(now);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    const chips = [
                      { label: "⚡ Сейчас", onClick: () => apply(now, nextSlot) },
                      { label: "Через час", onClick: () => apply(now, nextSlot + 60) },
                      { label: "Завтра", onClick: () => apply(tomorrow, 9 * 60) },
                    ];
                    return chips.map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        onClick={c.onClick}
                        className="flex-shrink-0 px-3 h-8 rounded-full text-[13px] font-semibold bg-[var(--fill-tertiary)] text-[var(--label)] border border-[var(--separator)] active:scale-[0.97]"
                      >
                        {c.label}
                      </button>
                    ));
                  })()}
                </div>
              )}

              <TimeBlock
                date={dateKey}
                timeStart={timeStart}
                timeEnd={timeEnd}
                readOnly={readonly}
                stepMinutes={
                  !isEventMode ? activeTeam?.default_slot_minutes : undefined
                }
                onChange={({ date: d, timeStart: s, timeEnd: e }) => {
                  setDateKey(d);
                  setTimeStart(s);
                  setTimeEnd(e);
                }}
              />

              {isEditable && !isEventMode && (
                <div
                  className="px-4 pt-3 flex items-center gap-1.5 overflow-x-auto"
                  style={{ scrollbarWidth: "none" }}
                >
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] flex-shrink-0 mr-1">
                    Длит.
                  </span>
                  {[30, 60, 90, 120].map((m) => {
                    const active = liveDurationMins === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => applyDuration(m)}
                        className={`flex-shrink-0 px-3 h-8 rounded-full text-[13px] font-semibold transition active:scale-[0.97] tabular-nums ${
                          active
                            ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                            : "bg-[var(--fill-tertiary)] text-[var(--label)] border border-[var(--separator)]"
                        }`}
                      >
                        {m}м
                      </button>
                    );
                  })}
                  {durationTouched && ![30, 60, 90, 120].includes(liveDurationMins) && (
                    <span className="flex-shrink-0 px-3 h-8 inline-flex items-center rounded-full text-[13px] font-semibold bg-[var(--accent)] text-[var(--label-on-accent)] tabular-nums">
                      {liveDurationMins}м
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {client && (
        <ClientActionMenu
          open={clientMenuOpen}
          onClose={() => setClientMenuOpen(false)}
          client={client}
          onProfile={() => setClientProfileOpen(true)}
          onSendMessage={() => setSendMsgOpen(true)}
          onOpenChat={() => {
            const existing = loadChats().find((ch) => ch.client_id === client.id);
            if (existing) {
              router.push(`/dashboard/chats?chat_id=${existing.id}`);
            } else {
              router.push(`/dashboard/chats?client_id=${client.id}`);
            }
          }}
          onShare={async () => {
            const parts = [client.full_name];
            if (client.phone) parts.push(client.phone);
            const text = parts.join(" · ");
            if (typeof navigator !== "undefined" && navigator.share) {
              try {
                await navigator.share({ title: client.full_name, text });
              } catch {
                // user dismissed
              }
            } else if (typeof navigator !== "undefined" && navigator.clipboard) {
              try {
                await navigator.clipboard.writeText(text);
              } catch {
                // ignore
              }
            }
          }}
          onScheduleRepeat={
            appointment.status === "completed" && !isEventMode && client
              ? () => setRepeatSheetOpen(true)
              : undefined
          }
          onDownloadInvoice={
            appointment.status === "completed" && !isEventMode && client
              ? async () => {
                  // Dynamic import keeps jspdf (+ renderer) out of the
                  // initial bundle. First tap incurs a one-off chunk
                  // load; subsequent taps are cached.
                  const { generateInvoicePDF, downloadBlob } = await import(
                    "@babun/shared/local/finance/invoice"
                  );
                  const { blob, filename } = generateInvoicePDF({
                    appointment,
                    client,
                    services: catalog,
                    team: activeTeam,
                    company: loadCompany(),
                    includePhotos: photos.length > 0,
                  });
                  downloadBlob(blob, filename);
                }
              : undefined
          }
          onShareAppointment={
            liveMode === "create" || isEventMode
              ? undefined
              : async () => {
                  const serviceNames = appointmentServices
                    .map((l) => catalog.find((s) => s.id === l.serviceId)?.name)
                    .filter((n): n is string => Boolean(n));
                  const origin =
                    typeof window !== "undefined" ? window.location.origin : "";
                  const url = buildShareUrl(origin, {
                    d: dateKey,
                    ts: timeStart,
                    te: timeEnd,
                    c: client.full_name,
                    s: serviceNames,
                    a: address || undefined,
                    b: activeTeam?.name,
                    t: Math.round(price),
                    st: appointment.status,
                  });
                  const title = `Запись ${dateKey} · ${timeStart}`;
                  if (typeof navigator !== "undefined" && navigator.share) {
                    try {
                      await navigator.share({ title, url });
                      return;
                    } catch {
                      // user dismissed — fall through to clipboard.
                    }
                  }
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    try {
                      await navigator.clipboard.writeText(url);
                      toast.show({
                        variant: "success",
                        message: "Ссылка скопирована — отправьте клиенту",
                      });
                    } catch {
                      toast.show({
                        variant: "error",
                        message: "Не удалось скопировать. Скопируйте вручную в адресной строке.",
                      });
                    }
                  } else {
                    toast.show({
                      variant: "error",
                      message: "Копирование не поддерживается в этом браузере.",
                    });
                  }
                }
          }
        />
      )}

      {client && (
        <SendMessagePopup
          open={sendMsgOpen}
          onClose={() => setSendMsgOpen(false)}
          phone={client.phone ?? null}
          clientName={client.full_name}
        />
      )}

      {client && (
        <RepeatReminderSheet
          open={repeatSheetOpen}
          clientName={client.full_name}
          serviceSummary={appointmentServices
            .map((l) => catalog.find((s) => s.id === l.serviceId)?.name)
            .filter(Boolean)
            .join(" · ")}
          lastDate={appointment.date}
          onClose={() => setRepeatSheetOpen(false)}
          onConfirm={(months, note) => {
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
        />
      )}

      {/* Client profile overlay — rendered on top of the appointment
          sheet so picking ⋯ → Профиль doesn't navigate away. Tapping
          ← inside closes the overlay and leaves the draft intact. */}
      {clientProfileOpen && client && (
        <div
          className="fixed inset-0 z-[95] bg-[var(--surface-overlay)] backdrop-blur-[2px] flex items-center justify-center p-2"
          onClick={() => setClientProfileOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden"
            style={{ height: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <ClientProfileView
              clientId={client.id}
              onBack={() => setClientProfileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Keep reference list silenced */}
      <div className="hidden">{CITY_LIST.length}</div>
    </div>
  );
}
