// Masters & Teams data layer.
//
// Single source of truth for the people and brigades that work in the field.
// Persisted in localStorage now, will move to Supabase later.

export type MasterRole = "admin" | "dispatcher" | "lead" | "helper";

export interface MasterPermissions {
  // What the master can SEE
  see_prices: boolean;
  see_finances: boolean;
  see_clients_phone: boolean;
  see_clients_address: boolean;
  see_clients_balance: boolean;

  // What the master can DO
  can_create_appointments: boolean;
  can_edit_appointments: boolean;
  can_delete_appointments: boolean;
  can_complete_appointments: boolean;

  // Which teams' calendars are visible.
  // Empty array = only own team. ['*'] = all teams.
  visible_team_ids: string[];
}

export interface Master {
  id: string;
  full_name: string;
  phone: string;
  avatar_url?: string | null;
  team_id: string | null; // primary team (null = no team, e.g. admin or universal substitute)
  role: MasterRole;
  is_active: boolean;
  permissions: MasterPermissions;
  created_at: string; // ISO date
}

export interface Team {
  id: string;
  name: string;
  region: string;
  color: string; // hex
  lead_id: string | null;
  helper_ids: string[];
  active: boolean;
  created_at: string;
}

// ─── Default permissions per role ──────────────────────────────────────

export function defaultPermissionsForRole(role: MasterRole): MasterPermissions {
  switch (role) {
    case "admin":
      return {
        see_prices: true,
        see_finances: true,
        see_clients_phone: true,
        see_clients_address: true,
        see_clients_balance: true,
        can_create_appointments: true,
        can_edit_appointments: true,
        can_delete_appointments: true,
        can_complete_appointments: true,
        visible_team_ids: ["*"],
      };
    case "dispatcher":
      return {
        see_prices: true,
        see_finances: true,
        see_clients_phone: true,
        see_clients_address: true,
        see_clients_balance: true,
        can_create_appointments: true,
        can_edit_appointments: true,
        can_delete_appointments: true,
        can_complete_appointments: true,
        visible_team_ids: ["*"],
      };
    case "lead":
      return {
        see_prices: true,
        see_finances: false,
        see_clients_phone: true,
        see_clients_address: true,
        see_clients_balance: true,
        can_create_appointments: false,
        can_edit_appointments: true,
        can_delete_appointments: false,
        can_complete_appointments: true,
        visible_team_ids: [], // own team only
      };
    case "helper":
    default:
      return {
        see_prices: false,
        see_finances: false,
        see_clients_phone: true,
        see_clients_address: true,
        see_clients_balance: false,
        can_create_appointments: false,
        can_edit_appointments: false,
        can_delete_appointments: false,
        can_complete_appointments: true,
        visible_team_ids: [], // own team only
      };
  }
}

export const ROLE_LABELS: Record<MasterRole, string> = {
  admin: "Администратор",
  dispatcher: "Диспетчер",
  lead: "Бригадир",
  helper: "Помощник",
};

export const PERMISSION_LABELS: Record<keyof Omit<MasterPermissions, "visible_team_ids">, string> = {
  see_prices: "Видеть цены услуг",
  see_finances: "Видеть доходы и расходы",
  see_clients_phone: "Видеть телефон клиента",
  see_clients_address: "Видеть адрес клиента",
  see_clients_balance: "Видеть баланс клиента",
  can_create_appointments: "Создавать записи",
  can_edit_appointments: "Редактировать записи",
  can_delete_appointments: "Удалять записи",
  can_complete_appointments: "Отмечать выполненные",
};

/** Permission groups matching Bumpix "Права доступа" categories. */
export type PermissionGroupKey = "data" | "edit" | "sections";

export const PERMISSION_GROUPS: {
  key: PermissionGroupKey;
  title: string;
  description: string;
  permissions: Array<keyof Omit<MasterPermissions, "visible_team_ids">>;
}[] = [
  {
    key: "data",
    title: "Доступ к данным",
    description: "Что мастер может видеть",
    permissions: [
      "see_prices",
      "see_finances",
      "see_clients_phone",
      "see_clients_address",
      "see_clients_balance",
    ],
  },
  {
    key: "edit",
    title: "Доступ к редактированию",
    description: "Что мастер может изменять",
    permissions: [
      "can_create_appointments",
      "can_edit_appointments",
      "can_delete_appointments",
      "can_complete_appointments",
    ],
  },
  {
    key: "sections",
    title: "Доступ к разделам",
    description: "Какие разделы видны",
    permissions: [],
  },
];

