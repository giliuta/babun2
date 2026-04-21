"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Wallet as WalletIcon,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import type { Appointment } from "@/lib/appointments";
import type { Service } from "@/lib/services";
import type { Team } from "@/lib/masters";
import type { DayExtra } from "@/lib/day-extras";
import { computeFinancials } from "@/lib/finance/compute";
import { loadChats, getTotalUnread } from "@/lib/chats";
import { formatEUR } from "@/lib/money";
import { countWordRu } from "@/lib/pluralize";

interface MorningBriefingProps {
  appointments: Appointment[];
  services: Service[];
  teams: Team[];
  dayExtrasOf: (teamId: string, dateKey: string) => DayExtra[];
}

// Once-per-day full-screen briefing shown when the dispatcher opens
// Babun for the first time between 06:00 and 10:00 local. Answers
// "что меня ждёт сегодня" before he taps anything: visit count, first
// departure, expected revenue, unread chats, overdue debts. Dismiss
// stores `babun:briefing:YYYY-MM-DD` so subsequent opens stay quiet.
//
// Sprint 019 F1. Replaces "open app blind, find out at 08:55 about
// 09:00 visit" with a 5-second answer.

const DISMISS_PREFIX = "babun:briefing:";

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayLabelRu(d: Date): string {
  const weekday = d.toLocaleDateString("ru", { weekday: "long" });
  const day = d.toLocaleDateString("ru", { day: "numeric", month: "long" });
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${day}`;
}

export default function MorningBriefing({
  appointments,
  services,
  teams,
  dayExtrasOf,
}: MorningBriefingProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = new Date();
    const hour = now.getHours();
    if (hour < 6 || hour >= 10) return;
    const key = `${DISMISS_PREFIX}${toDateKey(now)}`;
    if (window.localStorage.getItem(key) === "1") return;
    setOpen(true);
  }, []);

  const dismiss = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        `${DISMISS_PREFIX}${toDateKey(new Date())}`,
        "1"
      );
    }
    setOpen(false);
  };

  const summary = useMemo(() => {
    const todayKey = toDateKey(new Date());
    const todayApts = appointments.filter(
      (a) => a.date === todayKey && a.status !== "cancelled"
    );
    const sortedFuture = [...todayApts].sort((a, b) =>
      a.time_start.localeCompare(b.time_start)
    );
    const firstTime = sortedFuture[0]?.time_start ?? null;

    const fin = computeFinancials({
      appointments,
      services,
      teams,
      dayExtrasOf,
      standalonePayments: [],
      standaloneExpenses: [],
      range: { from: todayKey, to: todayKey },
      teamFilter: "all",
    });

    // Expected = paid + still-open total. Stored amounts are euros.
    let expected = 0;
    for (const a of todayApts) {
      expected += a.total_amount ?? 0;
    }

    // Overdue debts: completed visits older than 14 d that aren't paid.
    let overdueDebt = 0;
    let overdueCount = 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffKey = toDateKey(cutoff);
    for (const a of appointments) {
      if (a.status !== "completed") continue;
      if (a.date >= cutoffKey) continue;
      const paid =
        (a.prepaid_amount ?? 0) +
        (a.payments ?? []).reduce((s, p) => s + p.amount, 0);
      const debt = Math.max(0, (a.total_amount ?? 0) - paid);
      if (debt > 0) {
        overdueDebt += debt;
        overdueCount += 1;
      }
    }

    let unread = 0;
    if (typeof window !== "undefined") {
      try {
        unread = getTotalUnread(loadChats());
      } catch {
        unread = 0;
      }
    }

    return {
      count: todayApts.length,
      firstTime,
      already: fin.totalIncome,
      expected: Math.round(expected),
      overdueDebt: Math.round(overdueDebt),
      overdueCount,
      unread,
    };
  }, [appointments, services, teams, dayExtrasOf]);

  if (!open) return null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 9) return "Доброе утро";
    return "Доброго дня";
  })();

  return (
    <div
      className="fixed inset-0 z-[95] bg-[var(--surface-grouped)] flex flex-col"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
    >
      <div className="flex-1 overflow-y-auto px-5 pt-8 pb-4">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--accent)]">
          {greeting}
        </div>
        <h1 className="mt-2 text-[28px] font-bold text-[var(--label)] leading-tight tracking-tight">
          {todayLabelRu(new Date())}
        </h1>

        <div className="mt-7 space-y-2.5">
          <Stat
            tone="violet"
            icon={<CalendarClock size={18} strokeWidth={2} />}
            value={
              summary.count === 0
                ? "Ни одной записи"
                : `${summary.count} ${countWord(summary.count, "запись", "записи", "записей")}`
            }
            hint={
              summary.firstTime
                ? `Первый выезд в ${summary.firstTime}`
                : "Свободный день — взять лида?"
            }
          />

          {(summary.already > 0 || summary.expected > 0) && (
            <Stat
              tone="emerald"
              icon={<WalletIcon size={18} strokeWidth={2} />}
              value={
                summary.already > 0
                  ? `+${formatEUR(summary.already)} в кассе`
                  : `${formatEUR(summary.expected)} ожидаем`
              }
              hint={
                summary.already > 0 && summary.expected > summary.already
                  ? `Ещё ${formatEUR(summary.expected - summary.already)} к получению`
                  : summary.expected > 0
                    ? "К получению за день"
                    : ""
              }
            />
          )}

          {summary.unread > 0 && (
            <Stat
              tone="sky"
              icon={<MessageSquare size={18} strokeWidth={2} />}
              value={`${summary.unread} ${countWord(summary.unread, "сообщение", "сообщения", "сообщений")} в чатах`}
              hint="Кто-то ждёт ответа"
            />
          )}

          {summary.overdueDebt > 0 && (
            <Stat
              tone="rose"
              icon={<AlertTriangle size={18} strokeWidth={2} />}
              value={`Должны ${formatEUR(summary.overdueDebt)}`}
              hint={`${summary.overdueCount} ${countWord(summary.overdueCount, "клиент", "клиента", "клиентов")} больше 14 дней`}
            />
          )}
        </div>
      </div>

      <div className="px-5 pt-2 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            dismiss();
            router.push("/dashboard");
          }}
          className="w-full h-[50px] rounded-[12px] bg-[var(--accent)] text-white text-[17px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] transition"
        >
          К календарю
        </button>
        {summary.unread > 0 && (
          <button
            type="button"
            onClick={() => {
              dismiss();
              router.push("/dashboard/chats");
            }}
            className="w-full h-11 rounded-[10px] bg-[var(--accent-tint)] text-[var(--accent)] text-[15px] font-semibold active:opacity-75 transition"
          >
            Ответить в чатах
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          className="w-full h-11 text-[var(--label-secondary)] text-[15px] active:bg-[var(--fill-quaternary)] rounded-[10px]"
        >
          Скрыть до завтра
        </button>
      </div>
    </div>
  );
}

// Soft tinted tile + strong label + muted hint — iOS Numbers stat cell.
const TONE: Record<
  "violet" | "emerald" | "sky" | "rose",
  { bg: string; ic: string }
> = {
  violet: { bg: "bg-[var(--accent-tint)]", ic: "bg-[var(--accent)]" },
  emerald: { bg: "bg-[#E6F7EC]", ic: "bg-[var(--system-green)]" },
  sky: { bg: "bg-[#E6F4FA]", ic: "bg-[var(--system-blue)]" },
  rose: { bg: "bg-[#FCE7EA]", ic: "bg-[var(--system-red)]" },
};

function Stat({
  tone,
  icon,
  value,
  hint,
}: {
  tone: keyof typeof TONE;
  icon: React.ReactNode;
  value: string;
  hint?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-[14px] ${t.bg}`}>
      <span
        className={`w-9 h-9 rounded-[9px] flex items-center justify-center text-white shrink-0 ${t.ic}`}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-[var(--label)] leading-snug">
          {value}
        </div>
        {hint && (
          <div className="text-[12px] mt-0.5 text-[var(--label-secondary)]">{hint}</div>
        )}
      </div>
    </div>
  );
}

// `countWord` was inlined here in Sprint 020; Sprint 024 promotes it
// to lib/pluralize.ts as `countWordRu` so other surfaces (clients
// list, sidebar badges, chat counters) reuse the same agreement.
const countWord = countWordRu;
