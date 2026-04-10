// Appointments data layer.
//
// Single source of truth for service appointments. Persisted in localStorage
// for now; will move to Supabase later.

import { generateId } from "./masters";

export type AppointmentStatus =
  | "scheduled" // запланирована, ещё не выполнена
  | "in_progress" // мастер на месте, работает
  | "completed" // выполнена
  | "cancelled"; // отменена

export type PaymentMethod = "cash" | "card" | "transfer";

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: number;
  paid_at: string; // ISO date
}

export interface Appointment {
  id: string;
  date: string; // YYYY-MM-DD
  time_start: string; // HH:MM
  time_end: string; // HH:MM

  client_id: string | null; // null = quick-anonymous (rare)
  team_id: string | null;
  service_ids: string[];

  // Финансы
  total_amount: number; // фактическая сумма (auto из услуг или ручная)
  custom_total: boolean; // true если total_amount изменён вручную
  prepaid_amount: number; // аванс / предоплата
  payments: Payment[]; // массивы платежей (cash/card/transfer)

  // Доп. поля
  comment: string;
  address: string; // переопределяет client.address
  address_lat: number | null;
  address_lng: number | null;

  source: string | null; // 'instagram' | 'whatsapp' | ... (TODO позже)
  reminder_enabled: boolean; // (TODO позже)

  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Запланирована",
  in_progress: "В работе",
  completed: "Выполнена",
  cancelled: "Отменена",
};

// ─── Storage ───────────────────────────────────────────────────────────

const STORAGE_KEY = "babun-appointments";

