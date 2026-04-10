"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar, { type DialogType } from "@/components/layout/Sidebar";
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

  // Load all persisted state from localStorage on mount
  useEffect(() => {
    setSchedulesState(loadSchedules());
    setMastersState(loadMasters());
    setTeamsState(loadTeams());
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
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

  return (
    <SidebarContext.Provider value={sidebarValue}>
      <MastersContext.Provider value={mastersValue}>
      <TeamsContext.Provider value={teamsValue}>
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

          {/* Main content area, offset by sidebar width on lg+ */}
          <div className="flex-1 lg:ml-[220px] flex flex-col min-h-0 min-w-0">
            {children}
          </div>

          <InstallPrompt />
        </div>
      </SchedulesContext.Provider>
      </TeamsContext.Provider>
      </MastersContext.Provider>
    </SidebarContext.Provider>
  );
}
