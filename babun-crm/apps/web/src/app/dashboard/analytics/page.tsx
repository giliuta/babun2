"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy route — analytics is no longer a top-level sidebar entry.
// Redirect to clients; analytics will live as a tab there later.
export default function AnalyticsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/clients");
  }, [router]);
  return null;
}
