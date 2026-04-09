"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <Sidebar onLogout={handleLogout} />

      {/* Main content area, offset by sidebar width */}
      <div className="flex-1 lg:ml-[220px] flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
}
