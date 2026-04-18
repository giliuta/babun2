// 0004_service_categories: seed FinanceServiceCategory records from the
// Bumpix AirFix catalog. Idempotent — skips existing ids.

import type { FinanceServiceCategory } from "@babun/shared/types/finance";

const FIN_CATEGORIES_KEY = "babun2:finance:service_categories";

function loadFinCategories(): FinanceServiceCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FIN_CATEGORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFinCategories(list: FinanceServiceCategory[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FIN_CATEGORIES_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

const SEED_CATEGORIES: FinanceServiceCategory[] = [
  { id: "cat-fin-cleaning", label: "A/C Чистка",         colorHex: "#3b82f6", defaultDurationMin: 45 },
  { id: "cat-fin-freon",    label: "Фреон",               colorHex: "#10b981", defaultDurationMin: 30 },
  { id: "cat-fin-leak",     label: "Утечка",              colorHex: "#ef4444", defaultDurationMin: 60 },
  { id: "cat-fin-install",  label: "Монтаж",              colorHex: "#8b5cf6", defaultDurationMin: 120 },
  { id: "cat-fin-time",     label: "ВРЕМЯ / Почасовая",   colorHex: "#f59e0b", defaultDurationMin: 60 },
  { id: "cat-fin-service",  label: "Сервис / Диагностика",colorHex: "#64748b", defaultDurationMin: 60 },
];

export function migration0004ServiceCategories(): void {
  const existing = loadFinCategories();
  const existingIds = new Set(existing.map((c) => c.id));
  const toAdd = SEED_CATEGORIES.filter((c) => !existingIds.has(c.id));
  if (toAdd.length > 0) saveFinCategories([...existing, ...toAdd]);
}
