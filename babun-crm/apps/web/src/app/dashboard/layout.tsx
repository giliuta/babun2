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
} from "@/lib/schedule";
import {
  loadMasters,
  saveMasters,
  loadTeams,
  saveTeams,
  type Master,
  type Team,
} from "@/lib/masters";
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
} from "@/lib/appointments";
import {
  loadServices,
  saveServices,
  loadCategories,
  saveCategories,
  type Service,
  type ServiceCategory,
} from "@/lib/services";
import {
  loadClients,
  saveClients,
  loadClientTags,
  saveClientTags,
  type Client,
  type ClientTag,
} from "@/lib/clients";
import {
  loadTemplates,
  saveTemplates,
  type SmsTemplate,
} from "@/lib/sms-templates";
import {
  loadExpenseCategories,
  saveExpenseCategories,
  type ExpenseCategory,
} from "@/lib/expense-categories";
import {
  loadDayCities,
  saveDayCities,
  setDayCity,
  getDayCity,
  type DayCityMap,
} from "@/lib/day-cities";
import {
  loadDayExtras,
  saveDayExtras,
  setDayExtrasFor,
  getDayExtras,
  type DayExtrasMap,
  type DayExtra,
} from "@/lib/day-extras";
import {
  loadCalendarSettings,
  saveCalendarSettings,
  type CalendarSettings,
} from "@/lib/calendar-settings";
import { loadCities, saveCities, type City } from "@/lib/cities";
import {
  loadEquipment,
  saveEquipment,
  type Equipment,
} from "@/lib/equipment";
import {
  loadLocationLabels,
  saveLocationLabels,
  type LocationLabel,
} from "@/lib/location-labels";
import { warmUpHaptics } from "@/lib/haptics";

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
  setClients: (next: Client[]) => void;
  upsertClient: (c: Client) => void;
  deleteClient: (id: string) => void;
  tags: ClientTag[];
  setTags: (next: ClientTag[]) => void;
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
  const [clients, setClientsState] = useState<Client[]>([]);
  const [clientTags, setClientTagsState] = useState<ClientTag[]>([]);
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
  const [currentMasterId, setCurrentMasterIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(CURRENT_MASTER_KEY);
  });
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
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CURRENT_MASTER_KEY, pick.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masters]);

  const setCurrentMasterId = useCallback((id: string | null) => {
    setCurrentMasterIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(CURRENT_MASTER_KEY, id);
      else window.localStorage.removeItem(CURRENT_MASTER_KEY);
    }
  }, []);

  // Load all persisted state from localStorage on mount
  useEffect(() => {
    setSchedulesState(loadSchedules());
    setMastersState(loadMasters());
    setTeamsState(loadTeams());
    setAppointmentsState(loadAppointments());
    setServicesState(loadServices());
    setServiceCategoriesState(loadCategories());
    setClientsState(loadClients());
    setClientTagsState(loadClientTags());
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
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("babun-draft-clients");
    }
  }, []);

  // STORY-007: external `upsertClient` in lib/clients.ts dispatches
  // babun:clients-changed after writing localStorage. Reload the
  // context state when that fires so ClientPickerSheet's new clients
  // reach consumers (AppointmentSheet, clients list) immediately.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reload = () => setClientsState(loadClients());
    window.addEventListener("babun:clients-changed", reload);
    return () => window.removeEventListener("babun:clients-changed", reload);
  }, []);

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

  const handleClientsChange = useCallback((next: Client[]) => {
    setClientsState(next);
    saveClients(next);
  }, []);
  const upsertClient = useCallback((client: Client) => {
    setClientsState((prev) => {
      const idx = prev.findIndex((c) => c.id === client.id);
      const next = idx >= 0 ? prev.map((c, i) => (i === idx ? client : c)) : [...prev, client];
      saveClients(next);
      return next;
    });
  }, []);
  const deleteClient = useCallback((id: string) => {
    setClientsState((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveClients(next);
      return next;
    });
  }, []);
  const handleClientTagsChange = useCallback((next: ClientTag[]) => {
    setClientTagsState(next);
    saveClientTags(next);
  }, []);

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

  const handleLogout = () => {
    // No backend auth yet — just return to the login screen.
    router.push("/login");
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
    setClients: handleClientsChange,
    upsertClient,
    deleteClient,
    tags: clientTags,
    setTags: handleClientTagsChange,
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
          }}
        >
          <Sidebar
            onLogout={handleLogout}
            onNavigate={handleLegacyNavigate}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          {/* Main content area, offset by sidebar width on lg+. Mobile
              gets bottom padding for the tab bar. `<main>` satisfies
              Lighthouse's `landmark-one-main` rule without breaking any
              existing layout. */}
          <main
            className="flex-1 lg:ml-[240px] flex flex-col min-h-0 min-w-0 lg:pb-0"
            style={{
              touchAction: "pan-y",
              overscrollBehaviorX: "none",
              // v319 — bottom tab bar is now a floating pill capsule
              // 6 px above the safe area + ~64 px tall, so we reserve
              // ~80 px below content on mobile so nothing tucks under.
              paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)",
            }}
          >
            {children}
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
