"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy route — redirects to the unified finances page.
export default function IncomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/finances");
  }, [router]);
  return null;
}
