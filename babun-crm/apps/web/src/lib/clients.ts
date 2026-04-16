// Clients data layer — balance, discount, tags, analytics segmentation.

import { generateId } from "./masters";
import type { Appointment } from "./appointments";
import { MOCK_CLIENTS, type MockClient } from "./mock-data";

export interface ClientTag {
  id: string;
  name: string;
  color: string;
}

/**
 * Acquisition channel — how did the client find us.
 * Inspired by Monica's "how_we_met" model, adapted for service businesses.
 */
export type AcquisitionSource =
  | "referral" // друг/знакомый привёл
  | "instagram"
  | "whatsapp"
  | "google_maps"
  | "website"
  | "repeat" // повторный клиент
  | "walk_in" // «просто проезжали мимо»
  | "other"
  | "unknown";

export const ACQUISITION_LABELS: Record<AcquisitionSource, string> = {
  referral: "Рекомендация",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  google_maps: "Google Maps",
  website: "Сайт",
  repeat: "Повторный",
  walk_in: "Проездом",
  other: "Другое",
  unknown: "Неизвестно",
};

export type PropertyType = "apartment" | "house" | "office" | "restaurant" | "shop" | "other";

export const PROPERTY_LABELS: Record<PropertyType, string> = {
  apartment: "Квартира",
  house: "Дом",
  office: "Офис",
  restaurant: "Ресторан",
  shop: "Магазин",
  other: "Другое",
};

export type ACType = "split" | "ducted" | "cassette";

export const AC_TYPE_LABELS: Record<ACType, string> = {
  split: "Сплит",
  ducted: "Канальный",
  cassette: "Кассетный",
};

export interface ACUnit {
  id: string;
  room: string;
  brand?: string;
  model?: string;
  ac_type: ACType;
  has_indoor: boolean;
  has_outdoor: boolean;
}

export interface ClientNote {
  id: string;
  text: string;
  created_at: string;
}

// ─── Client locations (objects) ────────────────────────────────────────
// Один клиент может иметь несколько объектов — дом, офис, вилла —
// со своим адресом и своим количеством сплит-систем.
export interface Location {
  id: string;
  label: string;         // "Дом", "Офис", "Вилла"
  address: string;
  /** MEGA-UPDATE: ссылка на Google Maps / Apple Maps.
   *  Когда задана — кнопка «Навигация» ведёт по ссылке (точнее,
   *  клиент мог прислать нестандартный pin). Без неё —
   *  google.com/maps/dir по текстовому адресу. */
  mapUrl?: string;
  acUnits: number;       // количество сплит-систем на этом объекте
  isPrimary: boolean;    // первый объект для автовыбора
}

export interface PhoneEntry {
  id: string;
  number: string;
  /** "Основной", "WhatsApp", "Жена", "Рабочий" etc. */
  label: string;
}

export interface Client {
  id: string;
  full_name: string;
  phone: string;
  /** Дополнительные номера — клиент может дать жены/рабочий/WhatsApp. */
  phones: PhoneEntry[];
  /** Если WhatsApp зарегистрирован на другой номер, не основной. */
  whatsapp_phone: string;
  email: string;
  sms_name: string;
  telegram_username: string;
  instagram_username: string;
  balance: number;
  discount: number;
  comment: string;
  tag_ids: string[];
  acquisition_source: AcquisitionSource;
  referred_by_client_id: string | null;
  first_contact_date: string | null;
  address: string;
  city: string;
  property_type: PropertyType | "";
  equipment: ACUnit[];
  /** Объекты клиента (дом/офис/вилла) — новое поле для STORY-002.
   *  Если у клиента несколько объектов, при записи явно выбирается
   *  один. Legacy-поле `address` оставлено для миграции. */
  locations: Location[];
  notes: ClientNote[];
  /** YYYY-MM-DD, empty = unknown. */
  birthday: string;
  /** Блокировка: клиент в чёрном списке. */
  blacklisted: boolean;
  created_at: string;
}

export const DEFAULT_TAGS: ClientTag[] = [
  { id: "tag-vip", name: "VIP", color: "#f59e0b" },
  { id: "tag-regular", name: "Постоянный", color: "#10b981" },
  { id: "tag-new", name: "Новый", color: "#3b82f6" },
  { id: "tag-problem", name: "Проблемный", color: "#ef4444" },
];

const CLIENTS_KEY = "babun-clients";
const TAGS_KEY = "babun-client-tags";

