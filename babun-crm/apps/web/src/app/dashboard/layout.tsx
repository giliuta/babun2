"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { type DialogType } from "@/components/layout/Sidebar";
import BottomTabBar from "@/components/layout/BottomTabBar";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    setFieldVisibilityState(loadFieldVisibility());
    setRequiredFieldsState(loadRequiredFields());
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

  return (
    <SidebarContext.Provider value={sidebarValue}>
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
      <SchedulesContext.Provider value={schedulesValue}>
        <div
          className="h-[100dvh] flex overflow-hidden bg-gray-50"
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
              gets bottom padding for the tab bar. */}
          <div className="flex-1 lg:ml-[220px] flex flex-col min-h-0 min-w-0 pb-[72px] lg:pb-0">
            {children}
          </div>

          <BottomTabBar />
          <InstallPrompt />
        </div>
      </SchedulesContext.Provider>
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
    </SidebarContext.Provider>
  );
}
