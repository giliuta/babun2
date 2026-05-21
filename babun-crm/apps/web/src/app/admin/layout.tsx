// STORY-070 — Admin shell. Auth-gated by is_platform_admin() RPC.
// Non-admins get redirected to /. Admins see a sidebar + main area
// across every /admin/* route.

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import AdminSidebar from "@/components/admin/AdminSidebar";

// v691 / Audit-2026-05-21 P1-43 — root layout uses
//   title: { template: "%s · Babun" }
// which turned «Babun · Admin» into «Babun · Admin · Babun». Use
// the `absolute` form to skip the template and render just one
// «· Babun» suffix.
export const metadata = {
  title: {
    absolute: "Admin · Babun",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc("is_platform_admin");

  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--surface-grouped)] p-6">
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-6 max-w-md text-center">
          <div className="text-[18px] font-semibold text-[var(--label)] mb-2">
            Доступ только для администратора платформы
          </div>
          <p className="text-[13px] text-[var(--label-secondary)] mb-4 leading-snug">
            Эта область — для команды Babun. Если вы видите эту страницу по ошибке, вернитесь к рабочему кабинету.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex h-10 px-4 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold items-center"
          >
            ← К дашборду
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex bg-[var(--surface-grouped)]">
      <AdminSidebar adminEmail={user.email ?? ""} />
      <main className="flex-1 min-w-0 lg:ml-[240px] flex flex-col">
        {children}
      </main>
    </div>
  );
}
