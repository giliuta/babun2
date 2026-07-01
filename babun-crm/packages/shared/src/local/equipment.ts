// Equipment / inventory — a lightweight per-tenant register of
// physical things the brigades carry or own. Shipped MVP v1 has:
//  · Name, category, optional serial, optional notes.
//  · Optional assignment to a brigade (assigned_team_id).
//  · sort_order for drag-reorder.
//
// Parked for later iterations:
//  · Per-master handoff (`assigned_master_id`).
//  · Amortisation / purchase-price on finances.
//  · Service / calibration reminders via `next_service_at`.
//  · Per-service required-equipment linkage (so calendar can
//    refuse to schedule a job if the required kit isn't at the
//    brigade).
//
// Storage: localStorage, same pattern as cities/services. Migrates
// to Supabase with the rest of the domain when we move off the
// prototype phase.

import { generateId } from "./masters";
import { getStorage } from "../storage/provider";

export interface Equipment {
  id: string;
  name: string;
  /** Free text label — «Инструмент», «Машина», «Расходник»,
   *  «Измерительный прибор». No enum: every tenant defines their
   *  own vocabulary. */
  category?: string;
  /** Serial / inventory number. Optional. */
  serial?: string;
  /** Brigade this equipment is assigned to. null = «на полке»
   *  (not assigned). */
  assigned_team_id: string | null;
  /** Freeform notes. Optional. */
  notes?: string;
  /** UI tint — drawn on the list tile so a brigade can colour-
   *  code their fleet. */
  color?: string;
  is_active: boolean;
  created_at: string;
  /** Sort order within the inventory list (and within the brigade
   *  subroute). Records without a value sink to the end. */
  sort_order?: number;
}

const STORAGE_KEY = "babun-equipment";

export function loadEquipment(): Equipment[] {
  const parsed = getStorage().get<Partial<Equipment>[]>(STORAGE_KEY);
  if (!Array.isArray(parsed)) return [];
  {
    return parsed.map((e: Partial<Equipment>) => ({
      id: e.id ?? generateId("eq"),
      name: e.name ?? "",
      category: e.category,
      serial: e.serial,
      assigned_team_id: e.assigned_team_id ?? null,
      notes: e.notes,
      color: e.color,
      is_active: e.is_active ?? true,
      created_at: e.created_at ?? new Date().toISOString(),
      sort_order: e.sort_order,
    })) as Equipment[];
  }
}

export function saveEquipment(list: Equipment[]): void {
  getStorage().set(STORAGE_KEY, list);
}

export function createBlankEquipment(
  overrides: Partial<Equipment> = {},
): Equipment {
  return {
    id: generateId("eq"),
    name: "",
    category: undefined,
    serial: undefined,
    assigned_team_id: null,
    notes: undefined,
    color: undefined,
    is_active: true,
    created_at: new Date().toISOString(),
    sort_order: undefined,
    ...overrides,
  };
}
