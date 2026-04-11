"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy route — reports merged into the Финансы page. Redirects keep
// old PWA cached links working.
export default function ReportsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/finances");
  }, [router]);
  return null;
}
