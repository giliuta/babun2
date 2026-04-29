"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { type DialogType } from "@/components/layout/Sidebar";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { ConfirmProvider } from "@/components/ui/ConfirmProvider";
import {
  loadSchedules,
  saveSchedules,
  type ScheduleMap,
} from "@babun/shared/local/schedule";
import {
  loadMasters,
  saveMasters,
  loadTeams,
  saveTeams,
  type Master,
  type Team,
} from "@babun/shared/local/masters";
import {
  loadAppointments,
  saveAppointments,
  loadFieldVisibility,
  saveFieldVisibility,
  loadRequiredFields,
  saveRequiredFields,
  type Appointment,
  type FormFieldVisibility,
  type RequiredFields,
} from "@babun/shared/local/appointments";
import {
  loadServices,
  saveServices,
  loadCategories,
  saveCategories,
  type Service,
  type ServiceCategory,
} from "@babun/shared/local/services";
import {
  type Client,
  type ClientTag,
} from "@babun/shared/local/clients";
import {
  listClients,
  createClient as createClientRepo,
  updateClient as updateClientRepo,
  deleteClient as deleteClientRepo,
  listClientTags,
  createClientTag,
  updateClientTag,
  deleteClientTag,
} from "@babun/shared/db/repositories/clients";
import { signOut } from "@/lib/supabase/auth-client";
import UnconfirmedEmailBanner from "@/components/auth/UnconfirmedEmailBanner";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  loadTemplates,
  saveTemplates,
  type SmsTemplate,
} from "@babun/shared/local/sms-templates";
import {
  loadExpenseCategories,
  saveExpenseCategories,
  type ExpenseCategory,
} from "@babun/shared/local/expense-categories";
import {
  loadDayCities,
  saveDayCities,
  setDayCity,
  getDayCity,
  type DayCityMap,
} from "@babun/shared/local/day-cities";
import {
  loadDayExtras,
  saveDayExtras,
  setDayExtrasFor,
  getDayExtras,
  type DayExtrasMap,
  type DayExtra,
} from "@babun/shared/local/day-extras";
import {
  loadCalendarSettings,
  saveCalendarSettings,
  type CalendarSettings,
} from "@babun/shared/local/calendar-settings";
import { loadCities, saveCities, type City } from "@babun/shared/local/cities";
import {
  loadEquipment,
  saveEquipment,
  type Equipment,
} from "@babun/shared/local/equipment";
import {
  loadLocationLabels,
  saveLocationLabels,
  type LocationLabel,
} from "@babun/shared/local/location-labels";
import { warmUpHaptics } from "@/lib/haptics";
import { getStorage } from "@babun/shared/storage";

interface SidebarContextValue {
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within DashboardLayout");
  return ctx;
}

interface SchedulesContextValue {
  schedules: ScheduleMap;
  setSchedules: (next: ScheduleMap) => void;
}

const SchedulesContext = createContext<SchedulesContextValue | null>(null);

export function useSchedules() {
  const ctx = useContext(SchedulesContext);
  if (!ctx) throw new Error("useSchedules must be used within DashboardLayout");
  return ctx;
}

interface MastersContextValue {
  masters: Master[];
  setMasters: (next: Master[]) => void;
  upsertMaster: (master: Master) => void;
  deleteMaster: (id: string) => void;
}

const MastersContext = createContext<MastersContextValue | null>(null);

export function useMasters() {
  const ctx = useContext(MastersContext);
  if (!ctx) throw new Error("useMasters must be used within DashboardLayout");
  return ctx;
}

// Sprint 033 Phase I37 — Current master context. Until Supabase Auth
// lands, `currentMasterId` is a stub: first admin / dispatcher found
// in the masters list. Gives the personal-calendar feature a stable
// owner so we can ship the UX before the auth layer.
interface CurrentMasterContextValue {
  currentMasterId: string | null;
  /** Dev-only setter — the settings page exposes a switcher so a
   *  single-tenant dev account can preview how each master sees
   *  their personal calendar. */
  setCurrentMasterId: (id: string | null) => void;
}

const CurrentMasterContext = createContext<CurrentMasterContextValue | null>(
  null,
);

export function useCurrentMaster() {
  const ctx = useContext(CurrentMasterContext);
  if (!ctx)
    throw new Error("useCurrentMaster must be used within DashboardLayout");
  return ctx;
}

