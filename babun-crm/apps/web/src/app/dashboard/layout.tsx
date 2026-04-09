"use client";

import { useState } from "react";
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const closeDialog = () => setActiveDialog(null);

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <Sidebar onLogout={handleLogout} onNavigate={setActiveDialog} />

      {/* Main content area, offset by sidebar width */}
      <div className="flex-1 lg:ml-[220px] flex flex-col min-h-0">
        {children}
      </div>

      {/* Dialogs */}
      <ClientsDialog open={activeDialog === "clients"} onClose={closeDialog} />
      <IncomeDialog open={activeDialog === "income"} onClose={closeDialog} />
      <ExpensesDialog open={activeDialog === "expenses"} onClose={closeDialog} />
      <ReportsDialog open={activeDialog === "reports"} onClose={closeDialog} />
      <WaitlistDialog open={activeDialog === "waitlist"} onClose={closeDialog} />
      <SettingsDialog open={activeDialog === "settings"} onClose={closeDialog} />
      <MasterProfileDialog open={activeDialog === "master-profile"} onClose={closeDialog} />
    </div>
  );
}
