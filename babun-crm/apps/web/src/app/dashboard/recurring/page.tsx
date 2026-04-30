"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, X, RotateCw, StickyNote } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { dueReminders, type RecurringReminder } from "@babun/shared/local/recurring";
import {
  listRecurringReminders,
  updateReminderStatus,
  deleteRecurringReminder,
} from "@babun/shared/db/repositories/recurring-reminders";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import { useRealtimeTenantSync } from "@/hooks/useRealtimeTenantSync";

// Due-reminder inbox. Lists every recurring follow-up whose next_due_date
// is within 14 days or already past. Tapping an item lets the dispatcher
// (a) call the phone, (b) mark it booked so it disappears, or (c)
// dismiss permanently. Nothing is edited here — bookings are made from
// the calendar with the client pre-selected.

export default function RecurringPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const tenantId = useTenantId();
  const [items, setItems] = useState<RecurringReminder[]>([]);
  const [showAll, setShowAll] = useState(false);

  // STORY-050 — lift-and-shift to Supabase. The list lives on the
  // current tenant; mutations write through and dispatch the same
  // `babun:recurring-changed` event that the Sidebar badge listens to.
  const refresh = () => {
    const supabase = getSupabaseBrowser();
    void listRecurringReminders(supabase, tenantId)
      .then(setItems)
      .catch((err) => {
        console.warn("STORY-050: listRecurringReminders failed", err);
      });
  };
  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("babun:recurring-changed", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener("babun:recurring-changed", onChange);
      window.removeEventListener("focus", onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // STORY-048 — realtime: another tab / device updates a reminder
  // and the inbox refreshes without F5.
  useRealtimeTenantSync({
    supabase: getSupabaseBrowser(),
    table: "recurring_reminders",
    tenantId,
    onInsert: refresh,
    onUpdate: refresh,
    onDelete: refresh,
    onResync: refresh,
  });

  const due = useMemo(() => dueReminders(items), [items]);
  const future = useMemo(
    () =>
      items
        .filter((r) => r.status === "pending" && !due.includes(r))
        .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)),
    [items, due]
  );

  const visible = showAll ? [...due, ...future] : due;
  const totalPending = due.length + future.length;

  return (
    <>
      <PageHeader
        title={`Напоминания${due.length > 0 ? ` (${due.length})` : ""}`}
      />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
          {totalPending === 0 ? (
            <EmptyState
              icon={<RotateCw size={24} strokeWidth={2} />}
              title="Нет повторных напоминаний"
              description="После выполненной записи ⋯ → «Повторить через…» создаст карточку. Мы сами подскажем, когда звонить."
            />
          ) : (
            <>
              {visible.map((r) => (
                <RecurringCard
                  key={r.id}
                  item={r}
                  onBooked={() => {
                    // Optimistic local hide while the round-trip runs.
                    setItems((prev) =>
                      prev.map((it) =>
                        it.id === r.id ? { ...it, status: "booked" } : it,
                      ),
                    );
                    const supabase = getSupabaseBrowser();
                    void updateReminderStatus(supabase, r.id, "booked")
                      .then(() => {
                        window.dispatchEvent(new Event("babun:recurring-changed"));
                      })
                      .catch((err) => {
                        // eslint-disable-next-line no-console
                        console.warn("STORY-050: updateReminderStatus failed", err);
                        refresh();
                      });
                  }}
                  onDismiss={async () => {
                    if (await confirm({ title: "Удалить напоминание?" })) {
                      setItems((prev) => prev.filter((it) => it.id !== r.id));
                      const supabase = getSupabaseBrowser();
                      void deleteRecurringReminder(supabase, r.id)
                        .then(() => {
                          window.dispatchEvent(
                            new Event("babun:recurring-changed"),
                          );
                        })
                        .catch((err) => {
                          // eslint-disable-next-line no-console
                          console.warn(
                            "STORY-050: deleteRecurringReminder failed",
                            err,
                          );
                          refresh();
                        });
                    }
                  }}
                  onBook={() => {
                    router.push(
                      `/dashboard?new=1&client_id=${r.client_id}&date=${r.next_due_date}`
                    );
                  }}
                />
              ))}

              {!showAll && future.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="w-full mt-2 h-11 rounded-[10px] border border-dashed border-[var(--separator)] text-[var(--label-secondary)] text-[13px] font-medium active:bg-[var(--fill-quaternary)]"
                >
                  Показать ещё {future.length} на потом
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function RecurringCard({
  item,
  onBook,
  onBooked,
  onDismiss,
}: {
  item: RecurringReminder;
  onBook: () => void;
  onBooked: () => void;
  onDismiss: () => void;
}) {
  const daysUntil = daysBetween(new Date(), dateFromKey(item.next_due_date));
  const overdue = daysUntil < 0;
  const phoneDigits = item.phone.replace(/\D/g, "");

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[15px] font-semibold text-[var(--label)] truncate">
              {item.client_name}
            </div>
            {overdue ? (
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--system-red)] bg-[rgba(255,59,48,0.1)] px-1.5 py-0.5 rounded">
                просрочено
              </span>
            ) : daysUntil <= 3 ? (
              <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--system-orange)] bg-[rgba(255,149,0,0.1)] px-1.5 py-0.5 rounded">
                скоро
              </span>
            ) : null}
          </div>
          {item.service_summary && (
            <div className="text-[12px] text-[var(--label-secondary)] truncate mt-0.5">
              {item.service_summary}
            </div>
          )}
          <div className="text-[12px] text-[var(--label-tertiary)] mt-1 tabular-nums">
            {overdue
              ? `${Math.abs(daysUntil)} дн. назад · ${item.next_due_date}`
              : daysUntil === 0
                ? `Сегодня · ${item.next_due_date}`
                : `Через ${daysUntil} дн. · ${item.next_due_date}`}
          </div>
          {item.note && (
            <div className="flex items-start gap-1 text-[12px] text-[var(--label-secondary)] mt-1">
              <StickyNote size={12} className="mt-0.5 shrink-0" strokeWidth={2} />
              <span>{item.note}</span>
            </div>
          )}
        </div>
        {phoneDigits && (
          <a
            href={`tel:${phoneDigits}`}
            className="w-10 h-10 rounded-[10px] bg-[rgba(52,199,89,0.12)] text-[var(--system-green)] flex items-center justify-center active:bg-[rgba(52,199,89,0.2)] shrink-0"
            aria-label="Позвонить"
          >
            <Phone size={18} strokeWidth={2} />
          </a>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onBook}
          className="flex-1 h-10 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold active:scale-[0.99] active:bg-[var(--accent-pressed)] transition"
        >
          Записать
        </button>
        <button
          type="button"
          onClick={onBooked}
          className="flex-1 h-10 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[13px] font-medium active:bg-[var(--fill-secondary)]"
        >
          Записано
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Удалить"
          className="w-10 h-10 rounded-[10px] text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] flex items-center justify-center"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(from: Date, to: Date): number {
  const one = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const two = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((two.getTime() - one.getTime()) / (24 * 60 * 60 * 1000));
}