interface TeamsContextValue {
  teams: Team[];
  setTeams: (next: Team[]) => void;
  upsertTeam: (team: Team) => void;
  deleteTeam: (id: string) => void;
}

const TeamsContext = createContext<TeamsContextValue | null>(null);

export function useTeams() {
  const ctx = useContext(TeamsContext);
  if (!ctx) throw new Error("useTeams must be used within DashboardLayout");
  return ctx;
}

interface AppointmentsContextValue {
  appointments: Appointment[];
  upsertAppointment: (apt: Appointment) => void;
  deleteAppointment: (id: string) => void;
  getAppointment: (id: string) => Appointment | undefined;
}

const AppointmentsContext = createContext<AppointmentsContextValue | null>(null);

export function useAppointments() {
  const ctx = useContext(AppointmentsContext);
  if (!ctx) throw new Error("useAppointments must be used within DashboardLayout");
  return ctx;
}

interface FormSettingsContextValue {
  fieldVisibility: FormFieldVisibility;
  setFieldVisibility: (next: FormFieldVisibility) => void;
  requiredFields: RequiredFields;
  setRequiredFields: (next: RequiredFields) => void;
}

const FormSettingsContext = createContext<FormSettingsContextValue | null>(null);

export function useFormSettings() {
  const ctx = useContext(FormSettingsContext);
  if (!ctx) throw new Error("useFormSettings must be used within DashboardLayout");
  return ctx;
}

interface ServicesContextValue {
  services: Service[];
  setServices: (next: Service[]) => void;
  upsertService: (svc: Service) => void;
  deleteService: (id: string) => void;
  categories: ServiceCategory[];
  setCategories: (next: ServiceCategory[]) => void;
}

const ServicesContext = createContext<ServicesContextValue | null>(null);

interface EquipmentContextValue {
  equipment: Equipment[];
  setEquipment: (next: Equipment[]) => void;
  upsertEquipment: (e: Equipment) => void;
  deleteEquipment: (id: string) => void;
}
const EquipmentContext = createContext<EquipmentContextValue | null>(null);
export function useEquipment() {
  const ctx = useContext(EquipmentContext);
  if (!ctx) throw new Error("useEquipment must be used within DashboardLayout");
  return ctx;
}

export function useServices() {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error("useServices must be used within DashboardLayout");
  return ctx;
}

interface ClientsContextValue {
  clients: Client[];
  /** True until the first listClients() resolves. Pages that show
   *  the full list should render a skeleton while this is true. */
  clientsLoading: boolean;
  /** Last error message from a load. UI can show a retry banner. */
  clientsError: string | null;
  /** Manual refetch — used by retry buttons. */
  reloadClients: () => Promise<void>;
  setClients: (next: Client[]) => void;
  upsertClient: (c: Client) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  tags: ClientTag[];
  setTags: (next: ClientTag[]) => void;
  upsertTag: (tag: ClientTag) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
}

const ClientsContext = createContext<ClientsContextValue | null>(null);

export function useClients() {
  const ctx = useContext(ClientsContext);
  if (!ctx) throw new Error("useClients must be used within DashboardLayout");
  return ctx;
}

interface SmsTemplatesContextValue {
  templates: SmsTemplate[];
  setTemplates: (next: SmsTemplate[]) => void;
  upsertTemplate: (tpl: SmsTemplate) => void;
}

const SmsTemplatesContext = createContext<SmsTemplatesContextValue | null>(null);

export function useSmsTemplates() {
  const ctx = useContext(SmsTemplatesContext);
  if (!ctx) throw new Error("useSmsTemplates must be used within DashboardLayout");
  return ctx;
}

interface ExpenseCategoriesContextValue {
  categories: ExpenseCategory[];
  setCategories: (next: ExpenseCategory[]) => void;
}

const ExpenseCategoriesContext = createContext<ExpenseCategoriesContextValue | null>(null);

export function useExpenseCategories() {
  const ctx = useContext(ExpenseCategoriesContext);
  if (!ctx) throw new Error("useExpenseCategories must be used within DashboardLayout");
  return ctx;
}

interface DayCitiesContextValue {
  dayCities: DayCityMap;
  setCityFor: (teamId: string, dateKey: string, city: string) => void;
  getCityFor: (teamId: string | null, dateKey: string, teamDefault: string) => string;
}

