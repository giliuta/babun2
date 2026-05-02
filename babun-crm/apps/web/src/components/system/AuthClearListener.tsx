"use client";

// STORY-054 G3 — thin client component that mounts the auth-clear
// listener once. Lives in the root layout above the page tree so
// SIGNED_OUT events fire even on /login and /onboarding (which
// don't include DashboardClientLayout in their server tree).

import { useEffect } from "react";
import { attachAuthClearListener } from "@/lib/sync/auth-clear";

export function AuthClearListener() {
  useEffect(() => {
    const detach = attachAuthClearListener();
    return detach;
  }, []);
  return null;
}
