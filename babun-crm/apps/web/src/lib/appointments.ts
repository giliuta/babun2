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

export type AppointmentKind = "work" | "event" | "personal"; // event = встреча/обед/перерыв

export interface AppointmentPhoto {
  id: string;
  data_url: string; // base64 — works without Supabase storage for now
  caption: string;
  uploaded_at: string;
}

export interface AppointmentExpense {
  id: string;
  name: string;
  amount: number; // EUR, positive value
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
  total_amount: number; // фактическая сумма (auto из услуг минус скидка)
  custom_total: boolean; // true если total_amount изменён вручную
  discount_amount: number; // скидка в EUR, вычитается из суммы услуг
  expenses: AppointmentExpense[]; // расходы по записи (материалы, транспорт и т.п.)
  service_price_overrides: Record<string, number>; // id → per-unit цена, если переопределена
  color_override: string | null; // hex — персональный цвет записи/события (палитра)
  prepaid_amount: number; // аванс / предоплата
  payments: Payment[]; // массивы платежей (cash/card/transfer)

  // Доп. поля
  comment: string;
  address: string; // переопределяет client.address
  address_lat: number | null;
  address_lng: number | null;

  source: string | null; // 'instagram' | 'whatsapp' | 'online' | null
  is_online_booking: boolean; // true — клиент записался сам через онлайн-форму
  kind: AppointmentKind; // 'event' / 'personal' = не услуга, а личное событие
  photos: AppointmentPhoto[]; // фото до/после работы

  reminder_enabled: boolean; // клиенту отправляется SMS-напоминание
  reminder_offsets: number[]; // смещения в минутах ДО начала (например [1440, 60])
  reminder_template: string; // шаблон SMS, поддерживает {name} {date} {time} {address}

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
    if (!Array.isArray(parsed)) return [];
    // Lightweight migration: fill in fields added after the record was stored
    return parsed.map((p: Partial<Appointment>) => ({
      ...p,
      discount_amount: p.discount_amount ?? 0,
      expenses: p.expenses ?? [],
      service_price_overrides: p.service_price_overrides ?? {},
      color_override: p.color_override ?? null,
      reminder_enabled: p.reminder_enabled ?? false,
      reminder_offsets: p.reminder_offsets ?? [1440, 60],
      reminder_template:
        p.reminder_template ??
        "Здравствуйте, {name}! Напоминаем: {date} в {time} по адресу {address}. Babun CRM",
    })) as Appointment[];
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
  | "in_progress" // purple — в работе
  | "online" // cyan — запись через онлайн-форму
  | "event" // slate — личное событие / перерыв
  | "past"; // gray — запись в прошлом без статуса

/**
 * Color is computed from status + payment state + validation.
 *
 * Priority:
 *   1. cancelled → red
 *   2. event/personal kind → slate
 *   3. debt > 0 → orange
 *   4. completed → green
 *   5. in_progress → purple
 *   6. online booking (not yet started) → cyan
 *   7. past scheduled (date < today, still scheduled) → gray
 *   8. scheduled + missing required → yellow
 *   9. scheduled clean → blue
 */
export function getAppointmentColorKind(
  apt: Appointment,
  validation: ValidationResult,
  now: Date = new Date()
): AppointmentColorKind {
  if (apt.status === "cancelled") return "cancelled";
  if (apt.kind === "event" || apt.kind === "personal") return "event";

  if (apt.total_amount > 0 && getDebtAmount(apt) > 0 && apt.status !== "scheduled") {
    return "debt";
  }

  if (apt.status === "completed") return "completed";
  if (apt.status === "in_progress") return "in_progress";

  // scheduled
  const aptDate = new Date(`${apt.date}T${apt.time_end}:00`);
  if (aptDate.getTime() < now.getTime()) return "past";

  if (apt.is_online_booking) return "online";
  if (validation.level !== "ok") return "incomplete";
  return "scheduled";
}

export const COLOR_KIND_TAILWIND: Record<
  AppointmentColorKind,
  { bg: string; border: string; text: string }
> = {
  scheduled: {
    // sapphire — запланирована, ещё не выполнена
    bg: "bg-gradient-to-br from-sky-500 to-blue-600",
    border: "border-blue-600",
    text: "text-white",
  },
  completed: {
    // gray — выполнена и оплачена (приглушённая, чтобы не отвлекала)
    bg: "bg-gray-400",
    border: "border-gray-500",
    text: "text-white",
  },
  debt: {
    // amber — есть задолженность
    bg: "bg-gradient-to-br from-amber-500 to-orange-600",
    border: "border-orange-600",
    text: "text-white",
  },
  incomplete: {
    bg: "bg-amber-400",
    border: "border-amber-600",
    text: "text-gray-900",
  },
  cancelled: {
    // red — заказ отменён (с прозрачностью и зачёркнутым текстом,
    // применяется в AppointmentBlock)
    bg: "bg-red-400/60",
    border: "border-red-500",
    text: "text-white",
  },
  in_progress: {
    bg: "bg-gradient-to-br from-violet-500 to-purple-700",
    border: "border-purple-600",
    text: "text-white",
  },
  online: {
    // cyan — запись через онлайн-форму
    bg: "bg-gradient-to-br from-cyan-400 to-teal-600",
    border: "border-cyan-600",
    text: "text-white",
  },
  event: {
    // slate — личное событие
    bg: "bg-gradient-to-br from-slate-500 to-slate-700",
    border: "border-slate-700",
    text: "text-white",
  },
  past: {
    bg: "bg-gradient-to-br from-gray-400 to-gray-500",
    border: "border-gray-500",
    text: "text-white",
  },
};

// ─── SMS reminder helpers ──────────────────────────────────────────────

export const REMINDER_OFFSET_OPTIONS: { label: string; value: number }[] = [
  { label: "за 24ч", value: 1440 },
  { label: "за 12ч", value: 720 },
  { label: "за 6ч", value: 360 },
  { label: "за 3ч", value: 180 },
  { label: "за 1ч", value: 60 },
  { label: "за 30мин", value: 30 },
  { label: "за 15мин", value: 15 },
];

// Render SMS preview text by substituting {name}, {date}, {time}, {address}.
// Safe to call with partial context — missing placeholders stay as-is so the
// user sees which variables are unresolved.
export function renderReminderPreview(
  template: string,
  ctx: { name?: string; date?: string; time?: string; address?: string }
): string {
  return template
    .replace(/\{name\}/g, ctx.name || "{name}")
    .replace(/\{date\}/g, ctx.date || "{date}")
    .replace(/\{time\}/g, ctx.time || "{time}")
    .replace(/\{address\}/g, ctx.address || "{address}");
}

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
    discount_amount: 0,
    expenses: [],
    service_price_overrides: {},
    color_override: null,
    prepaid_amount: 0,
    payments: [],
    comment: "",
    address: "",
    address_lat: null,
    address_lng: null,
    source: null,
    is_online_booking: false,
    kind: "work",
    photos: [],
    reminder_enabled: false,
    reminder_offsets: [1440, 60],
    reminder_template:
      "Здравствуйте, {name}! Напоминаем: {date} в {time} по адресу {address}. Babun CRM",
    status: "scheduled",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

/** Clone an appointment with a fresh ID, blanked-out payments and scheduled status. */
export function duplicateAppointment(apt: Appointment): Appointment {
  const now = new Date().toISOString();
  return {
    ...apt,
    id: generateId("apt"),
    prepaid_amount: 0,
    payments: [],
    status: "scheduled",
    photos: [],
    created_at: now,
    updated_at: now,
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
