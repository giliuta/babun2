"use client";

// STORY-052 G5 — handles ?session_id / ?canceled query strings.
//
// Webhook is the single source of truth for tenant.plan, so the
// page passes the freshly-resolved plan in. Three branches:
//   * canceled=1                     → "Оплата отменена…"
//   * session_id + plan === 'free'   → "Платёж обрабатывается…"
//                                      (webhook hasn't landed yet)
//   * session_id + plan !== 'free'   → "Подписка {plan_ru} активирована"
//
// After the toast, router.replace() strips the query so a refresh
// doesn't re-fire it.

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { planNameRu, type Plan } from "./types";

interface Props {
  plan: Plan;
  sessionId: string | null;
  canceled: boolean;
}

export default function BillingToasts({ plan, sessionId, canceled }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (!sessionId && !canceled) return;
    fired.current = true;

    let variant: "info" | "success" | "error";
    let message: string;
    if (canceled) {
      variant = "info";
      message = "Оплата отменена. Можно попробовать снова.";
    } else if (plan === "free") {
      variant = "info";
      message =
        "Платёж обрабатывается. Если изменения не появились через минуту — обнови страницу.";
    } else {
      variant = "success";
      message = `Подписка ${planNameRu(plan)} активирована.`;
    }

    toast.show({ variant, message });
    // Strip the query so a refresh doesn't re-fire.
    router.replace(pathname);
  }, [plan, sessionId, canceled, pathname, router, toast]);

  return null;
}
