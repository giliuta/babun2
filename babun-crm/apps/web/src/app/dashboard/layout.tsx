"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar, { type DialogType } from "@/components/layout/Sidebar";
import ClientsDialog from "@/components/clients/ClientsDialog";
import IncomeDialog from "@/components/finance/IncomeDialog";
import ExpensesDialog from "@/components/finance/ExpensesDialog";
import ReportsDialog from "@/components/reports/ReportsDialog";
import WaitlistDialog from "@/components/waitlist/WaitlistDialog";
import SettingsDialog from "@/components/settings/SettingsDialog";
import MasterProfileDialog from "@/components/master/MasterProfileDialog";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import {
  loadSchedules,
  saveSchedules,
  type ScheduleMap,
} from "@/lib/schedule";

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
  openMasterProfile: (teamId?: string) => void;
}

const SchedulesContext = createContext<SchedulesContextValue | null>(null);

export function useSchedules() {
  const ctx = useContext(SchedulesContext);
  if (!ctx) throw new Error("useSchedules must be used within DashboardLayout");
  return ctx;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [schedules, setSchedulesState] = useState<ScheduleMap>({});
  const [masterProfileTeamId, setMasterProfileTeamId] = useState<string | undefined>(undefined);

  // Load schedules from localStorage on mount
  useEffect(() => {
    setSchedulesState(loadSchedules());
  }, []);

  const handleSchedulesChange = useCallback((next: ScheduleMap) => {
    setSchedulesState(next);
    saveSchedules(next);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const closeDialog = () => setActiveDialog(null);

  const openMasterProfile = useCallback((teamId?: string) => {
    setMasterProfileTeamId(teamId);
    setActiveDialog("master-profile");
  }, []);

  const sidebarValue: SidebarContextValue = {
    open: () => setSidebarOpen(true),
    close: () => setSidebarOpen(false),
    toggle: () => setSidebarOpen((prev) => !prev),
  };

  const schedulesValue: SchedulesContextValue = {
    schedules,
    setSchedules: handleSchedulesChange,
    openMasterProfile,
  };

  return (
    <SidebarContext.Provider value={sidebarValue}>
      <SchedulesContext.Provider value={schedulesValue}>
        <div className="h-screen flex overflow-hidden bg-gray-50">
          <Sidebar
            onLogout={handleLogout}
            onNavigate={setActiveDialog}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          {/* Main content area, offset by sidebar width on lg+ */}
          <div className="flex-1 lg:ml-[220px] flex flex-col min-h-0 min-w-0">
            {children}
          </div>

          {/* Dialogs */}
          <ClientsDialog open={activeDialog === "clients"} onClose={closeDialog} />
          <IncomeDialog open={activeDialog === "income"} onClose={closeDialog} />
          <ExpensesDialog open={activeDialog === "expenses"} onClose={closeDialog} />
          <ReportsDialog open={activeDialog === "reports"} onClose={closeDialog} />
          <WaitlistDialog open={activeDialog === "waitlist"} onClose={closeDialog} />
          <SettingsDialog open={activeDialog === "settings"} onClose={closeDialog} />
          <MasterProfileDialog
            open={activeDialog === "master-profile"}
            onClose={closeDialog}
            schedules={schedules}
            onSchedulesChange={handleSchedulesChange}
            initialTeamId={masterProfileTeamId}
          />

          <InstallPrompt />
        </div>
      </SchedulesContext.Provider>
    </SidebarContext.Provider>
  );
}
