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
  // MEGA-UPDATE: новые поля единой модели услуг.
  /** От скольких штук срабатывает bulk_price. 0 = без bulk. */
  bulk_threshold: number;
  /** Цена за единицу при bulk. 0 если bulk_threshold = 0. */
  bulk_price: number;
  /** Расход материалов на одну штуку (химия, фреон, и т.д.). */
  cost_per_unit: number;
  /** true = можно делать N штук одной услугой (чистка × 3); false
   *  = количество всегда 1 (диагностика, ремонт). */
  is_countable: boolean;
  /** Бригады, которые делают эту услугу. Пусто = все бригады. */
  brigade_ids: string[];
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

interface SvcOpts {
  costs?: ServiceMaterialCost[];
  bulkThreshold?: number;
  bulkPrice?: number;
  costPerUnit?: number;
  isCountable?: boolean;
}

function svc(
  id: string,
  name: string,
  catId: string,
  duration: number,
  price: number,
  color: string,
  opts: SvcOpts = {}
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
    material_costs: opts.costs ?? [],
    is_active: true,
    created_at: NOW,
    bulk_threshold: opts.bulkThreshold ?? 0,
    bulk_price: opts.bulkPrice ?? 0,
    cost_per_unit: opts.costPerUnit ?? 0,
    is_countable: opts.isCountable ?? true,
    brigade_ids: [], // пусто = все бригады
  };
}

// MEGA-UPDATE: вместо 10 услуг (x1, x2 ... x6 для чистки) — пять
// мастер-услуг со степпером количества и bulk-ценой.
export const DEFAULT_SERVICES: Service[] = [
  svc("svc-clean", "Чистка кондиционера", "cat-cleaning", 45, 50, "#3b82f6", {
    bulkThreshold: 3,
    bulkPrice: 45,
    costPerUnit: 3,
    isCountable: true,
  }),
  svc("svc-install", "Установка A/C", "cat-installation", 120, 150, "#8b5cf6", {
    isCountable: true,
  }),
  svc("svc-diag", "Диагностика A/C", "cat-consultation", 60, 50, "#f59e0b", {
    isCountable: false,
  }),
  svc("svc-repair", "Ремонт A/C", "cat-repair", 120, 200, "#ef4444", {
    isCountable: false,
  }),
  svc("svc-freon", "Заправка фреоном", "cat-maintenance", 30, 80, "#10b981", {
    costPerUnit: 25,
    isCountable: true,
  }),
];

// Pricing helper: bulk price срабатывает от threshold штук.
export function pricePerUnit(service: Service, qty: number): number {
  if (
    service.bulk_threshold > 0 &&
    service.bulk_price > 0 &&
    qty >= service.bulk_threshold
  ) {
    return service.bulk_price;
  }
  return service.price;
}

// ─── Storage ───────────────────────────────────────────────────────────

const SERVICES_KEY = "babun-services";
const CATEGORIES_KEY = "babun-service-categories";

export function loadServices(): Service[] {
  if (typeof window === "undefined") return DEFAULT_SERVICES;
  try {
    const raw = window.localStorage.getItem(SERVICES_KEY);
    if (!raw) return DEFAULT_SERVICES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SERVICES;
    // MEGA-UPDATE migration: fill in new fields on legacy records.
    return parsed.map((s: Partial<Service>) => ({
      ...s,
      bulk_threshold: s.bulk_threshold ?? 0,
      bulk_price: s.bulk_price ?? 0,
      cost_per_unit: s.cost_per_unit ?? 0,
      is_countable: s.is_countable ?? true,
      brigade_ids: s.brigade_ids ?? [],
    })) as Service[];
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
    bulk_threshold: 0,
    bulk_price: 0,
    cost_per_unit: 0,
    is_countable: true,
    brigade_ids: [],
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
