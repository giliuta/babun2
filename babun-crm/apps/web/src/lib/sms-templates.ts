// SMS templates with variable tokens — [Name], [Day], [Date], [Time], [Master].

import { generateId } from "./masters";

export type TemplateKind =
  | "new_appointment"
  | "reminder"
  | "after_24h_short"
  | "after_24h_long"
  | "cancellation"
  | "waitlist";

export interface SmsTemplate {
  id: string;
  kind: TemplateKind;
  name: string;
  body: string;
  enabled: boolean;
}

export const KIND_LABELS: Record<TemplateKind, string> = {
  new_appointment: "Новая запись",
  reminder: "Напоминание о записи",
  after_24h_short: "После записи (в течение 24 ч.)",
  after_24h_long: "После записи (после 24 ч.)",
  cancellation: "После отмены записи",
  waitlist: "Для листа ожидания",
};

export const AVAILABLE_TOKENS = [
  { token: "[Name]", label: "Имя клиента" },
  { token: "[Day]", label: "День недели" },
  { token: "[Date]", label: "Дата" },
  { token: "[Time]", label: "Время" },
  { token: "[Master]", label: "Мастер" },
  { token: "[Service]", label: "Услуга" },
  { token: "[Address]", label: "Адрес" },
] as const;

const NOW = new Date().toISOString();

export const DEFAULT_TEMPLATES: SmsTemplate[] = [
  {
    id: "tpl-new",
    kind: "new_appointment",
    name: "Новая запись",
    body: "Здравствуйте, [Name]! Вы записаны на [Date] в [Time]. Мастер: [Master]. AirFix",
    enabled: true,
  },
  {
    id: "tpl-reminder",
    kind: "reminder",
    name: "Напоминание",
    body: "[Name], напоминаем: завтра [Day], [Date] в [Time] — ждём вас. AirFix",
    enabled: true,
  },
  {
    id: "tpl-after-short",
    kind: "after_24h_short",
    name: "После визита (короткое)",
    body: "[Name], спасибо за заказ! Если есть вопросы — пишите. AirFix",
    enabled: true,
  },
  {
    id: "tpl-after-long",
    kind: "after_24h_long",
    name: "После визита (длинное)",
    body: "[Name], прошло время после нашего визита. Всё работает? Будем рады отзыву. AirFix",
    enabled: false,
  },
  {
    id: "tpl-cancel",
    kind: "cancellation",
    name: "Отмена записи",
    body: "[Name], ваша запись на [Date] в [Time] отменена. Перезапишитесь по звонку. AirFix",
    enabled: true,
  },
  {
    id: "tpl-waitlist",
    kind: "waitlist",
    name: "Лист ожидания",
    body: "[Name], появилось свободное время [Date] в [Time]. Подтвердите — запишем. AirFix",
    enabled: true,
  },
];

const STORAGE_KEY = "babun-sms-templates";

export function loadTemplates(): SmsTemplate[] {
  if (typeof window === "undefined") return DEFAULT_TEMPLATES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TEMPLATES;
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export function saveTemplates(list: SmsTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function createBlankTemplate(kind: TemplateKind = "new_appointment"): SmsTemplate {
  return {
    id: generateId("tpl"),
    kind,
    name: KIND_LABELS[kind],
    body: "",
    enabled: true,
  };
}

void NOW;

// Render a template by substituting tokens.
export function renderTemplate(
  body: string,
  vars: Partial<Record<string, string>>
): string {
  return body.replace(/\[(\w+)\]/g, (match, key) => vars[key] ?? match);
}