const DayCitiesContext = createContext<DayCitiesContextValue | null>(null);

export function useDayCities() {
  const ctx = useContext(DayCitiesContext);
  if (!ctx) throw new Error("useDayCities must be used within DashboardLayout");
  return ctx;
}

interface DayExtrasContextValue {
  dayExtras: DayExtrasMap;
  getExtrasFor: (teamId: string | null, dateKey: string) => DayExtra[];
  setExtrasFor: (teamId: string, dateKey: string, extras: DayExtra[]) => void;
}

const DayExtrasContext = createContext<DayExtrasContextValue | null>(null);

export function useDayExtras() {
  const ctx = useContext(DayExtrasContext);
  if (!ctx) throw new Error("useDayExtras must be used within DashboardLayout");
  return ctx;
}

interface CalendarSettingsContextValue {
  calendarSettings: CalendarSettings;
  setCalendarSettings: (next: CalendarSettings) => void;
}

const CalendarSettingsContext = createContext<CalendarSettingsContextValue | null>(null);

export function useCalendarSettings() {
  const ctx = useContext(CalendarSettingsContext);
  if (!ctx) throw new Error("useCalendarSettings must be used within DashboardLayout");
  return ctx;
}

interface CitiesContextValue {
  cities: City[];
  setCities: (next: City[]) => void;
}

const CitiesContext = createContext<CitiesContextValue | null>(null);

export function useCities() {
  const ctx = useContext(CitiesContext);
  if (!ctx) throw new Error("useCities must be used within DashboardLayout");
  return ctx;
}

interface LocationLabelsContextValue {
  locationLabels: LocationLabel[];
  setLocationLabels: (next: LocationLabel[]) => void;
}

const LocationLabelsContext = createContext<LocationLabelsContextValue | null>(null);

export function useLocationLabels() {
  const ctx = useContext(LocationLabelsContext);
  if (!ctx) throw new Error("useLocationLabels must be used within DashboardLayout");
  return ctx;
}

// v328 — 16-px transparent strip pinned to the left or right edge of
// <main>.  Captures touchstart with `touch-action: none` and
// preventDefault, so iOS PWA's native swipe-back/-forward gesture
// (the only thing the user-installed-PWA wrapper still listens to
// on those edges) cannot fire.  Vertical scrolling, internal
// SwipeableRow gestures, etc. happen further inside and are
// untouched.  The strip is too narrow to interfere with content
// (touch targets sit ≥ 12 px from the screen edge anyway).
function EdgeGuard({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden
      onTouchStart={(e) => {
        // Only block when the touch *starts* in the edge strip.
        // Don't preventDefault if the user is already mid-gesture
        // and only their finger drifted into the edge.
        if (e.touches.length === 1) e.preventDefault();
      }}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: 0,
        width: 16,
        zIndex: 50,
        touchAction: "none",
        // Pointer events must pass through to allow taps on UI
        // that genuinely sits in the safe-area inset (rare).  The
        // touchstart preventDefault still fires.
        pointerEvents: "auto",
        background: "transparent",
      }}
    />
  );
}

interface DashboardClientLayoutProps {
  children: React.ReactNode;
  /** Resolved on the server from auth.users → tenants. Source of
   *  truth for every repo call inside the dashboard tree. */
  tenantId: string;
  /** Live tenant name from the DB. Replaces the legacy "Babun CRM"
   *  hardcode in the sidebar; user edits it via /dashboard/settings/account. */
  tenantName: string;
  /** Shown in the sidebar footer. Empty string if not available. */
  userEmail: string;
  /** False → render the unconfirmed-email banner above the main area. */
  emailConfirmed: boolean;
}

