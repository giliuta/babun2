// Suspense fallback for the /dashboard segment — fires while the
// async server layout awaits getTenantContext() (cold launch, login
// → dashboard transition, route nav between sub-pages).
//
// v702 — previous version rendered a fake 8-row list skeleton. That
// worked on /clients or /chats where the destination IS a list, but
// on the main calendar entry point it read as «8 missing list
// items», not as a loading screen at all. On a flaky LTE cold PWA
// launch this looked like «приложение зависло» — the exact «при
// заходе нет загрузочного окна» the dispatcher reported.
//
// Replaced with a centered Babun mark + spinner. Same visual budget,
// reads unambiguously as «грузится» on every dashboard surface
// regardless of which sub-route the user navigated to.

import { BabunMark } from "@/components/ui/BabunMark";

export default function DashboardLoading() {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-5 bg-[var(--surface-grouped)]"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <BabunMark
        size={72}
        radius={18}
        style={{ boxShadow: "0 12px 28px -8px rgba(62,136,247,0.30)" }}
      />
      <div
        className="w-6 h-6 rounded-full border-[2.5px] border-[var(--separator)] border-t-[var(--accent)] animate-spin"
        aria-hidden="true"
      />
      <span className="sr-only">Загружаем…</span>
    </div>
  );
}