// STORY-002: демо-набор multi-location клиентов для показа
// LocationPicker. Keyed by MOCK_CLIENTS id. Сид только для новых
// установок (когда localStorage пуст) — не навязывает реальным
// данным.
const DEMO_LOCATIONS: Record<string, Location[]> = {
  "5": [
    {
      id: "loc-5-home",
      label: "Дом",
      address: "Лимассол, Agios Tychonas 21",
      acUnits: 3,
      isPrimary: true,
    },
    {
      id: "loc-5-office",
      label: "Офис",
      address: "Лимассол, Makarios Ave 134",
      acUnits: 5,
      isPrimary: false,
    },
  ],
  "12": [
    {
      id: "loc-12-villa",
      label: "Вилла",
      address: "Пафос, Coral Bay 8",
      acUnits: 8,
      isPrimary: true,
    },
    {
      id: "loc-12-office",
      label: "Офис",
      address: "Пафос, Mesogis 45",
      acUnits: 5,
      isPrimary: false,
    },
    {
      id: "loc-12-flat",
      label: "Квартира",
      address: "Пафос, Posidonos 12",
      acUnits: 2,
      isPrimary: false,
    },
  ],
};

function mockToClient(m: MockClient): Client {
  const demo = DEMO_LOCATIONS[m.id];
  return {
    id: m.id,
    full_name: m.full_name,
    phone: m.phone,
    phones: [],
    whatsapp_phone: "",
    email: "",
    sms_name: m.sms_name,
    telegram_username: "",
    instagram_username: "",
    balance: m.balance,
    discount: m.discount,
    comment: m.comment,
    tag_ids: [],
    acquisition_source: "unknown",
    referred_by_client_id: null,
    first_contact_date: null,
    address: "",
    city: "",
    property_type: "",
    equipment: [],
    locations: demo ?? [
      {
        id: generateId("loc"),
        label: "Основной",
        address: "",
        acUnits: 0,
        isPrimary: true,
      },
    ],
    notes: [],
    birthday: "",
    blacklisted: false,
    created_at: new Date().toISOString(),
  };
}

export function loadClients(): Client[] {
  if (typeof window === "undefined") return MOCK_CLIENTS.map(mockToClient);
  try {
    const raw = window.localStorage.getItem(CLIENTS_KEY);
    if (!raw) return MOCK_CLIENTS.map(mockToClient);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return MOCK_CLIENTS.map(mockToClient);
    }
    // Lightweight migration for fields added after records were stored
    return parsed.map((c: Partial<Client>) => ({
      ...c,
      email: c.email ?? "",
      telegram_username: c.telegram_username ?? "",
      instagram_username: c.instagram_username ?? "",
      property_type: c.property_type ?? "",
      equipment: (c.equipment ?? []).map((u: Partial<ACUnit>) => ({
        ...u,
        ac_type: u.ac_type ?? "split",
      })),
      notes: c.notes ?? [],
      birthday: c.birthday ?? "",
      blacklisted: c.blacklisted ?? false,
      phones: c.phones ?? [],
      whatsapp_phone: c.whatsapp_phone ?? "",
      // STORY-002 migration: legacy single-address clients get a
      // one-location array inferred from their stored address and
      // equipment count. Runs once per client; на последующих
      // загрузках locations уже на месте и не перезаписывается.
      locations:
        c.locations && c.locations.length > 0
          ? c.locations
          : [
              {
                id: generateId("loc"),
                label: "Основной",
                address: c.address ?? "",
                acUnits: (c.equipment ?? []).length,
                isPrimary: true,
              },
            ],
    })) as Client[];
  } catch {
    return MOCK_CLIENTS.map(mockToClient);
  }
}