export default function DashboardClientLayout({
  children,
  tenantId,
  tenantName,
  userEmail,
  emailConfirmed,
}: DashboardClientLayoutProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // v316 — Prime the haptics audio context + iOS taptic switch on
  // the first user gesture.  Without this, iOS Safari suspends the
  // AudioContext and the very first haptic() call after launch is
  // silent.  Listener is { once: true } so it self-removes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prime = () => {
      warmUpHaptics();
    };
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("touchstart", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("touchstart", prime);
    };
  }, []);
  const [schedules, setSchedulesState] = useState<ScheduleMap>({});
  const [masters, setMastersState] = useState<Master[]>([]);
  const [teams, setTeamsState] = useState<Team[]>([]);
  const [appointments, setAppointmentsState] = useState<Appointment[]>([]);
  const [services, setServicesState] = useState<Service[]>([]);
  const [serviceCategories, setServiceCategoriesState] = useState<ServiceCategory[]>([]);
  // STORY-036 — clients vertical now lives in Supabase. The list is
  // hydrated on mount via listClients(); other consumers see [] until
  // hydration completes (~50–250 ms on warm Wi-Fi). Pages that need
  // the loading state read `clientsLoading` from the context.
  const [clients, setClientsState] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState<boolean>(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [clientTags, setClientTagsState] = useState<ClientTag[]>([]);
  // tenantId now comes from the server layout via prop (STORY-037 G5).
  // tenantName + userEmail flow into the Sidebar so the brand row
  // renders the live tenant identity instead of a hardcoded string.
  const [smsTemplates, setSmsTemplatesState] = useState<SmsTemplate[]>([]);
  const [expenseCategories, setExpenseCategoriesState] = useState<ExpenseCategory[]>([]);
  const [dayCities, setDayCitiesState] = useState<DayCityMap>({});
  const [dayExtras, setDayExtrasState] = useState<DayExtrasMap>({});
  const [calendarSettings, setCalendarSettingsState] = useState<CalendarSettings>(() => {
    if (typeof window === "undefined") return { startHour: 9, endHour: 20, gridStep: 30, weekStart: "monday", timezone: "Europe/Nicosia" };
    return loadCalendarSettings();
  });
  const [cities, setCitiesState] = useState<City[]>([]);
  const [equipment, setEquipmentState] = useState<Equipment[]>([]);
  const [locationLabels, setLocationLabelsState] = useState<LocationLabel[]>([]);
  // Phase I37 — stubbed "current master". Seeded lazily from the
  // masters list when it loads. Persisted in localStorage for dev so
  // you stay logged in as the same master across reloads.
  const CURRENT_MASTER_KEY = "babun2:current-master";
  const [currentMasterId, setCurrentMasterIdState] = useState<string | null>(() =>
    getStorage().getRaw(CURRENT_MASTER_KEY),
  );
  const [fieldVisibility, setFieldVisibilityState] = useState<FormFieldVisibility>({
    show_address: true,
    show_comment: true,
    show_prepaid: true,
    show_payments: true,
    show_source: false,
    show_reminder: false,
  });
  const [requiredFields, setRequiredFieldsState] = useState<RequiredFields>({
    require_client: true,
    require_phone: true,
    require_services: true,
    require_address: false,
    require_comment: false,
  });

  // Seed currentMasterId once masters are loaded. Defaults to first
  // admin, then first dispatcher, then any active master — whichever
  // is found first. Writes-through to localStorage so the setter is
  // persistent.
  useEffect(() => {
    if (currentMasterId && masters.some((m) => m.id === currentMasterId)) {
      return;
    }
    const pick =
      masters.find((m) => m.is_active && m.role === "admin") ??
      masters.find((m) => m.is_active && m.role === "dispatcher") ??
      masters.find((m) => m.is_active) ??
      masters[0];
    if (pick) {
      setCurrentMasterIdState(pick.id);
      getStorage().setRaw(CURRENT_MASTER_KEY, pick.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masters]);

  const setCurrentMasterId = useCallback((id: string | null) => {
    setCurrentMasterIdState(id);
    if (id) getStorage().setRaw(CURRENT_MASTER_KEY, id);
    else getStorage().remove(CURRENT_MASTER_KEY);
  }, []);

  // Load all persisted state from localStorage on mount.
  // STORY-036: clients + tags moved to Supabase — they are loaded in
  // a separate effect below so we can surface loading/error state.
  useEffect(() => {
    setSchedulesState(loadSchedules());
    setMastersState(loadMasters());
    setTeamsState(loadTeams());
    setAppointmentsState(loadAppointments());
    setServicesState(loadServices());
    setServiceCategoriesState(loadCategories());
    setSmsTemplatesState(loadTemplates());
    setExpenseCategoriesState(loadExpenseCategories());
    setDayCitiesState(loadDayCities());
    setDayExtrasState(loadDayExtras());
    setCalendarSettingsState(loadCalendarSettings());
    setCitiesState(loadCities());
    setEquipmentState(loadEquipment());
    setLocationLabelsState(loadLocationLabels());
    setFieldVisibilityState(loadFieldVisibility());
    setRequiredFieldsState(loadRequiredFields());
    // STORY-007: legacy key cleanup. Drafts are gone — any leftover
    // records would never surface in the UI again, so drop them so
    // storage stays tidy.
    getStorage().remove("babun-draft-clients");
  }, []);

  // STORY-036 — fetch clients + tags from Supabase. Surfaces
  // loading + error state via context so /dashboard/clients can
  // render a skeleton + retry banner.
  const reloadClients = useCallback(async () => {
    setClientsError(null);
    setClientsLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const [list, tagList] = await Promise.all([
        listClients(supabase, tenantId),
        listClientTags(supabase, tenantId),
      ]);
      setClientsState(list);
      setClientTagsState(tagList);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось загрузить клиентов";
      setClientsError(msg);
    } finally {
      setClientsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void reloadClients();
  }, [reloadClients]);

  // STORY-007 (legacy): components in appointments / chats still call
  // `upsertClient` from @babun/shared/local/clients which writes to
  // localStorage and dispatches babun:clients-changed. We listen and
  // refetch from Supabase so the list page stays consistent. The
  // localStorage write itself is a no-op for the canonical store
  // until those verticals migrate (STORY-036b/c/d).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reload = () => void reloadClients();
    window.addEventListener("babun:clients-changed", reload);
    return () => window.removeEventListener("babun:clients-changed", reload);
  }, [reloadClients]);

  const handleSchedulesChange = useCallback((next: ScheduleMap) => {
    setSchedulesState(next);
    saveSchedules(next);
  }, []);

  const handleMastersChange = useCallback((next: Master[]) => {
    setMastersState(next);
    saveMasters(next);
  }, []);

  const upsertMaster = useCallback((master: Master) => {
    setMastersState((prev) => {
      const idx = prev.findIndex((m) => m.id === master.id);
      const next = idx >= 0 ? prev.map((m, i) => (i === idx ? master : m)) : [...prev, master];
      saveMasters(next);
      return next;
    });
  }, []);

  const deleteMaster = useCallback((id: string) => {
    setMastersState((prev) => {
      const next = prev.filter((m) => m.id !== id);
      saveMasters(next);
      return next;
    });
  }, []);

  const handleTeamsChange = useCallback((next: Team[]) => {
    setTeamsState(next);
    saveTeams(next);
  }, []);

  const upsertTeam = useCallback((team: Team) => {
    setTeamsState((prev) => {
      const idx = prev.findIndex((t) => t.id === team.id);
      const next = idx >= 0 ? prev.map((t, i) => (i === idx ? team : t)) : [...prev, team];
      saveTeams(next);
      return next;
    });
  }, []);

  const deleteTeam = useCallback((id: string) => {
    setTeamsState((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveTeams(next);
      return next;
    });
  }, []);

  const upsertAppointment = useCallback((apt: Appointment) => {
    setAppointmentsState((prev) => {
      const idx = prev.findIndex((a) => a.id === apt.id);
      const next = idx >= 0 ? prev.map((a, i) => (i === idx ? apt : a)) : [...prev, apt];
      saveAppointments(next);
      return next;
    });
  }, []);

  const deleteAppointment = useCallback((id: string) => {
    setAppointmentsState((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveAppointments(next);
      return next;
    });
  }, []);

  const getAppointment = useCallback(
    (id: string) => appointments.find((a) => a.id === id),
    [appointments]
  );

  const handleServicesChange = useCallback((next: Service[]) => {
    setServicesState(next);
    saveServices(next);
  }, []);
  const upsertService = useCallback((svc: Service) => {
    setServicesState((prev) => {
      const idx = prev.findIndex((s) => s.id === svc.id);
      const next = idx >= 0 ? prev.map((s, i) => (i === idx ? svc : s)) : [...prev, svc];
      saveServices(next);
      return next;
    });
  }, []);
  const deleteService = useCallback((id: string) => {
    setServicesState((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveServices(next);
      return next;
    });
  }, []);
  const handleServiceCategoriesChange = useCallback((next: ServiceCategory[]) => {
    setServiceCategoriesState(next);
    saveCategories(next);
  }, []);

  // STORY-036 — bulk replace is a no-op against Supabase. Kept on the
  // context purely for API stability; nobody calls it externally today.
  const handleClientsChange = useCallback((next: Client[]) => {
    setClientsState(next);
  }, []);
  const upsertClient = useCallback(
    async (client: Client) => {
      const supabase = getSupabaseBrowser();
      const inMemory = clients.some((c) => c.id === client.id);
      let saved: Client;
      if (inMemory) {
        saved = await updateClientRepo(supabase, client.id, client, tenantId);
      } else {
        try {
          saved = await createClientRepo(supabase, client, tenantId);
        } catch (err) {
          // Race: clients[] hadn't loaded yet but the row already
          // exists. Fall back to update.
          const msg = err instanceof Error ? err.message : "";
          if (/duplicate key|already exists|23505/i.test(msg)) {
            saved = await updateClientRepo(supabase, client.id, client, tenantId);
          } else {
            throw err;
          }
        }
      }
      setClientsState((prev) => {
        const idx = prev.findIndex((c) => c.id === saved.id);
        return idx >= 0
          ? prev.map((c, i) => (i === idx ? saved : c))
          : [...prev, saved];
      });
    },
    [clients, tenantId],
  );
  const deleteClient = useCallback(
    async (id: string) => {
      const supabase = getSupabaseBrowser();
      await deleteClientRepo(supabase, id, tenantId);
      setClientsState((prev) => prev.filter((c) => c.id !== id));
    },
    [tenantId],
  );
  const handleClientTagsChange = useCallback((next: ClientTag[]) => {
    setClientTagsState(next);
  }, []);
  const upsertTag = useCallback(
    async (tag: ClientTag) => {
      const supabase = getSupabaseBrowser();
      const exists = clientTags.some((t) => t.id === tag.id);
      const saved = exists
        ? await updateClientTag(
            supabase,
            tag.id,
            { name: tag.name, color: tag.color },
            tenantId,
          )
        : await createClientTag(
            supabase,
            { name: tag.name, color: tag.color },
            tenantId,
          );
      setClientTagsState((prev) => {
        const idx = prev.findIndex((t) => t.id === saved.id);
        return idx >= 0
          ? prev.map((t, i) => (i === idx ? saved : t))
          : [...prev, saved];
      });
    },
    [clientTags, tenantId],
  );
  const deleteTag = useCallback(
    async (id: string) => {
      const supabase = getSupabaseBrowser();
      await deleteClientTag(supabase, id, tenantId);
      setClientTagsState((prev) => prev.filter((t) => t.id !== id));
    },
    [tenantId],
  );

  const handleSmsTemplatesChange = useCallback((next: SmsTemplate[]) => {
    setSmsTemplatesState(next);
    saveTemplates(next);
  }, []);
  const upsertSmsTemplate = useCallback((tpl: SmsTemplate) => {
    setSmsTemplatesState((prev) => {
      const idx = prev.findIndex((t) => t.id === tpl.id);
      const next = idx >= 0 ? prev.map((t, i) => (i === idx ? tpl : t)) : [...prev, tpl];
      saveTemplates(next);
      return next;
    });
  }, []);

  const handleExpenseCategoriesChange = useCallback((next: ExpenseCategory[]) => {
    setExpenseCategoriesState(next);
    saveExpenseCategories(next);
  }, []);

  const handleFieldVisibilityChange = useCallback((next: FormFieldVisibility) => {
    setFieldVisibilityState(next);
    saveFieldVisibility(next);
  }, []);

  const handleRequiredFieldsChange = useCallback((next: RequiredFields) => {
    setRequiredFieldsState(next);
    saveRequiredFields(next);
  }, []);

  const handleLogout = async () => {
    // STORY-037: real Supabase signOut, then bounce to /login.
    // router.refresh() forces the server layout to re-check auth so
    // the next render goes through the unauthenticated branch.
    await signOut();
    router.push("/login");
    router.refresh();
  };

  // Legacy callback — Sidebar now navigates via router internally
  const handleLegacyNavigate = (_d: DialogType) => {
    void _d;
  };

  const sidebarValue: SidebarContextValue = {
    open: () => setSidebarOpen(true),
    close: () => setSidebarOpen(false),
    toggle: () => setSidebarOpen((prev) => !prev),
  };

  const schedulesValue: SchedulesContextValue = {
    schedules,
    setSchedules: handleSchedulesChange,
  };

  const mastersValue: MastersContextValue = {
    masters,
    setMasters: handleMastersChange,
    upsertMaster,
    deleteMaster,
  };

  const teamsValue: TeamsContextValue = {
    teams,
    setTeams: handleTeamsChange,
    upsertTeam,
    deleteTeam,
  };

  const appointmentsValue: AppointmentsContextValue = {
    appointments,
    upsertAppointment,
    deleteAppointment,
    getAppointment,
  };

  const formSettingsValue: FormSettingsContextValue = {
    fieldVisibility,
    setFieldVisibility: handleFieldVisibilityChange,
    requiredFields,
    setRequiredFields: handleRequiredFieldsChange,
  };

  const servicesValue: ServicesContextValue = {
    services,
    setServices: handleServicesChange,
    upsertService,
    deleteService,
    categories: serviceCategories,
    setCategories: handleServiceCategoriesChange,
  };

  const clientsValue: ClientsContextValue = {
    clients,
    clientsLoading,
    clientsError,
    reloadClients,
    setClients: handleClientsChange,
    upsertClient,
    deleteClient,
    tags: clientTags,
    setTags: handleClientTagsChange,
    upsertTag,
    deleteTag,
  };

  const smsTemplatesValue: SmsTemplatesContextValue = {
    templates: smsTemplates,
    setTemplates: handleSmsTemplatesChange,
    upsertTemplate: upsertSmsTemplate,
  };

  const expenseCategoriesValue: ExpenseCategoriesContextValue = {
    categories: expenseCategories,
    setCategories: handleExpenseCategoriesChange,
  };

  const handleSetCityFor = useCallback(
    (teamId: string, dateKey: string, city: string) => {
      setDayCitiesState((prev) => {
        const next = setDayCity(prev, teamId, dateKey, city);
        saveDayCities(next);
        return next;
      });
    },
    []
  );

  const handleGetCityFor = useCallback(
    (teamId: string | null, dateKey: string, teamDefault: string): string => {
      const assigned = getDayCity(dayCities, teamId, dateKey);
      return assigned || teamDefault;
    },
    [dayCities]
  );

  const dayCitiesValue: DayCitiesContextValue = {
    dayCities,
    setCityFor: handleSetCityFor,
    getCityFor: handleGetCityFor,
  };

  const handleSetExtrasFor = useCallback(
    (teamId: string, dateKey: string, extras: DayExtra[]) => {
      setDayExtrasState((prev) => {
        const next = setDayExtrasFor(prev, teamId, dateKey, extras);
        saveDayExtras(next);
        return next;
      });
    },
    []
  );

  const handleGetExtrasFor = useCallback(
    (teamId: string | null, dateKey: string): DayExtra[] => {
      return getDayExtras(dayExtras, teamId, dateKey);
    },
    [dayExtras]
  );

  const dayExtrasValue: DayExtrasContextValue = {
    dayExtras,
    getExtrasFor: handleGetExtrasFor,
    setExtrasFor: handleSetExtrasFor,
  };

  const handleCalendarSettingsChange = useCallback((next: CalendarSettings) => {
    setCalendarSettingsState(next);
    saveCalendarSettings(next);
  }, []);

  const calendarSettingsValue: CalendarSettingsContextValue = {
    calendarSettings,
    setCalendarSettings: handleCalendarSettingsChange,
  };

  const handleCitiesChange = useCallback((next: City[]) => {
    setCitiesState(next);
    saveCities(next);
  }, []);

  const citiesValue: CitiesContextValue = {
    cities,
    setCities: handleCitiesChange,
  };

  const handleLocationLabelsChange = useCallback((next: LocationLabel[]) => {
    setLocationLabelsState(next);
    saveLocationLabels(next);
  }, []);

  const locationLabelsValue: LocationLabelsContextValue = {
    locationLabels,
    setLocationLabels: handleLocationLabelsChange,
  };

  const handleEquipmentChange = useCallback((next: Equipment[]) => {
    setEquipmentState(next);
    saveEquipment(next);
  }, []);
  const upsertEquipment = useCallback(
    (e: Equipment) => {
      setEquipmentState((prev) => {
        const idx = prev.findIndex((x) => x.id === e.id);
        const next = idx >= 0 ? prev.map((x, i) => (i === idx ? e : x)) : [...prev, e];
        saveEquipment(next);
        return next;
      });
    },
    [],
  );
  const deleteEquipment = useCallback((id: string) => {
    setEquipmentState((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveEquipment(next);
      return next;
    });
  }, []);
  const equipmentValue: EquipmentContextValue = {
    equipment,
    setEquipment: handleEquipmentChange,
    upsertEquipment,
    deleteEquipment,
  };

  const currentMasterValue: CurrentMasterContextValue = {
    currentMasterId,
    setCurrentMasterId,
  };

  return (
    <SidebarContext.Provider value={sidebarValue}>
      <CurrentMasterContext.Provider value={currentMasterValue}>
      <MastersContext.Provider value={mastersValue}>
      <TeamsContext.Provider value={teamsValue}>
      <AppointmentsContext.Provider value={appointmentsValue}>
      <FormSettingsContext.Provider value={formSettingsValue}>
      <ServicesContext.Provider value={servicesValue}>
      <ClientsContext.Provider value={clientsValue}>
      <SmsTemplatesContext.Provider value={smsTemplatesValue}>
      <ExpenseCategoriesContext.Provider value={expenseCategoriesValue}>
      <DayCitiesContext.Provider value={dayCitiesValue}>
      <DayExtrasContext.Provider value={dayExtrasValue}>
      <CalendarSettingsContext.Provider value={calendarSettingsValue}>
      <CitiesContext.Provider value={citiesValue}>
      <EquipmentContext.Provider value={equipmentValue}>
      <LocationLabelsContext.Provider value={locationLabelsValue}>
      <SchedulesContext.Provider value={schedulesValue}>
      <ConfirmProvider>
        <div
          className="h-[100dvh] flex overflow-hidden bg-[var(--surface-grouped)]"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
            paddingBottom: "env(safe-area-inset-bottom)",
            // v322 — kill iOS edge-swipe back navigation at the root
            // so swiping from the left edge of the Clients page no
            // longer pulls the Calendar in from underneath.
            touchAction: "pan-y",
            overscrollBehaviorX: "none",
          }}
        >
          <Sidebar
            onLogout={handleLogout}
            onNavigate={handleLegacyNavigate}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            tenantName={tenantName}
            userEmail={userEmail}
          />

          {/* Main content area, offset by sidebar width on lg+. Mobile
              gets bottom padding for the tab bar. `<main>` satisfies
              Lighthouse's `landmark-one-main` rule without breaking any
              existing layout. */}
          <main
            className="flex-1 lg:ml-[240px] flex flex-col min-h-0 min-w-0 pb-[60px] lg:pb-0 relative"
            style={{
              touchAction: "pan-y",
              overscrollBehaviorX: "none",
            }}
          >
            {/* STORY-037 G7 — defensive banner when Supabase Confirm
                Email is ON (currently OFF per A3, so this is hidden). */}
            {!emailConfirmed && userEmail && (
              <UnconfirmedEmailBanner email={userEmail} />
            )}
            {children}

            {/* v328 — Edge guards.  iOS standalone PWA fires the
                native swipe-back / swipe-forward gesture from the
                first 20 px of either screen edge, *ignoring* CSS
                touch-action on inner elements (documented WebKit
                behaviour).  These two strips capture the touch
                first with `touch-action: none` and preventDefault
                on touchstart so the gesture never starts.  They
                sit above content (z-50) but only span 16 px wide —
                no real UI lives there. */}
            <EdgeGuard side="left" />
            <EdgeGuard side="right" />
          </main>

          <BottomTabBar />
          <InstallPrompt />
        </div>
      </ConfirmProvider>
      </SchedulesContext.Provider>
      </LocationLabelsContext.Provider>
      </EquipmentContext.Provider>
      </CitiesContext.Provider>
      </CalendarSettingsContext.Provider>
      </DayExtrasContext.Provider>
      </DayCitiesContext.Provider>
      </ExpenseCategoriesContext.Provider>
      </SmsTemplatesContext.Provider>
      </ClientsContext.Provider>
      </ServicesContext.Provider>
      </FormSettingsContext.Provider>
      </AppointmentsContext.Provider>
      </TeamsContext.Provider>
      </MastersContext.Provider>
      </CurrentMasterContext.Provider>
    </SidebarContext.Provider>
  );
}
