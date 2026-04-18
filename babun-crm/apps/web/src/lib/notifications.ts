// Notification templates data layer.
//
// CRUD for NotificationTemplate + renderTemplate placeholder substitution.
// Placeholders: {clientName} {serviceList} {date} {time} {address} {brigadeName} {totalEur}

import { generateId } from "./masters";
import type {
  NotificationTemplate,
  NotificationContext,
  NotificationKind,
  NotificationChannel,
} from "@babun/shared/types/finance";

export type { NotificationTemplate, NotificationContext, NotificationKind, NotificationChannel };

// ─── Defaults ──────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    id: "ntpl-reminder-sms",
    kind: "reminder",
    channel: "sms",
    templateText:
      "Здравствуйте, {clientName}! Напоминаем о визите мастера {date} в {time} по адресу {address}. Услуги: {serviceList}. Сумма: {totalEur}.",
    offsetHoursBefore: 24,
    enabled: true,
    createdAt: NOW,
  },
  {
    id: "ntpl-reminder-wa",
    kind: "reminder",
    channel: "whatsapp",
    templateText:
      "Здравствуйте, {clientName}! 👋\n\nНапоминаем о визите бригады *{brigadeName}*:\n📅 {date} в {time}\n📍 {address}\n🔧 {serviceList}\n💶 Итого: {totalEur}",
    offsetHoursBefore: 24,
    enabled: true,
    createdAt: NOW,
  },
  {
    id: "ntpl-confirm-sms",
    kind: "confirmation",
    channel: "sms",
    templateText:
      "Запись подтверждена: {date} в {time}, {address}. Мастер: {brigadeName}. Услуги: {serviceList}. Сумма: {totalEur}.",
    offsetHoursBefore: 0,
    enabled: true,
    createdAt: NOW,
  },
];

// ─── Storage ───────────────────────────────────────────────────────────

const TEMPLATES_KEY = "babun2:finance:notification_templates";

export function loadNotificationTemplates(): NotificationTemplate[] {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_TEMPLATES;
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_TEMPLATES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_NOTIFICATION_TEMPLATES;
  } catch {
    return DEFAULT_NOTIFICATION_TEMPLATES;
  }
}

export function saveNotificationTemplates(list: NotificationTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

// ─── CRUD ──────────────────────────────────────────────────────────────

export function getNotificationTemplate(id: string): NotificationTemplate | undefined {
  return loadNotificationTemplates().find((t) => t.id === id);
}

export function createNotificationTemplate(
  data: Omit<NotificationTemplate, "id" | "createdAt">
): NotificationTemplate {
  const template: NotificationTemplate = {
    ...data,
    id: generateId("ntpl"),
    createdAt: new Date().toISOString(),
  };
  const list = loadNotificationTemplates();
  list.push(template);
  saveNotificationTemplates(list);
  return template;
}

export function updateNotificationTemplate(
  id: string,
  patch: Partial<Omit<NotificationTemplate, "id" | "createdAt">>
): NotificationTemplate | null {
  const list = loadNotificationTemplates();
  const idx = list.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch };
  saveNotificationTemplates(list);
  return list[idx];
}

export function deleteNotificationTemplate(id: string): boolean {
  const list = loadNotificationTemplates();
  const next = list.filter((t) => t.id !== id);
  if (next.length === list.length) return false;
  saveNotificationTemplates(next);
  return true;
}

// ─── Template rendering ────────────────────────────────────────────────

const PLACEHOLDER_KEYS: Array<keyof NotificationContext> = [
  "clientName",
  "serviceList",
  "date",
  "time",
  "address",
  "brigadeName",
  "totalEur",
];

/**
 * Substitute all known placeholders in a template text.
 * Unknown/missing placeholders are left as-is so the user can
 * see which variables are unresolved.
 */
export function renderTemplate(
  template: NotificationTemplate,
  context: NotificationContext
): string {
  let text = template.templateText;
  for (const key of PLACEHOLDER_KEYS) {
    const value = context[key];
    if (value !== undefined && value !== "") {
      text = text.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
  }
  return text;
}

/** Find enabled templates matching a kind+channel. */
export function findTemplates(
  kind: NotificationKind,
  channel: NotificationChannel
): NotificationTemplate[] {
  return loadNotificationTemplates().filter(
    (t) => t.kind === kind && t.channel === channel && t.enabled
  );
}