export function loadAppointments(): Appointment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAppointments(list: Appointment[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

// ─── Computed helpers ──────────────────────────────────────────────────

export function getPaidAmount(apt: Appointment): number {
  return apt.prepaid_amount + apt.payments.reduce((sum, p) => sum + p.amount, 0);
}

export function getDebtAmount(apt: Appointment): number {
  return Math.max(0, apt.total_amount - getPaidAmount(apt));
}

export function isFullyPaid(apt: Appointment): boolean {
  return getPaidAmount(apt) >= apt.total_amount && apt.total_amount > 0;
}

// ─── Validation: required fields config (settings) ─────────────────────

export interface FormFieldVisibility {
  show_address: boolean;
  show_comment: boolean;
  show_prepaid: boolean;
  show_payments: boolean;
  show_source: boolean;
  show_reminder: boolean;
}

export interface RequiredFields {
  require_client: boolean;
  require_phone: boolean;
  require_services: boolean;
  require_address: boolean;
  require_comment: boolean;
}

export const DEFAULT_FIELD_VISIBILITY: FormFieldVisibility = {
  show_address: true,
  show_comment: true,
  show_prepaid: true,
  show_payments: true,
  show_source: false, // позже
  show_reminder: false, // позже
};

export const DEFAULT_REQUIRED_FIELDS: RequiredFields = {
  require_client: true,
  require_phone: true,
  require_services: true,
  require_address: false,
  require_comment: false,
};

const FIELD_VIS_KEY = "babun-field-visibility";
const REQUIRED_KEY = "babun-required-fields";

export function loadFieldVisibility(): FormFieldVisibility {
  if (typeof window === "undefined") return DEFAULT_FIELD_VISIBILITY;
  try {
    const raw = window.localStorage.getItem(FIELD_VIS_KEY);
    return raw ? { ...DEFAULT_FIELD_VISIBILITY, ...JSON.parse(raw) } : DEFAULT_FIELD_VISIBILITY;
  } catch {
    return DEFAULT_FIELD_VISIBILITY;
  }
}

export function saveFieldVisibility(value: FormFieldVisibility): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FIELD_VIS_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function loadRequiredFields(): RequiredFields {
  if (typeof window === "undefined") return DEFAULT_REQUIRED_FIELDS;
  try {
    const raw = window.localStorage.getItem(REQUIRED_KEY);
    return raw ? { ...DEFAULT_REQUIRED_FIELDS, ...JSON.parse(raw) } : DEFAULT_REQUIRED_FIELDS;
  } catch {
    return DEFAULT_REQUIRED_FIELDS;
  }
}

export function saveRequiredFields(value: RequiredFields): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REQUIRED_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// ─── Validation result ─────────────────────────────────────────────────

export type ValidationLevel = "ok" | "warning" | "error";

export interface ValidationResult {
  level: ValidationLevel;
  missing: string[]; // human-readable list, e.g. ['Адрес', 'Услуги']
}

export function validateAppointment(
  apt: Appointment,
  required: RequiredFields,
  hasClientPhone: boolean
): ValidationResult {
  const missing: string[] = [];

  if (required.require_client && !apt.client_id) missing.push("Клиент");
  if (required.require_phone && !hasClientPhone) missing.push("Телефон клиента");
  if (required.require_services && apt.service_ids.length === 0) missing.push("Услуги");
  if (required.require_address && !apt.address.trim()) missing.push("Адрес");
  if (required.require_comment && !apt.comment.trim()) missing.push("Комментарий");

  return {
    level: missing.length === 0 ? "ok" : "warning",
    missing,
  };
}

// ─── Color logic for calendar block ────────────────────────────────────

export type AppointmentColorKind =
  | "scheduled" // blue — запланирована
  | "completed" // green — выполнена и оплачена
  | "debt" // orange — долг
  | "incomplete" // yellow — не хватает данных
  | "cancelled" // red — отменена
  | "in_progress"; // purple — в работе

/**
 * Color is computed from status + payment state + validation.
 *
 * Priority:
 *   1. cancelled → red
 *   2. debt > 0 → orange (debt color overrides everything else when there's an unpaid balance)
 *   3. completed → green
 *   4. in_progress → purple
 *   5. scheduled but missing required fields → yellow
 *   6. scheduled clean → blue
 */
export function getAppointmentColorKind(
  apt: Appointment,
  validation: ValidationResult
): AppointmentColorKind {
  if (apt.status === "cancelled") return "cancelled";

  // Debt has its own color and beats other states (so even a completed
  // appointment with leftover debt shows orange).
  if (apt.total_amount > 0 && getDebtAmount(apt) > 0 && apt.status !== "scheduled") {
    return "debt";
  }

  if (apt.status === "completed") return "completed";
  if (apt.status === "in_progress") return "in_progress";

  // scheduled
  if (validation.level !== "ok") return "incomplete";
  return "scheduled";
}

export const COLOR_KIND_TAILWIND: Record<
  AppointmentColorKind,
  { bg: string; border: string; text: string }
> = {
  scheduled: {
    bg: "bg-blue-500",
    border: "border-blue-600",
    text: "text-white",
  },
  completed: {
    bg: "bg-emerald-500",
    border: "border-emerald-600",
    text: "text-white",
  },
  debt: {
    // orange — есть задолженность
    bg: "bg-orange-500",
    border: "border-orange-600",
    text: "text-white",
  },
  incomplete: {
    bg: "bg-amber-400",
    border: "border-amber-600",
    text: "text-gray-900",
  },
  cancelled: {
    // red — заказ отменён
    bg: "bg-red-500",
    border: "border-red-700",
    text: "text-white",
  },
  in_progress: {
    bg: "bg-purple-500",
    border: "border-purple-600",
    text: "text-white",
  },
};

// ─── Factory ───────────────────────────────────────────────────────────

export function createBlankAppointment(overrides: Partial<Appointment> = {}): Appointment {
  const now = new Date().toISOString();
  return {
    id: generateId("apt"),
    date: "",
    time_start: "10:00",
    time_end: "11:00",
    client_id: null,
    team_id: null,
    service_ids: [],
    total_amount: 0,
    custom_total: false,
    prepaid_amount: 0,
    payments: [],
    comment: "",
    address: "",
    address_lat: null,
    address_lng: null,
    source: null,
    reminder_enabled: false,
    status: "scheduled",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function createPayment(method: PaymentMethod, amount: number): Payment {
  return {
    id: generateId("pay"),
    method,
    amount,
    paid_at: new Date().toISOString(),
  };
}
