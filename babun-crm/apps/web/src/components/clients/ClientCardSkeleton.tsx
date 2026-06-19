"use client";

// P0 #1 (CRM Core brief) — first-paint skeleton for the client card.
// Mirrors the real layout coarsely: sticky header bar + avatar + name
// + phone placeholders, two primary action chips, then two stub content
// blocks. Rendered by ClientCardPage only while `clientsLoading && !client`
// (initial hydration); once loading flips false the not-found branch wins.

export default function ClientCardSkeleton() {
  const bar = "bg-[var(--fill-secondary)] rounded animate-pulse";
  return (
    <div className="flex-1 flex flex-col bg-[var(--surface-grouped)]">
      <div className="sticky top-0 z-10 bg-[var(--surface-card)] border-b border-[var(--separator)] px-4 py-3 flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full ${bar}`} />
        <div className={`flex-1 h-4 ${bar}`} />
        <div className={`w-7 h-7 rounded-full ${bar}`} />
      </div>

      <div className="px-4 pt-4 flex items-center gap-3">
        <div className={`w-14 h-14 rounded-full ${bar}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-4 w-2/3 ${bar}`} />
          <div className={`h-3 w-1/2 ${bar}`} />
        </div>
      </div>

      <div className="px-4 pt-4 flex items-center gap-2">
        <div className={`flex-1 h-11 rounded-[10px] ${bar}`} />
        <div className={`flex-1 h-11 rounded-[10px] ${bar}`} />
        <div className={`w-11 h-11 rounded-full ${bar}`} />
      </div>

      <div className="px-4 pt-5 space-y-3">
        <div className={`h-24 rounded-2xl ${bar}`} />
        <div className={`h-32 rounded-2xl ${bar}`} />
      </div>
    </div>
  );
}
