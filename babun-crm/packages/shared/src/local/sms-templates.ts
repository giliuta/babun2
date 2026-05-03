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

// STORY-053a — empty array. Previously defaulted to AirFix-flavoured
// templates with a literal "AirFix" signature in every body. Leaked
// into every fresh tenant on first signup. New tenants now start
// with no templates and use the existing Settings → SMS templates
// editor (or STORY-047 SMS reminders) to add their own.
export const DEFAULT_TEMPLATES: SmsTemplate[] = [];

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
