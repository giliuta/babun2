"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type {
  Appointment,
  AppointmentPayment,
  // STORY-049 — AppointmentPhoto removed from imports; the sheet
  // hydrates `AppointmentPhotoRecord[]` from the appointment-photos
  // repo on open.
  AppointmentService,
  Discount,
} from "@babun/shared/local/appointments";
import { loadAppointments } from "@babun/shared/local/appointments";
import {
  listPhotosForAppointment,
  type AppointmentPhotoRecord,
} from "@babun/shared/db/repositories/appointment-photos";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  useClients,
  useTenantId,
} from "@/components/layout/DashboardClientLayout";
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
import { useScrollFocusIntoView } from "@/hooks/useScrollFocusIntoView";
import { getCityColor } from "@babun/shared/local/day-cities";
import { ALL_DAY_START, ALL_DAY_END } from "@/lib/time-block-utils";
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
import UnifiedTimePopup from "./UnifiedTimePopup";
import TimeSummaryRow from "./TimeSummaryRow";
import AppointmentHeader from "./AppointmentHeader";
import AppointmentSaveButton from "./AppointmentSaveButton";
import { createRecurringReminder } from "@babun/shared/db/repositories/recurring-reminders";
import { computeClientLtv } from "@/lib/clients/ltv";
// jspdf + invoice builder are heavy (~350 kB combined). Load them on
// demand when the dispatcher actually taps "Скачать счёт" instead of
// shipping the module in the main dashboard bundle.

export type AppointmentSheetMode = "create" | "edit";

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
  /** STORY audit (design-keeper unification): PersonalEventSheet supplied
   *  this so the operator could delete a personal event from inside the
   *  edit-sheet. AppointmentSheet hadn't needed it (work records use
   *  onCancelAppointment to flip status to cancelled, not hard-delete),
   *  so we now pipe through optional onDelete used only by the
   *  EventForm branch. Parent uses deleteAppointment for personal
   *  events and upsertAppointment(...status="cancelled") for work. */
  onDelete?: (apt: Appointment) => void;
}

type Kind = "work" | "event";

