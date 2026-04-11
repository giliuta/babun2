// Services data layer — extended fields per Bumpix parity.
//
// Persisted in localStorage, migrates to Supabase later.

import { generateId } from "./masters";

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO: Mon=1..Sun=7

export interface ServiceMaterialCost {
  id: string;
  name: string;
  amount: number; // EUR per single execution
}

export interface Service {
  id: string;
  name: string;
  category_id: string | null;
  duration_minutes: number;
  price: number;
  color: string; // hex — custom calendar tint
  available_weekdays: Weekday[]; // empty = any day
  online_enabled: boolean;
  material_costs: ServiceMaterialCost[];
  is_active: boolean;
  created_at: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  color: string;
}

export const DEFAULT_CATEGORIES: ServiceCategory[] = [
  { id: "cat-cleaning", name: "Чистка", color: "#3b82f6" },
  { id: "cat-installation", name: "Установка", color: "#8b5cf6" },
  { id: "cat-repair", name: "Ремонт", color: "#ef4444" },
  { id: "cat-maintenance", name: "Обслуживание", color: "#10b981" },
  { id: "cat-consultation", name: "Диагностика", color: "#f59e0b" },
];

const NOW = new Date().toISOString();

function svc(
  id: string,
  name: string,
  catId: string,
  duration: number,
  price: number,
  color: string,
  costs: ServiceMaterialCost[] = []
): Service {
  return {
    id,
    name,
    category_id: catId,
    duration_minutes: duration,
    price,
    color,
    available_weekdays: [],
    online_enabled: true,
    material_costs: costs,
    is_active: true,
    created_at: NOW,
  };
}

export const DEFAULT_SERVICES: Service[] = [
  svc("svc-1", "x1 A/C Чистка", "cat-cleaning", 30, 50, "#3b82f6", [
    { id: "mc-1", name: "Химия", amount: 3 },
  ]),
  svc("svc-2", "x2 A/C Чистка", "cat-cleaning", 60, 100, "#3b82f6", [
    { id: "mc-2", name: "Химия", amount: 6 },
  ]),
  svc("svc-3", "x3 A/C Чистка", "cat-cleaning", 90, 135, "#3b82f6", [
    { id: "mc-3", name: "Химия", amount: 9 },
  ]),
  svc("svc-4", "x4 A/C Чистка", "cat-cleaning", 120, 180, "#3b82f6", [
    { id: "mc-4", name: "Химия", amount: 12 },
  ]),
  svc("svc-5", "x5 A/C Чистка", "cat-cleaning", 150, 225, "#3b82f6", [
    { id: "mc-5", name: "Химия", amount: 15 },
  ]),
  svc("svc-6", "x6 A/C Чистка", "cat-cleaning", 180, 270, "#3b82f6", [
    { id: "mc-6", name: "Химия", amount: 18 },
  ]),
  svc("svc-7", "x1 A/C Установка", "cat-installation", 120, 150, "#8b5cf6"),
  svc("svc-8", "x1 A/C Диагностика", "cat-consultation", 60, 50, "#f59e0b"),
  svc("svc-9", "x1 A/C Ремонт", "cat-repair", 120, 200, "#ef4444"),
  svc("svc-10", "Заправка", "cat-maintenance", 30, 80, "#10b981", [
    { id: "mc-10", name: "Фреон R410A", amount: 25 },
  ]),
];

// ─── Storage ───────────────────────────────────────────────────────────

const SERVICES_KEY = "babun-services";
const CATEGORIES_KEY = "babun-service-categories";

export function loadServices(): Service[] {
  if (typeof window === "undefined") return DEFAULT_SERVICES;
  try {
    const raw = window.localStorage.getItem(SERVICES_KEY);
    if (!raw) return DEFAULT_SERVICES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SERVICES;
  } catch {
    return DEFAULT_SERVICES;
  }
}

export function saveServices(list: Service[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SERVICES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function loadCategories(): ServiceCategory[] {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES;
  try {
    const raw = window.localStorage.getItem(CATEGORIES_KEY);
    if (!raw) return DEFAULT_CATEGORIES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function saveCategories(list: ServiceCategory[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

export function createBlankService(overrides: Partial<Service> = {}): Service {
  return {
    id: generateId("svc"),
    name: "",
    category_id: null,
    duration_minutes: 60,
    price: 0,
    color: "#3b82f6",
    available_weekdays: [],
    online_enabled: true,
    material_costs: [],
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function getServiceMaterialCost(service: Service): number {
  return service.material_costs.reduce((sum, c) => sum + c.amount, 0);
}

export function getServiceCategoryName(
  service: Service,
  categories: ServiceCategory[]
): string {
  if (!service.category_id) return "";
  return categories.find((c) => c.id === service.category_id)?.name ?? "";
}

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Вс",
};
