/**
 * appointment-builders.ts
 *
 * Pure builder functions that construct Appointment records from the
 * dispatcher's form state. No side effects — these don't call onSave;
 * callers do that after receiving the built record.
 *
 * Extracted from AppointmentSheet.tsx (Sprint #4 P0 §9, step 1).
 */

import type { Appointment, AppointmentPayment, AppointmentService, Discount } from "@babun/shared/local/appointments";
import { appointmentTotal, totalDuration as calcDuration } from "@babun/shared/local/finance/appointment-calc";
import type { Client } from "@babun/shared/local/clients";
import type { AppointmentSheetMode } from "@/components/appointment/AppointmentSheet";

// ─── Work appointment ─────────────────────────────────────────────────────────

export interface BuildWorkAppointmentInput {
  /** Base record to spread (carries id, team_id, etc.). */
  appointment: Appointment;
  /** v669 — nullable. Anonymous appointments (звонок без полного имени,
   *  «приду чуть позже, тогда скажу кто») are explicitly supported per
   *  v607 design intent — the save preview already says «без клиента».
   *  Previously the builder required Client and the calling handleCreate
   *  early-returned silently, creating a permanent isSubmitting deadlock
   *  on the save button. */
  client: Client | null;
  appointmentServices: AppointmentService[];
  globalDiscount: Discount | null;
  dateKey: string;
  timeStart: string;
  /** Already recalculated by the live-recalc effect; trust it. */
  timeEnd: string;
  locationId: string | null;
  activeTeamId: string | null;
  comment: string;
  /** The resolved display address (selectedLocation?.address or anonymousAddress). */
  address: string;
  addressNote: string;
  source: Appointment["source"];
  cancelFlag: boolean;
  cancelReason: string;
  smsEnabled: boolean;
  liveMode: AppointmentSheetMode;
  /** v708 — operator-picked accent for the whole record. null = no
   *  override (calendar derives colour from team / service). Applies
   *  to work records now too, not just events. */
  colorOverride: string | null;
  /** Block-2 — «весь день». When true the time range is forced to the
   *  full day so the calendar still positions the block. */
  allDay: boolean;
}

/**
 * Build the Appointment record that gets passed to onSave in work mode.
 * Returns null when the minimum requirements (client + at least one service)
 * are not met — callers should guard with `if (!result) return`.
 */
export function buildSavedWorkAppointment(
  input: BuildWorkAppointmentInput
): Appointment {
  const {
    appointment,
    client,
    appointmentServices,
    globalDiscount,
    dateKey,
    timeStart,
    timeEnd,
    locationId,
    activeTeamId,
    comment,
    address,
    addressNote,
    source,
    cancelFlag,
    cancelReason,
    smsEnabled,
    liveMode,
    colorOverride,
    allDay,
  } = input;

  const total = appointmentTotal(appointmentServices, globalDiscount);
  const duration = calcDuration(appointmentServices);

  // v607 P0 #7 — comment stores ONLY the dispatcher's note. The view
  // layer derives the service summary from `service_ids` / `services`
  // when it needs one. Prepending service names here was the cause of
  // the yellow-pill bug where the "comment" badge displayed the
  // service name instead of the actual note.
  const finalComment = comment.trim();

  return {
    ...appointment,
    date: dateKey,
    // Block-2 — «весь день» forces a full-day range so the calendar
    // block still positions; otherwise trust the live-recalc'd times.
    time_start: allDay ? "00:00" : timeStart,
    // `timeEnd` is kept in sync by the live-recalc effect in AppointmentSheet:
    // end ≥ start + Σ service durations, clamped at 23:59. Trust it.
    time_end: allDay ? "23:59" : timeEnd,
    event_all_day: allDay,
    // v669 — null client_id allowed for anonymous drafts. The yellow
    // colour-kind in DayColumn already covers the «без клиента» visual
    // affordance so dispatcher sees missing-client at a glance.
    client_id: client?.id ?? null,
    location_id: locationId,
    team_id: activeTeamId,
    service_ids: appointmentServices.map((l) => l.serviceId),
    services: appointmentServices,
    global_discount: globalDiscount,
    total_duration: duration,
    total_amount: total,
    custom_total: true,
    comment: finalComment,
    address,
    address_note: addressNote.trim(),
    // v708 — persist the operator-picked accent for work records too.
    color_override: colorOverride,
    // STORY-049 — photos no longer ride on the appointment row.
    // The appointmentToInsert/Update adapters ignore this field.
    photos: [],
    source,
    cancel_reason: cancelFlag ? (cancelReason.trim() || null) : null,
    // v669 — guard against null client (anonymous draft). SMS reminder
    // can only fire when we have a phone number; without a client the
    // flag is forced off.
    reminder_enabled: smsEnabled && Boolean(client?.phone),
    kind: "work",
    // Cancel toggle wins over everything else. When the dispatcher
    // unchecks cancel on an already-cancelled record, restore it to
    // "scheduled" — otherwise the record stays cancelled silently and
    // the toggle looks broken (Sprint 017 fix).
    status: cancelFlag
      ? "cancelled"
      : liveMode === "edit"
        ? appointment.status === "cancelled"
          ? "scheduled"
          : appointment.status
        : "scheduled",
    updated_at: new Date().toISOString(),
  };
}

// ─── Payment (complete) ───────────────────────────────────────────────────────

/**
 * Build the Appointment record that marks a visit as completed with payment.
 * P0 #13 + #14 (CRM Core brief) — mirrors the legacy `payment` jsonb into
 * the explicit columns the Supabase trigger keys off.
 */
export function buildCompletedAppointment(
  appointment: Appointment,
  payment: AppointmentPayment
): Appointment {
  // Invoice mode = company will pay later, so the appointment is completed
  // but not yet `paid` — operator gets to flip it manually when the invoice clears.
  const isInvoice = payment.method === "invoice";
  // P0 #14 — partial payment support. PaymentBlock emits a payment with
  // cashAmount + cardAmount < total when the operator picks «Частично».
  // We detect the shortfall here and write payment_status='partial';
  // trigger holds off booking income until the row flips to 'paid'.
  const actualPaid = (payment.cashAmount ?? 0) + (payment.cardAmount ?? 0);
  const fullyPaid = !isInvoice && actualPaid >= appointment.total_amount;
  const isPartial = !isInvoice && !fullyPaid && actualPaid > 0;

  const methodMap: Record<typeof payment.method, "cash" | "card" | "other" | null> = {
    cash: "cash",
    card: "card",
    split: "other",
    invoice: null,
  };

  return {
    ...appointment,
    status: "completed",
    payment,
    payment_status: isInvoice
      ? "unpaid"
      : fullyPaid
        ? "paid"
        : isPartial
          ? "partial"
          : "unpaid",
    payment_method: methodMap[payment.method] ?? undefined,
    paid_amount: isInvoice ? 0 : actualPaid,
    total_amount: appointment.total_amount,
    updated_at: new Date().toISOString(),
  };
}