export function saveClients(list: Client[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLIENTS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function loadClientTags(): ClientTag[] {
  if (typeof window === "undefined") return DEFAULT_TAGS;
  try {
    const raw = window.localStorage.getItem(TAGS_KEY);
    if (!raw) return DEFAULT_TAGS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TAGS;
  } catch {
    return DEFAULT_TAGS;
  }
}

export function saveClientTags(list: ClientTag[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TAGS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function createBlankClient(overrides: Partial<Client> = {}): Client {
  return {
    id: generateId("cli"),
    full_name: "",
    phone: "",
    phones: [],
    whatsapp_phone: "",
    email: "",
    sms_name: "",
    telegram_username: "",
    instagram_username: "",
    balance: 0,
    discount: 0,
    comment: "",
    tag_ids: [],
    acquisition_source: "unknown",
    referred_by_client_id: null,
    first_contact_date: new Date().toISOString().slice(0, 10),
    address: "",
    city: "",
    property_type: "",
    equipment: [],
    locations: [
      {
        id: generateId("loc"),
        label: "Основной",
        address: "",
        acUnits: 0,
        isPrimary: true,
      },
    ],
    notes: [],
    birthday: "",
    blacklisted: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Alphabetical grouping ─────────────────────────────────────────────

export interface ClientGroup {
  letter: string;
  clients: Client[];
}

export function groupClientsByLetter(clients: Client[]): ClientGroup[] {
  const map = new Map<string, Client[]>();
  for (const c of clients) {
    const first = (c.full_name.trim()[0] || "#").toUpperCase();
    const letter = /[A-ZА-ЯЁ]/.test(first) ? first : "#";
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter)!.push(c);
  }
  const sorted = Array.from(map.entries()).sort(([a], [b]) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b, "ru");
  });
  return sorted.map(([letter, clients]) => ({
    letter,
    clients: clients.sort((a, b) => a.full_name.localeCompare(b.full_name, "ru")),
  }));
}

// ─── Analytics segmentation ────────────────────────────────────────────

export type ClientSegment =
  | "all"
  | "active" // has record in future or last 3 months
  | "sleeping" // had records, none in future or last 3 months
  | "lost" // no records in last 6 months
  | "new" // first record in future or last 30 days
  | "upcoming" // has future records
  | "single" // only 1 record ever
  | "none" // never booked (no records) or all cancelled
  | "debtors" // negative balance
  | "prepaid" // positive balance
  | "discounted"; // has discount

export interface SegmentStats {
  segment: ClientSegment;
  label: string;
  count: number;
  percent: number;
  clients: Client[];
}

export const SEGMENT_LABELS: Record<ClientSegment, string> = {
  all: "Все клиенты",
  active: "Активные",
  sleeping: "Спящие",
  lost: "Потерянные",
  new: "Новые",
  upcoming: "С предстоящими записями",
  single: "С одной записью",
  none: "Без записей",
  debtors: "Должники",
  prepaid: "С предоплатой",
  discounted: "Со скидкой",
};

function daysAgoDate(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function dateKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

function clientAppointments(
  client: Client,
  appointments: Appointment[]
): Appointment[] {
  return appointments.filter(
    (a) => a.client_id === client.id && a.status !== "cancelled"
  );
}

export function segmentClient(
  client: Client,
  appointments: Appointment[],
  now: Date = new Date()
): ClientSegment[] {
  const segments: ClientSegment[] = ["all"];
  const apts = clientAppointments(client, appointments);
  const dates = apts.map((a) => dateKeyToDate(a.date)).sort((a, b) => a.getTime() - b.getTime());

  const threeMonthsAgo = daysAgoDate(90);
  const sixMonthsAgo = daysAgoDate(180);
  const thirtyDaysAgo = daysAgoDate(30);

  const hasFuture = dates.some((d) => d.getTime() >= now.getTime());
  const hasAny = dates.length > 0;
  const mostRecent = dates[dates.length - 1];
  const earliest = dates[0];

  if (!hasAny) {
    segments.push("none");
  } else {
    // Active: any future OR any in last 3 months
    if (hasFuture || (mostRecent && mostRecent >= threeMonthsAgo)) {
      segments.push("active");
    }
    // Sleeping: has records, no future and no last-3-months
    else if (mostRecent && mostRecent < threeMonthsAgo) {
      segments.push("sleeping");
    }
    // Lost: no records in last 6 months
    if (mostRecent && mostRecent < sixMonthsAgo && !hasFuture) {
      segments.push("lost");
    }
    // New: earliest in future or last 30 days
    if (earliest && (earliest >= thirtyDaysAgo || earliest >= now)) {
      segments.push("new");
    }
    if (hasFuture) segments.push("upcoming");
    if (dates.length === 1) segments.push("single");
  }

  if (client.balance < 0) segments.push("debtors");
  if (client.balance > 0) segments.push("prepaid");
  if (client.discount > 0) segments.push("discounted");

  return segments;
}

/** Attribution breakdown by acquisition source. */
export interface AcquisitionStats {
  source: AcquisitionSource;
  label: string;
  count: number;
  percent: number;
}

export function computeAcquisitionStats(clients: Client[]): AcquisitionStats[] {
  const map = new Map<AcquisitionSource, number>();
  for (const c of clients) {
    map.set(c.acquisition_source, (map.get(c.acquisition_source) ?? 0) + 1);
  }
  const total = clients.length || 1;
  return (Object.keys(ACQUISITION_LABELS) as AcquisitionSource[])
    .map((source) => {
      const count = map.get(source) ?? 0;
      return {
        source,
        label: ACQUISITION_LABELS[source],
        count,
        percent: Math.round((count / total) * 100),
      };
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function computeSegmentStats(
  clients: Client[],
  appointments: Appointment[]
): SegmentStats[] {
  const now = new Date();
  const segmentMap = new Map<ClientSegment, Client[]>();
  for (const seg of Object.keys(SEGMENT_LABELS) as ClientSegment[]) {
    segmentMap.set(seg, []);
  }

  for (const client of clients) {
    const segs = segmentClient(client, appointments, now);
    for (const seg of segs) {
      segmentMap.get(seg)!.push(client);
    }
  }

  const total = clients.length || 1;
  return (Object.keys(SEGMENT_LABELS) as ClientSegment[]).map((segment) => {
    const list = segmentMap.get(segment) ?? [];
    return {
      segment,
      label: SEGMENT_LABELS[segment],
      count: list.length,
      percent: Math.round((list.length / total) * 100),
      clients: list,
    };
  });
}