// ─── Color palette for teams ───────────────────────────────────────────

export const TEAM_COLORS = [
  { name: "Синий", value: "#3b82f6" },
  { name: "Зелёный", value: "#10b981" },
  { name: "Фиолетовый", value: "#8b5cf6" },
  { name: "Розовый", value: "#ec4899" },
  { name: "Оранжевый", value: "#f97316" },
  { name: "Бирюзовый", value: "#14b8a6" },
  { name: "Жёлтый", value: "#eab308" },
  { name: "Красный", value: "#ef4444" },
  { name: "Индиго", value: "#6366f1" },
  { name: "Циан", value: "#06b6d4" },
];

// ─── Seed data (Артём's real team) ─────────────────────────────────────

const NOW = new Date().toISOString();

export const DEFAULT_MASTERS: Master[] = [
  {
    id: "m-artem",
    full_name: "Артём",
    phone: "+357 99 000001",
    team_id: null,
    role: "admin",
    is_active: true,
    permissions: defaultPermissionsForRole("admin"),
    created_at: NOW,
  },
  {
    id: "m-dima",
    full_name: "Дима",
    phone: "+357 99 000002",
    team_id: null, // universal substitute / dispatcher
    role: "dispatcher",
    is_active: true,
    permissions: defaultPermissionsForRole("dispatcher"),
    created_at: NOW,
  },
  {
    id: "m-yura",
    full_name: "Юра",
    phone: "+357 99 000003",
    team_id: "team-yd",
    role: "lead",
    is_active: true,
    permissions: defaultPermissionsForRole("lead"),
    created_at: NOW,
  },
  {
    id: "m-danya-yd",
    full_name: "Даня (Y&D)",
    phone: "+357 99 000004",
    team_id: "team-yd",
    role: "helper",
    is_active: true,
    permissions: defaultPermissionsForRole("helper"),
    created_at: NOW,
  },
  {
    id: "m-danya-dk",
    full_name: "Даня (D&K)",
    phone: "+357 99 000005",
    team_id: "team-dk",
    role: "lead",
    is_active: true,
    permissions: defaultPermissionsForRole("lead"),
    created_at: NOW,
  },
  {
    id: "m-kolya",
    full_name: "Коля",
    phone: "+357 99 000006",
    team_id: "team-dk",
    role: "helper",
    is_active: true,
    permissions: defaultPermissionsForRole("helper"),
    created_at: NOW,
  },
];

export const DEFAULT_TEAMS: Team[] = [
  {
    id: "team-yd",
    name: "Y&D",
    region: "Пафос, Лимассол",
    color: "#3b82f6",
    lead_id: "m-yura",
    helper_ids: ["m-danya-yd"],
    active: true,
    created_at: NOW,
  },
  {
    id: "team-dk",
    name: "D&K",
    region: "Ларнака, Никосия",
    color: "#10b981",
    lead_id: "m-danya-dk",
    helper_ids: ["m-kolya"],
    active: true,
    created_at: NOW,
  },
];

// ─── Storage ───────────────────────────────────────────────────────────

const MASTERS_KEY = "babun-masters";
const TEAMS_KEY = "babun-teams";

export function loadMasters(): Master[] {
  if (typeof window === "undefined") return DEFAULT_MASTERS;
  try {
    const raw = window.localStorage.getItem(MASTERS_KEY);
    if (!raw) return DEFAULT_MASTERS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_MASTERS;
  } catch {
    return DEFAULT_MASTERS;
  }
}

export function saveMasters(masters: Master[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MASTERS_KEY, JSON.stringify(masters));
  } catch {
    // ignore
  }
}

export function loadTeams(): Team[] {
  if (typeof window === "undefined") return DEFAULT_TEAMS;
  try {
    const raw = window.localStorage.getItem(TEAMS_KEY);
    if (!raw) return DEFAULT_TEAMS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TEAMS;
  } catch {
    return DEFAULT_TEAMS;
  }
}

export function saveTeams(teams: Team[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
  } catch {
    // ignore
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function getMasterTeamName(master: Master, teams: Team[]): string {
  if (!master.team_id) return "—";
  return teams.find((t) => t.id === master.team_id)?.name ?? "—";
}

export function getTeamMembers(team: Team, masters: Master[]): {
  lead: Master | null;
  helpers: Master[];
} {
  const lead = team.lead_id ? masters.find((m) => m.id === team.lead_id) ?? null : null;
  const helpers = team.helper_ids
    .map((id) => masters.find((m) => m.id === id))
    .filter((m): m is Master => Boolean(m));
  return { lead, helpers };
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
