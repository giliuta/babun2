// 0004_service_categories: seed FinanceServiceCategory records from the
// Bumpix AirFix catalog. Idempotent — skips existing ids.

import type { FinanceServiceCategory } from "@babun/shared/db/types/finance";

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

// Hex values mirror --tile-* tokens in globals.css. Color persistence
// is in localStorage so we duplicate the hex here, but the canonical
// source of truth is the design-system tile palette — when those
// tokens change, this seed list moves with them so the calendar
// category dot matches the sidebar tile.
const SEED_CATEGORIES: FinanceServiceCategory[] = [
  { id: "cat-fin-cleaning", label: "A/C Чистка",         colorHex: "#3E88F7", defaultDurationMin: 45 }, // tile-blue
  { id: "cat-fin-freon",    label: "Фреон",               colorHex: "#10B981", defaultDurationMin: 30 }, // tile-mint
  { id: "cat-fin-leak",     label: "Утечка",              colorHex: "#F5483F", defaultDurationMin: 60 }, // tile-red
  { id: "cat-fin-install",  label: "Монтаж",              colorHex: "#9B59B6", defaultDurationMin: 120 }, // tile-purple
  { id: "cat-fin-time",     label: "ВРЕМЯ / Почасовая",   colorHex: "#F59E0B", defaultDurationMin: 60 }, // tile-orange
  { id: "cat-fin-service",  label: "Сервис / Диагностика",colorHex: "#8E8E93", defaultDurationMin: 60 }, // tile-gray
];

export function migration0004ServiceCategories(): void {
  const existing = loadFinCategories();
  const existingIds = new Set(existing.map((c) => c.id));
  const toAdd = SEED_CATEGORIES.filter((c) => !existingIds.has(c.id));
  if (toAdd.length > 0) saveFinCategories([...existing, ...toAdd]);
}
