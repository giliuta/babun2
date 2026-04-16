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
  /** STORY-002: id объекта клиента (из client.locations). null если
   *  клиент не выбран или у клиента один объект. */
  location_id: string | null;
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
      location_id: p.location_id ?? null,
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
  | "scheduled"     // blue — стандартная запись (жилой дом)
  | "commercial"    // orange — коммерция (офис/ресторан/магазин)
  | "no_address"    // yellow — нет адреса! Дима забыл / клиент не скинул
  | "tentative"     // light blue dashed — предварительная (будущая, не подтверждена)
  | "completed"     // gray — выполнена, в прошлом
  | "cancelled"     // red — отменена / отказался
  | "in_progress"   // green — в работе прямо сейчас
  | "event"         // slate — личное событие / задача для бригады
  | "past";         // faded gray — прошлая, не выполнена

/**
 * AUTO-COLOR: цвет определяется АВТОМАТИЧЕСКИ по данным записи.
 * Дима не должен ничего выбирать вручную — система сама понимает.
 *
 * Приоритет (сверху вниз, первое совпадение побеждает):
 *   1. cancelled → красный
 *   2. event/personal → серый (задача для бригады)
 *   3. completed → приглушённый серый
 *   4. in_progress → зелёный (бригада работает)
 *   5. нет адреса → ЖЁЛТЫЙ (⚠ нужно получить адрес!)
 *   6. коммерция (office/restaurant/shop) → оранжевый (другая лестница!)
 *   7. предварительная (дата > 30 дней) → голубой пунктир
 *   8. прошлая но не выполнена → серый выцветший
 *   9. обычная запись → синий
 */
export function getAppointmentColorKind(
  apt: Appointment,
  _validation: ValidationResult,
  now: Date = new Date()
): AppointmentColorKind {
  if (apt.status === "cancelled") return "cancelled";
  if (apt.kind === "event" || apt.kind === "personal") return "event";
  if (apt.status === "completed") return "completed";
  if (apt.status === "in_progress") return "in_progress";

  // Past but never completed — faded
  const aptDate = new Date(`${apt.date}T${apt.time_end}:00`);
  if (aptDate.getTime() < now.getTime()) return "past";

  // No address = YELLOW WARNING — the most common pain point.
  // Dima forgets to follow up, team doesn't know where to go.
  if (!apt.address || apt.address.trim().length < 3) return "no_address";

  // Tentative — appointment more than 30 days away, probably
  // a "come back in November" booking that needs confirmation.
  const daysUntil = (aptDate.getTime() - now.getTime()) / 86400000;
  if (daysUntil > 30) return "tentative";

  // Commercial property — team needs different ladder + equipment
  // Auto-detect from the client's property_type if linked.
  // For now, check color_override as a fallback signal.
  // TODO: when client is linked, read client.property_type

  return "scheduled";
}

export const COLOR_KIND_TAILWIND: Record<
  AppointmentColorKind,
  { bg: string; border: string; text: string }
> = {
  scheduled: {
    // Тёмно-синий — клиент записан, адрес известен, всё готово.
    // Dima специально просил насыщенный тёмный синий для confirmed-like
    // визуального состояния — он сильно читается на фоне сетки.
    bg: "bg-blue-700",
    border: "border-blue-800",
    text: "text-white",
  },
  commercial: {
    // Orange — office/restaurant/shop. Team: bring commercial ladder!
    bg: "bg-orange-500",
    border: "border-orange-600",
    text: "text-white",
  },
  no_address: {
    // Yellow — ADDRESS MISSING! Most common problem. Stands out.
    bg: "bg-amber-400",
    border: "border-amber-500",
    text: "text-amber-900",
  },
  tentative: {
    // Бирюзовый — предварительная запись (>30 дней вперёд, требует
    // подтверждения). Отделён от past (светло-голубой), чтобы не
    // сливались.
    bg: "bg-teal-200",
    border: "border-teal-300",
    text: "text-teal-800",
  },
  completed: {
    // Gray — done, faded so it doesn't distract from today's work
    bg: "bg-gray-300",
    border: "border-gray-400",
    text: "text-gray-600",
  },
  cancelled: {
    // Красный — отменена. Яркий, чтобы отличать от past/completed,
    // с line-through применяемым в компоненте блока.
    bg: "bg-red-500",
    border: "border-red-600",
    text: "text-white",
  },
  in_progress: {
    // Green — team is ON SITE working right now
    bg: "bg-emerald-500",
    border: "border-emerald-600",
    text: "text-white",
  },
  event: {
    // Slate — internal task: "buy supplies", "team meeting"
    bg: "bg-slate-400",
    border: "border-slate-500",
    text: "text-white",
  },
  past: {
    // Светло-голубой — время записи прошло, но бригада ещё не
    // отметила выполнение. Отдельный цвет от completed (серый) и
    // scheduled (тёмно-синий): сразу видно «надо добить».
    bg: "bg-sky-200",
    border: "border-sky-300",
    text: "text-sky-900",
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
    location_id: null,
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
