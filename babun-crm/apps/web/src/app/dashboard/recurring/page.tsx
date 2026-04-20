"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import {
  loadRecurring,
  dueReminders,
  markStatus,
  removeRecurring,
  type RecurringReminder,
} from "@/lib/recurring";

// Due-reminder inbox. Lists every recurring follow-up whose next_due_date
// is within 14 days or already past. Tapping an item lets the dispatcher
// (a) call the phone, (b) mark it booked so it disappears, or (c)
// dismiss permanently. Nothing is edited here — bookings are made from
// the calendar with the client pre-selected.

export default function RecurringPage() {
  const router = useRouter();
  const [items, setItems] = useState<RecurringReminder[]>([]);
  const [showAll, setShowAll] = useState(false);

  const refresh = () => setItems(loadRecurring());
  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("babun:recurring-changed", onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener("babun:recurring-changed", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, []);

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

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-3xl mx-auto p-3 lg:p-4 space-y-3">
          {totalPending === 0 ? (
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.77.95 6.5 2.5" />
                  <polyline points="21 3 21 9 15 9" />
                </svg>
              }
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
                    markStatus(r.id, "booked");
                    refresh();
                  }}
                  onDismiss={() => {
                    if (window.confirm("Удалить напоминание?")) {
                      removeRecurring(r.id);
                      refresh();
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
                  className="w-full mt-2 h-11 rounded-xl border border-dashed border-slate-300 text-slate-500 text-[13px] font-medium active:bg-slate-100"
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
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[15px] font-semibold text-slate-900 truncate">
              {item.client_name}
            </div>
            {overdue ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                просрочено
              </span>
            ) : daysUntil <= 3 ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                скоро
              </span>
            ) : null}
          </div>
          {item.service_summary && (
            <div className="text-[12px] text-slate-500 truncate mt-0.5">
              {item.service_summary}
            </div>
          )}
          <div className="text-[11px] text-slate-400 mt-1 tabular-nums">
            {overdue
              ? `${Math.abs(daysUntil)} дн. назад · ${item.next_due_date}`
              : daysUntil === 0
                ? `Сегодня · ${item.next_due_date}`
                : `Через ${daysUntil} дн. · ${item.next_due_date}`}
          </div>
          {item.note && (
            <div className="text-[12px] text-slate-500 mt-1">📝 {item.note}</div>
          )}
        </div>
        {phoneDigits && (
          <a
            href={`tel:${phoneDigits}`}
            className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center active:bg-emerald-100 shrink-0"
            aria-label="Позвонить"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
            </svg>
          </a>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onBook}
          className="flex-1 h-10 rounded-lg bg-violet-600 text-white text-[13px] font-semibold active:scale-[0.99]"
        >
          Записать
        </button>
        <button
          type="button"
          onClick={onBooked}
          className="flex-1 h-10 rounded-lg bg-slate-100 text-slate-700 text-[13px] font-medium active:bg-slate-200"
        >
          Записано
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Удалить"
          className="w-10 h-10 rounded-lg text-slate-400 active:bg-slate-100"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
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
