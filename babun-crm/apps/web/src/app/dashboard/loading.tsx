// Skeleton shown while a /dashboard segment compiles + the server
// component awaits its Supabase queries (auth.getUser → tenants).
// Without this file Next.js shows the previous route frozen until the
// new one is fully ready, which on flaky LTE looks like "the page
// didn't open." With it, the user sees instant visual feedback the
// moment they tap a nav item.
import Skeleton, { SkeletonRow } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full bg-[var(--surface-grouped)]">
      {/* Header bar — match the live one's height so the layout doesn't
          jump when the real page mounts. */}
      <div className="flex-shrink-0 h-12 px-4 flex items-center gap-3 bg-[var(--surface-card)] border-b border-[var(--separator)]">
        <Skeleton className="h-5 w-28" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-8" rounded="full" />
        </div>
      </div>

      {/* Content placeholder — generic list shape works for clients,
          chats, masters, services, finances. */}
      <div className="flex-1 overflow-hidden">
        <div className="bg-[var(--surface-card)] mx-3 mt-3 rounded-2xl divide-y divide-[var(--separator)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
