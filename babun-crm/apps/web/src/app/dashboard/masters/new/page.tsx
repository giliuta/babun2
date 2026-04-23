"use client";

// Sprint 033 Phase I31 — /dashboard/masters/new.
//
// There is no index for a brand-new record (the hub has nothing to
// show). Redirect straight to /info, which renders in "create" mode
// and persists via "Создать".

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NewMasterRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/masters/new/info");
  }, [router]);
  return null;
}