// Единый экран записи. ОДИН layout для создания и для всех
// существующих записей (inline-редактирование). Внешний слой —
// bottom sheet 92vh. Различие режимов только в шапке (create → таб
// Клиент/Событие; existing → текстовый статус) и в том, что блок
// оплаты + действия появляются только после создания. Нижняя кнопка
// «Создать»/«Сохранить» всегда на одном месте.
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
  onReschedule,
  onDelete,
  personalMode = false,
}: AppointmentSheetProps) {
  const toast = useToast();
  // v699 — tag list lives in DashboardClientLayout context; ClientBlock
  // uses it to color the dot on recent-client chips and on the filled
  // card. Cheap context read, no fetch.
  const { tags: clientTags } = useClients();
  // Локальный mode-state: create или edit. Зеркалит проп `mode`.
  const [liveMode, setLiveMode] = useState<AppointmentSheetMode>(mode);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setLiveMode(mode), [mode, appointment.id]);

  // iOS PWA keyboard fix — «когда начинаю писать текст, оно всё
  // смещается». Корень: overlay это `position: fixed` относительно
  // LAYOUT viewport. На open keyboard iOS скроллит VISUAL viewport
  // (и микро-скроллит на каждый каретко-сдвиг / переключение строки
  // подсказок), а fixed-элемент уезжает вместе с ним. Лечим тем, что
  // ПРИБИВАЕМ overlay к visual viewport: height = vv.height,
  // translateY = vv.offsetTop. Тогда overlay всегда строго над
  // клавиатурой и не дрейфует — sheet внутри остаётся статичным. На
  // десктопе и Android Chrome vv совпадает с innerHeight (offsetTop=0)
  // → no-op, полноэкранный overlay + 92vh sheet как раньше.
  const [viewport, setViewport] = useState<{
    height: number;
    offsetTop: number;
    keyboard: boolean;
  } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      // iOS keeps window.innerHeight at the LAYOUT-viewport height while
      // the keyboard only shrinks visualViewport.height — so the delta is
      // the keyboard inset. >100 px ⇒ keyboard is up.
      const keyboardInset = window.innerHeight - vv.height;
      setViewport({
        height: vv.height,
        offsetTop: vv.offsetTop,
        keyboard: keyboardInset > 100,
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  // Keyboard CLOSED → 92 vh centered dialog (unchanged look). Keyboard
  // OPEN → fill the visible viewport (minus the overlay's 8 px padding
  // each side) instead of shrinking to 92 % of the already-reduced
  // height and floating centered — that was the «всё
  // уменьшается/сдвигается» bug while typing into the address form. A
  // full-height sheet gives the scroll body max room so the focused
  // input (and its Save/Cancel) scroll above the keyboard.
  // v755 — full-screen: always fill the entire visual viewport.
  // The 92-vh centered dialog look is replaced by a full-page sheet.
  // On iOS keyboard open, `viewport.height` shrinks to the area above
  // the keyboard — we fill that exactly, no extra reduction needed.
  const sheetHeight = viewport
    ? `${Math.max(320, Math.floor(viewport.height))}px`
    : "100dvh";

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
  const [cancelFlag, setCancelFlag] = useState(appointment.status === "cancelled");
  const [cancelReason, setCancelReason] = useState(appointment.cancel_reason ?? "");
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
  // v657 — EventForm now renders inline (bodyOnly), so AppointmentSheet's
  // own save button drives both work AND event modes. We need a way to
  // (a) trigger EventForm.handleSave from outside, and (b) know whether
  // the event form has enough data to save. eventSubmitRef + eventCanSave
  // give us both, via the new EventForm props.
  // v669 — submit ref now returns boolean so AppointmentSaveButton
  // can release its «Сохраняем…» lock when EventForm.handleSave
  // refuses to save (canSave=false at fire time).
  const eventSubmitRef = useRef<(() => boolean) | null>(null);
  const [eventCanSave, setEventCanSave] = useState(false);
  // v708 — single colour source for the whole sheet. `eventColorOverride`
  // (declared below) is now the one nullable accent state, shared by the
  // header palette (both modes), the EventForm body, and the work-record
  // save path. The previous always-non-null `eventColor` mirror was
  // dropped — null now cleanly means «no colour picked» so the whole-form
  // tint stays off until the operator chooses one.
  // v667 — swipe-down close removed; refs no longer needed. The only
  // close paths are now: ✕ in header (→ attemptClose → always-confirm
  // popup) and Esc key (→ useBodyScrollLock hook). Eliminates the
  // gesture conflict that the user reported as «вылетает при листании».
  // v660 — keyboard occlusion fix: scroll focused inputs into view
  // when iOS keyboard rises. See useScrollFocusIntoView for rationale.
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  useScrollFocusIntoView(scrollBodyRef);
  // STORY-049 — photos hydrate from Supabase Storage via the
  // appointment-photos repo (effect below). Initial render shows
  // an empty list; thumbnails fade in once the fetch resolves.
  const [photos, setPhotos] = useState<AppointmentPhotoRecord[]>([]);
  const tenantId = useTenantId();
  const [eventLabel, setEventLabel] = useState(appointment.comment || "");
  // v616 P2 — operator-picked event accent override. null = derive from
  // the preset name (legacy behaviour). When set, beats the preset's
  // intrinsic colour on save.
  const [eventColorOverride, setEventColorOverride] = useState<string | null>(
    appointment.color_override ?? null,
  );
  // Block-2 — «весь день» flag shared by the time row + popup. Init
  // from the saved record; reset alongside the other fields below.
  const [allDay, setAllDay] = useState<boolean>(
    appointment.event_all_day ?? false,
  );
  const [clientSheet, setClientSheet] = useState(false);
  // v722 — when true, the client picker opens straight into the «new
  // client» form (quick «+ Новый» on the form).
  const [clientSheetCreate, setClientSheetCreate] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);

  // v755 — auto-open guiding popups: on create, client picker pops
  // immediately; once a client is chosen, service picker pops next.
  // One-shot per sheet open (autoFlowRef guards re-trigger).
  const autoFlowRef = useRef<{ clientOpened: boolean; servicesOpened: boolean }>({
    clientOpened: false,
    servicesOpened: false,
  });

  // Reset the auto-flow guard when the sheet closes.
  useEffect(() => {
    if (!open) {
      autoFlowRef.current = { clientOpened: false, servicesOpened: false };
    }
  }, [open]);

  // Step 1: open client picker immediately on create when no client yet.
  // Uses `kind` directly because `isEventMode` is derived below this block.
  useEffect(() => {
    if (!open) return;
    if (liveMode !== "create" || kind === "event") return;
    if (!autoFlowRef.current.clientOpened && !clientId) {
      autoFlowRef.current.clientOpened = true;
      setClientSheetCreate(false);
      setClientSheet(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, liveMode, kind, clientId]);

  // Step 2: once client is chosen and no services yet, open service picker.
  useEffect(() => {
    if (!open) return;
    if (liveMode !== "create" || kind === "event") return;
    if (
      clientId &&
      !autoFlowRef.current.servicesOpened &&
      appointmentServices.length === 0
    ) {
      autoFlowRef.current.servicesOpened = true;
      setServicePickerOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, liveMode, kind, clientId, appointmentServices.length]);
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
  //
  // STORY audit (tester 1.4): раньше form-reset эффект зависел от
  // [open, appointment] — любая смена `appointment` prop reference
  // (включая realtime UPDATE от Supabase того же id) триггерила reset
  // и WIPE всех несохранённых полей. Сейчас reset происходит только
  // когда меняется appointment.id (другая запись выбрана) или open
  // переключается с false на true. Realtime обновление того же id
  // больше НЕ затирает unsaved draft. Если коллеге надо merge
  // удалённых изменений, мы покажем banner-mismatch позднее (next-
  // step), но silent wipe лучше чем silent wipe.
  const lastAppointmentIdRef = useRef<string | null>(null);
  // Form-reset block — 18 setters batch into one re-render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      lastAppointmentIdRef.current = null;
      return;
    }
    // Skip reset if we're already mounted on the same appointment.id —
    // this is a realtime echo, not a different record.
    if (lastAppointmentIdRef.current === appointment.id) return;
    lastAppointmentIdRef.current = appointment.id;
    setTimeStart(appointment.time_start);
    setTimeEnd(appointment.time_end);
    setDateKey(appointment.date);
    setClientId(appointment.client_id);
    setLocationId(appointment.location_id);
    setComment(appointment.comment);
    setAddressNote(appointment.address_note ?? "");
    setCancelFlag(appointment.status === "cancelled");
    setCancelReason(appointment.cancel_reason ?? "");
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
    setAllDay(appointment.event_all_day ?? false);
    setDurationTouched(false);
    setAppointmentServices(appointment.services ?? []);
    setGlobalDiscount(appointment.global_discount ?? null);
    setKind(
      appointment.kind === "event" || appointment.kind === "personal"
        ? "event"
        : "work"
    );
  }, [open, appointment]);
  /* eslint-enable react-hooks/set-state-in-effect */

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

  // Client is required, so the address always comes from the picked
  // client location (falls back to the stored value when editing).
  const address = selectedLocation?.address ?? appointment.address ?? "";

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
  // STORY audit (tester 3.1): добавлен toast-warning когда clamp
  // реально произошёл — раньше total_duration (например 90 мин)
  // расходился с визуальной длиной блока (29 мин), и оператор не
  // видел этого.
  useEffect(() => {
    if (!isEditable || kind === "event") return;
    if (durationTouched) return;
    if (totalDur <= 0) return;
    const [sh, sm] = timeStart.split(":").map(Number);
    const [eh, em] = timeEnd.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const wanted = startMin + totalDur;
    const requiredEnd = Math.min(23 * 60 + 59, wanted);
    if (requiredEnd > endMin) {
      const nh = Math.floor(requiredEnd / 60);
      const nm = requiredEnd % 60;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeEnd(`${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`);
      if (wanted > requiredEnd) {
        toast.show({
          variant: "info",
          message:
            "Запись выходит за полночь — обрезана до 23:59. Создайте вторую запись на следующий день для остатка.",
          durationMs: 5000,
        });
      }
    }
  }, [isEditable, kind, totalDur, timeStart, timeEnd, durationTouched, toast]);

  // Block-2 — «весь день»: snap to a full day so calendar blocks still
  // position. Remember the time set before turning it on, and restore
  // exactly that when turning it off (instead of a default slot).
  const preAllDayTimeRef = useRef<{ start: string; end: string } | null>(null);
  const handleAllDayChange = (next: boolean) => {
    if (next) {
      if (!allDay) preAllDayTimeRef.current = { start: timeStart, end: timeEnd };
      setAllDay(true);
      setTimeStart(ALL_DAY_START);
      setTimeEnd(ALL_DAY_END);
    } else {
      setAllDay(false);
      const prev = preAllDayTimeRef.current;
      setTimeStart(prev?.start ?? "10:00");
      setTimeEnd(prev?.end ?? "11:00");
    }
  };

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

  // photoScrollRef lets the PhotoBlock scroll itself into view when the
  // keyboard opens / on focus.
  const photoScrollRef = useRef<HTMLDivElement | null>(null);

  // Client stats for the filled-card stats row in ClientBlock.
  // Computed once when client or appointment list changes. Uses all
  // appointments (otherApts + current) so the count is accurate even
  // for the appointment being viewed right now.
  const clientStats = useMemo(() => {
    if (!clientId) return undefined;
    const allApts = [
      ...otherApts,
      // Include the current appointment if it is completed so LTV is current.
      ...(appointment.status === "completed" ? [appointment] : []),
    ];
    const raw = computeClientLtv(clientId, allApts);
    return {
      visits: raw.visits,
      earned: raw.ltv,
      lastVisitDate: raw.lastVisitDate,
    };
  }, [clientId, otherApts, appointment]);

  // STORY audit: до этого аудита для work-записи требовался И клиент,
  // И услуга. Из-за этого AskClientFirstDialog с кнопкой «Без клиента»
  // приводил в тупик — диспетчер выбирает услугу без клиента, кнопка
  // «Создать» grey'ит навсегда, и непонятно почему. Теперь клиент
  // опционален для черновика: запись с услугой и временем валидна,
  // клиента можно прикрепить позже (типичный сценарий — звонок при
  // ремонтe «приду чуть позже, тогда скажу кто»). savePreviewLabel
  // всё равно подсказывает «без клиента — добавьте позже» когда
  // клиент не выбран.
  // v657 — in event mode, canSave is driven by EventForm via the
  // onCanSaveChange callback (EventForm owns the event title state).
  // In work mode, the AppointmentSheet's own services list drives it.
  const canSave = isEventMode
    ? eventCanSave
    : appointmentServices.length > 0 && clientId != null;

  // v607 P0 #1.8 — live preview button text. Shows date · time ·
  // duration · price when ready; lists what's missing otherwise so the
  // operator doesn't have to scroll up to find the gap.
  //
  // v657 — event mode now polls EventForm via eventCanSave (since
  // EventForm owns the title state when rendered bodyOnly). When
  // eventCanSave is false → "название" missing.
  const missingParts: string[] = [];
  if (!isEventMode) {
    if (!clientId) missingParts.push("клиента");
    if (appointmentServices.length === 0) missingParts.push("услугу");
  } else if (!eventCanSave) {
    missingParts.push("название");
  }
  const savePreviewLabel = (() => {
    if (isEventMode) {
      if (!canSave) {
        return missingParts.length > 0
          ? `Заполните: ${missingParts.join(", ")} →`
          : (liveMode === "edit" ? "Сохранить событие" : "Создать событие");
      }
      return liveMode === "edit" ? "Сохранить событие" : "Создать событие";
    }
    // Work mode — always show the live итог; ✓ appears only once the
    // record can actually be saved. Missing parts move to the tap nudge.
    const shortDate = formatShortDate(dateKey);
    const verb = liveMode === "edit" ? "Сохранить" : "Создать";
    const parts: string[] = [`${shortDate} ${timeStart}`];
    if (totalDur > 0) parts.push(`${totalDur}мин`);
    if (price > 0) parts.push(formatEUR(price));
    const summary = `${verb} · ${parts.join(" · ")}`;
    return canSave ? `✓ ${summary}` : summary;
  })();
  const incompleteHint =
    missingParts.length > 0
      ? `Заполните: ${missingParts.join(", ")}`
      : "Заполните сначала данные";

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
  // v657 — EventForm now owns the title/notes/url/place/push/repeat
  // state when rendered bodyOnly. Reuse its own dirty signal instead
  // of re-deriving from AppointmentSheet's now-stale eventLabel /
  // eventColorOverride mirrors.
  const workDirty = !isEventMode && (
    isCreate
      ? Boolean(
          clientId ||
          appointmentServices.length > 0 ||
          comment.trim() ||
          addressNote.trim() ||
          globalDiscount !== null,
        )
      : Boolean(
          clientId !== appointment.client_id ||
          comment.trim() !== (appointment.comment ?? "").trim() ||
          addressNote.trim() !== (appointment.address_note ?? "").trim() ||
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

  if (!open) return null;

  // ─── Handlers ─────────────────────────────────────────────────────

  // v667 — user explicit rule: «Заявку закрыть нельзя, если нажать
  // крестик вылазит всегда поп ап сохранить не сохранять и отмена».
  // The dirty-guard fast-path is removed. Every tap on ✕ opens the
  // CloseConfirmDialog with three branches:
  //   • Сохранить — call save if canSave; else show warning chip
  //   • Не сохранять — close without persisting
  //   • Отмена — dismiss popup, stay on sheet
  // Prevents the «accidentally closed and lost it» class of bug
  // entirely. The cost is one extra tap on a no-edit close, which
  // the user explicitly accepted.
  const attemptClose = () => {
    setCloseConfirm(true);
  };

  // Event-mode branch is DEAD CODE since EventForm.onSave routes events
  // directly — isEventMode is always false here (EventForm owns its own
  // submit path). Work mode only.
  // v669 — returns boolean so AppointmentSaveButton can release the
  // submit lock when the save is rejected. `appointmentServices.length`
  // check stays (canSave already enforces it; this is belt-and-braces).
  // The `!client` early-return is GONE — anonymous drafts now save
  // properly (see buildSavedWorkAppointment v669 comment).
  const handleCreate = (): boolean => {
    if (appointmentServices.length === 0) return false;
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
      source: appointment.source ?? null,
      cancelFlag,
      cancelReason,
      smsEnabled: appointment.reminder_enabled,
      liveMode,
      colorOverride: eventColorOverride,
      allDay,
    });
    onSave(saved);
    return true;
  };

  const handlePay = (payment: AppointmentPayment) => {
    onSave(buildCompletedAppointment(appointment, payment));
    onClose();
  };

  // v671 — emoji removed per CLAUDE.md "no emojis" rule. AppointmentHeader
  // already renders the badge in `text-[var(--system-green)]` so the
  // «успешно завершено» visual cue is preserved by colour alone.
  // (Replacing emoji with @babun/shared/icons components would require
  // changing the AppointmentHeader prop shape from string to ReactNode;
  // simpler to drop the decoration since text + colour suffices.)
  // Header status label for EXISTING records (create shows the
  // Клиент/Событие tabs instead). Same slot, just text + tone — so the
  // layout never changes between view and edit, only the wording.
  const headerStatus = ((): { text: string; tone: "accent" | "green" | "red" } | null => {
    if (liveMode === "create") return null;
    if (appointment.status === "completed") {
      const p = appointment.payment;
      const text = !p
        ? "Выполнено"
        : p.method === "cash"
          ? `Выполнено · нал · ${formatEUR(p.cashAmount)}`
          : p.method === "card"
            ? `Выполнено · карта · ${formatEUR(p.cardAmount)}`
            : p.method === "split"
              ? `Выполнено · нал ${formatEUR(p.cashAmount)} + карта ${formatEUR(p.cardAmount)}`
              : `Выполнено · счёт компании · ${formatEUR(appointment.total_amount)}`;
      return { text, tone: "green" };
    }
    if (appointment.status === "cancelled") return { text: "Отменена", tone: "red" };
    return { text: "Редактирование", tone: "accent" };
  })();

  // STORY audit: dialog label depends on liveMode so screen readers
  // announce the sheet's purpose (create draft vs viewing existing
  // record) the moment focus lands.
  const dialogLabel = isEventMode
    ? liveMode === "create"
      ? "Новое событие"
      : "Событие"
    : liveMode === "create"
      ? "Новая запись"
      : "Запись клиента";

  return (
    <div
      // STORY audit (user critical): backdrop tap closed the sheet
      // even with attemptClose's dirty-guard — confirm dialogs sometimes
      // got missed под другими z-стеками, sheet просто закрывался и
      // оператор терял ввод. Пользователь явно сказал «не должно
      // закрываться при тапе мимо». Backdrop close убран. Закрытие
      // только через явную кнопку ✕ или swipe-down (тоже идёт через
      // attemptClose). Esc на keyboard через useBodyScrollLock тоже
      // работает.
      className="fixed inset-x-0 z-[70] flex bg-[var(--surface-overlay)] backdrop-blur-[2px] p-0"
      // Pin to the visual viewport (iOS keyboard fix — see `viewport`
      // effect above). `top` follows vv.offsetTop so the overlay never
      // drifts when the keyboard scrolls the page; height follows
      // vv.height so the sheet + footer stay above the keyboard.
      //
      // IMPORTANT: we use `top`, NOT `transform`. A CSS transform on
      // this overlay would make it the containing block for every
      // `position: fixed` descendant — the client picker, service
      // picker and confirm dialogs (DialogModal is `fixed inset-0` and
      // renders inside this overlay, not via a body portal). That would
      // mis-position those sub-sheets («всё ломается»). `top` repositions
      // without creating a containing block. Fallback 100dvh / top:0 on
      // first paint and on browsers without visualViewport.
      style={{
        top: viewport ? `${viewport.offsetTop}px` : 0,
        height: viewport ? `${viewport.height}px` : "100dvh",
      }}
    >
      <div
        // STORY-056 — desktop cap at 720 px so the modal reads as a
        // proper dialog instead of a fullscreen takeover on a 1080-px
        // monitor (92 vh = 994 px). Mobile keeps 92 vh.
        // v617 P1 §20 — swipe-down dirty-guard: drag the sheet
        // downward by ≥90 px while the body is scrolled to the top
        // and we route through attemptClose (same as backdrop/Esc).
        // STORY audit: role="dialog" + aria-modal so assistive tech
        // recognises this as a modal surface (previous version was a
        // bare div with no a11y semantics — VoiceOver/TalkBack just saw
        // a generic group).
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        className="w-full bg-[var(--surface-card)] shadow-[var(--shadow-sheet)] flex flex-col"
        // STORY audit: height теперь следует за visualViewport (iOS
        // keyboard fix). Раньше было фиксированное 92vh — sticky
        // footer уезжал за клавиатуру при фокусе в textarea / поиск.
        // v708 — when the operator picks an accent colour, wash the whole
        // sheet in a faint (8 %) tint of it. Layered over the solid
        // surface-card so the base stays opaque (no dark backdrop bleed)
        // and inner white cards float on the coloured «paper». null →
        // no inline background → falls back to the className white.
        style={{
          height: sheetHeight,
          background:
            eventColorOverride && /^#[0-9a-fA-F]{6}$/.test(eventColorOverride)
              ? `linear-gradient(0deg, ${eventColorOverride}14, ${eventColorOverride}14), var(--surface-card)`
              : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
        // v667 — swipe-down-close gesture REMOVED. User reported:
        // «когда листаю оформление заявки вниз и вверх оно вылетает».
        // Root cause: when scrollTop reaches 0 from a scrolled-down
        // position and the user continues the upward finger gesture,
        // the swipe-down close accumulates downward delta and fires
        // close at 90 px. The armedScroller disarm logic was a partial
        // mitigation but didn't catch the «at-top-and-keep-pulling»
        // case. Close is now ONLY via the explicit ✕ button (which
        // always shows the Save/Don't save/Cancel confirm). One fewer
        // gesture, one less data-loss path.
      >

        <AppointmentHeader
          liveMode={liveMode}
          personalMode={personalMode}
          kind={kind}
          eventFormDirty={eventFormDirty}
          workDirty={workDirty}
          status={headerStatus}
          setKind={setKind}
          setSegmentSwitchConfirm={setSegmentSwitchConfirm}
          attemptClose={attemptClose}
          colorValue={eventColorOverride}
          onColorChange={isEditable ? setEventColorOverride : undefined}
        />

        {/* Scroll body */}
        <div ref={scrollBodyRef} className="flex-1 min-h-0 overflow-y-auto pb-4" data-appt-scroll>
          {/* City/team caption + v617 P1 §17 single time chip. Chip
              shows date · time · duration and opens the time popup on
              tap. City is still edited from the calendar day header. */}
          <div
            className={`px-4 py-2 border-b border-[var(--separator)] flex items-center gap-2 text-[13px] flex-wrap ${
              eventColorOverride ? "" : "bg-[var(--surface-grouped)]"
            }`}
          >
            {/* Caption shows the team colour dot + team name only.
                City word removed per design-cleanup task. The dot
                still uses cityColor as fallback when the team has no
                brand colour (single-brigade setups). */}
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: activeTeam?.color ?? cityColor }}
              aria-hidden="true"
            />
            <span className="text-[var(--label)] flex-shrink-0">{teamLabel}</span>
          </div>

          {/* Block 2 — shared date/time row. Tap opens UnifiedTimePopup;
              «весь день» toggle on the right. Event-mode renders its own
              copy inside EventForm (commit 3). */}
          {!isEventMode && (
            <TimeSummaryRow
              dateKey={dateKey}
              timeStart={timeStart}
              timeEnd={timeEnd}
              allDay={allDay}
              showAllDay={isEditable}
              readonly={readonly}
              onOpen={() => setTimePopupOpen(true)}
              onAllDayChange={handleAllDayChange}
            />
          )}

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

          {/* v657 — Event mode body. EventForm renders INLINE (bodyOnly)
              inside this scroll body — no second modal overlay. The
              outer AppointmentSheet keeps its segment toggle (Клиент /
              Событие), its date/city/time chip, and provides the
              single save button at the bottom. Switching the segment
              back to «Клиент» swaps the inline body without unmounting
              the sheet, so the user never sees a "вылетает" flash.
              v658 — also render in view mode (readonly) so tapping an
              existing event opens a populated body, not a blank sheet. */}
          {isEventMode && (
            <EventForm
              open
              bodyOnly
              submitRef={eventSubmitRef}
              onCanSaveChange={setEventCanSave}
              controlledColor={{
                value: eventColorOverride ?? "#007AFF",
                onChange: setEventColorOverride,
              }}
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
              // STORY audit (design-keeper #2): EventForm context flips
              // by personalMode prop. Раньше personal-tab события
              // открывались через отдельный PersonalEventSheet который
              // жестко передавал context="personal", а AppointmentSheet
              // event-mode жестко context="team". Теперь один путь —
              // AppointmentSheet знает personalMode и пробрасывает.
              // Это позволит дальше унифицировать dispatch в page.tsx.
              context={personalMode ? "personal" : "team"}
              onSave={(evt) => {
                onSave(evt);
                onClose();
              }}
              onDelete={onDelete}
              onDirtyChange={setEventFormDirty}
            />
          )}
          {!isEventMode && (
            <AppointmentWorkBody
              liveMode={liveMode}
              readonly={readonly}
              client={client}
              recentClientsResolved={recentClientsResolved}
              clientTags={clientTags}
              setClientId={setClientId}
              setLocationId={setLocationId}
              setClientSheet={setClientSheet}
              setClientSheetCreate={setClientSheetCreate}
              setClientMenuOpen={setClientMenuOpen}
              appointment={appointment}
              catalog={catalog}
              locationId={locationId}
              addressNote={addressNote}
              setAddressNote={setAddressNote}
              addressPlaceholder={addressPlaceholder}
              selectedLocation={selectedLocation}
              appointmentServices={appointmentServices}
              globalDiscount={globalDiscount}
              setAppointmentServices={setAppointmentServices}
              setGlobalDiscount={setGlobalDiscount}
              setAskClientFirst={setAskClientFirst}
              setServicePickerOpen={setServicePickerOpen}
              clientId={clientId}
              clientStats={clientStats}
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
              showPayment={liveMode !== "create"}
              paymentTotal={appointment.total_amount}
              onPay={handlePay}
              onReschedule={onReschedule ? () => onReschedule(appointment) : undefined}
            />
          )}
        </div>

        {/* v657 — single save button drives BOTH modes. In event mode it
            routes through eventSubmitRef (EventForm's internal handleSave);
            in work mode it calls handleCreate as before. This is what kills
            the "вылетает" perception — there is no separate EventForm save
            bar layered on top of the sheet anymore.
            v669 — both branches now return boolean so AppointmentSaveButton
            can release the lock if save is refused (silent early-return
            no longer causes the «Сохраняем…» deadlock). */}
        {isEditable && (
          <AppointmentSaveButton
            canSave={canSave}
            label={savePreviewLabel}
            incompleteHint={incompleteHint}
            onSave={
              isEventMode
                ? () => eventSubmitRef.current?.() ?? false
                : handleCreate
            }
          />
        )}
      </div>

      {/* v625 §9 step 2 — all portal-level pickers/dialogs/overlays
          live in AppointmentSubSheets. State stays here; the wrapper
          just renders + forwards callbacks. */}
      <AppointmentSubSheets
        clientSheet={clientSheet}
        setClientSheet={setClientSheet}
        clientSheetCreate={clientSheetCreate}
        clients={clients}
        recentClientIds={recentClientIds}
        onClientSelect={(c) => {
          setClientId(c.id);
          const locs = c.locations;
          const primary = locs.find((l) => l.isPrimary) ?? locs[0] ?? null;
          setLocationId(primary?.id ?? null);
          // v696 — auto-prefill brigade note from the primary location's
          // door-code note ("зелёная дверь, домофон 25"). Only when the
          // current comment is empty so we never overwrite something the
          // dispatcher typed. Edit-mode already has a non-empty comment
          // from the saved appointment, so the guard naturally skips
          // there too.
          const locationNote = primary?.note?.trim();
          if (locationNote && !comment.trim()) {
            setComment(locationNote);
          }
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
        onSaveAndClose={
          // v667 — confirm-popup «Сохранить» branch routes through the
          // right save path depending on segment mode. Without this,
          // saving an event from the close-confirm popup silently
          // failed (handleCreate is work-only).
          // v669 — return type now boolean to match save button.
          // Caller (AppointmentSubSheets) just ignores the value.
          isEventMode
            ? () => { eventSubmitRef.current?.(); }
            : () => { handleCreate(); }
        }
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
          // v660 — flip to the OPPOSITE side of whatever is currently
          // active. If we were on Событие with dirty event-data, the
          // user confirmed they want to discard and go to «Клиент»;
          // if we were on Клиент with dirty work-data, go to «Событие».
          // Reset BOTH dirty flags + clear the work form so it doesn't
          // carry stale services into a fresh draft.
          setEventFormDirty(false);
          if (kind === "event") {
            setKind("work");
          } else {
            // Wipe work-form state so the dispatcher starts fresh on
            // the event side. The next "Клиент" tap re-creates a
            // clean draft (state.appointment is restored by the
            // reset effect on next sheet open).
            setClientId(null);
            setAppointmentServices([]);
            setComment("");
            setAddressNote("");
            setGlobalDiscount(null);
            setKind("event");
          }
        }}
      />

      <UnifiedTimePopup
        open={timePopupOpen}
        onClose={() => setTimePopupOpen(false)}
        readonly={readonly}
        dateKey={dateKey}
        timeStart={timeStart}
        timeEnd={timeEnd}
        allDay={allDay}
        allDayRange={{ start: ALL_DAY_START, end: ALL_DAY_END }}
        stepMinutes={!isEventMode ? activeTeam?.default_slot_minutes : undefined}
        onCommit={({ date, timeStart: s, timeEnd: e, allDay: ad }) => {
          setDateKey(date);
          setTimeStart(s);
          setTimeEnd(e);
          setAllDay(ad);
          setDurationTouched(true);
        }}
      />


    </div>
  );
}
