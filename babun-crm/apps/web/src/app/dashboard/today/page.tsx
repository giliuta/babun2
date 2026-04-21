"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Wallet as WalletIcon,
  MessageSquare,
  AlertTriangle,
  Plus,
  ArrowRight,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import {
  useAppointments,
  useClients,
  useDayExtras,
  useMasters,
  useServices,
  useTeams,
} from "@/app/dashboard/layout";
import { loadChats, getTotalUnread } from "@/lib/chats";
import { computeFinancials } from "@/lib/finance/compute";
import { formatEUR } from "@/lib/money";
import { countWordRu, pluralRecord } from "@/lib/pluralize";
import { getTeamDisplayName } from "@/lib/masters";
import { getCityColor } from "@/lib/day-cities";
import { getPaidAmount, getDebtAmount } from "@/lib/appointments";
import type { Appointment } from "@/lib/appointments";

// Sprint 025 STORY-002. /dashboard/today is the new default landing
// for the dispatcher. Replaces the cold "open calendar and scroll"
// workflow with a pre-answered "what's my day?" screen:
//   * 4 headline stats (visits, money in/expected, chats, overdue)
//   * Time-ordered list of today's appointments (tap → calendar)
//   * FAB for the single most-common write action: создать запись
//
// Calendar is still the source of truth for editing; this page is a
// read-biased overview. MorningBriefing overlay still fires 06:00-10:00
// on first launch of the day, but after dismissal the user lands here
// instead of the grid.

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayLabelRu(d: Date): string {
  const weekday = d.toLocaleDateString("ru", { weekday: "long" });
  const day = d.toLocaleDateString("ru", { day: "numeric", month: "long" });
  return `${weekday[0].toUpperCase()}${weekday.slice(1)}, ${day}`;
}

export default function TodayPage() {
  const router = useRouter();
  const { appointments } = useAppointments();
  const { clients } = useClients();
  const { services } = useServices();
  const { teams } = useTeams();
  const { masters } = useMasters();
  const { getExtrasFor } = useDayExtras();

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const summary = useMemo(() => {
    const todayApts = appointments.filter(
      (a) => a.date === todayKey && a.status !== "cancelled"
    );

    const fin = computeFinancials({
      appointments,
      services,
      teams,
      dayExtrasOf: getExtrasFor,
      standalonePayments: [],
      standaloneExpenses: [],
      range: { from: todayKey, to: todayKey },
      teamFilter: "all",
    });

    let expected = 0;
    for (const a of todayApts) expected += a.total_amount ?? 0;

    let overdueDebt = 0;
    let overdueCount = 0;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    const cutoffKey = toDateKey(cutoff);
    for (const a of appointments) {
      if (a.status !== "completed") continue;
      if (a.date >= cutoffKey) continue;
      const debt = getDebtAmount(a);
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
      already: fin.totalIncome,
      expected: Math.round(expected),
      overdueDebt: Math.round(overdueDebt),
      overdueCount,
      unread,
    };
  }, [appointments, services, teams, getExtrasFor, todayKey]);

  const todayList = useMemo(() => {
    return appointments
      .filter((a) => a.date === todayKey && a.status !== "cancelled")
      .sort((a, b) => a.time_start.localeCompare(b.time_start));
  }, [appointments, todayKey]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <PageHeader
        title="Сегодня"
        subtitle={todayLabelRu(new Date())}
        showBack={false}
      />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 pt-4 space-y-2">
          <Stat
            tone="violet"
            icon={<CalendarClock size={20} strokeWidth={2} />}
            value={
              summary.count === 0
                ? "Ни одной записи"
                : pluralRecord(summary.count)
            }
            hint={
              summary.count > 0
                ? todayList[0]
                  ? `Первый выезд в ${todayList[0].time_start}`
                  : undefined
                : "Свободный день — взять лида?"
            }
          />

          {(summary.already > 0 || summary.expected > 0) && (
            <Stat
              tone="emerald"
              icon={<WalletIcon size={20} strokeWidth={2} />}
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
              href="/dashboard/finances"
            />
          )}

          {summary.unread > 0 && (
            <Stat
              tone="sky"
              icon={<MessageSquare size={20} strokeWidth={2} />}
              value={`${summary.unread} ${countWordRu(summary.unread, "сообщение", "сообщения", "сообщений")} в чатах`}
              hint="Кто-то ждёт ответа"
              href="/dashboard/chats"
            />
          )}

          {summary.overdueDebt > 0 && (
            <Stat
              tone="rose"
              icon={<AlertTriangle size={20} strokeWidth={2} />}
              value={`Должны ${formatEUR(summary.overdueDebt)}`}
              hint={`${summary.overdueCount} ${countWordRu(summary.overdueCount, "клиент", "клиента", "клиентов")} больше 14 дней`}
              href="/dashboard/close-day"
            />
          )}
        </div>

        <div className="px-4 pt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Расписание
            </div>
            <Link
              href="/dashboard"
              className="text-[12px] font-semibold text-violet-600 active:text-violet-800 flex items-center gap-1"
            >
              К календарю <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          </div>

          {todayList.length === 0 ? (
            <div className="bg-white rounded-2xl p-5 text-center text-[13px] text-slate-500">
              Ни одного визита на сегодня.
              <br />
              Самое время занести нового клиента.
            </div>
          ) : (
            <div className="space-y-1.5">
              {todayList.map((apt) => (
                <AppointmentRow
                  key={apt.id}
                  appointment={apt}
                  clientName={
                    apt.client_id
                      ? clients.find((c) => c.id === apt.client_id)?.full_name ??
                        apt.comment
                      : apt.comment || "Событие"
                  }
                  teamLabel={(() => {
                    const t = teams.find((team) => team.id === apt.team_id);
                    return t ? getTeamDisplayName(t, masters) : "—";
                  })()}
                  city={(() => {
                    const t = teams.find((team) => team.id === apt.team_id);
                    return t?.default_city ?? "";
                  })()}
                  onOpen={() => router.push(`/dashboard?date=${apt.date}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <Link
        href="/dashboard?new=1&kind=work"
        aria-label="Создать запись"
        className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)_+_80px)] lg:bottom-8 w-14 h-14 rounded-full bg-violet-600 text-white shadow-[0_10px_25px_-10px_rgba(124,58,237,0.6)] flex items-center justify-center active:scale-[0.94] transition z-20"
      >
        <Plus size={26} strokeWidth={2.5} />
      </Link>
    </div>
  );
}

const TONE: Record<
  "violet" | "emerald" | "sky" | "rose",
  { bg: string; ic: string; text: string; hint: string }
> = {
  violet: {
    bg: "bg-violet-50 border-violet-100",
    ic: "bg-violet-100 text-violet-700",
    text: "text-violet-900",
    hint: "text-violet-700/70",
  },
  emerald: {
    bg: "bg-emerald-50 border-emerald-100",
    ic: "bg-emerald-100 text-emerald-700",
    text: "text-emerald-900",
    hint: "text-emerald-700/70",
  },
  sky: {
    bg: "bg-sky-50 border-sky-100",
    ic: "bg-sky-100 text-sky-700",
    text: "text-sky-900",
    hint: "text-sky-700/70",
  },
  rose: {
    bg: "bg-rose-50 border-rose-100",
    ic: "bg-rose-100 text-rose-700",
    text: "text-rose-900",
    hint: "text-rose-700/70",
  },
};

function Stat({
  tone,
  icon,
  value,
  hint,
  href,
}: {
  tone: keyof typeof TONE;
  icon: React.ReactNode;
  value: string;
  hint?: string;
  href?: string;
}) {
  const t = TONE[tone];
  const content = (
    <>
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.ic}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] font-bold leading-snug ${t.text}`}>
          {value}
        </div>
        {hint && <div className={`text-[11px] mt-0.5 ${t.hint}`}>{hint}</div>}
      </div>
      {href && <ArrowRight size={14} className={t.hint} />}
    </>
  );
  const cls = `flex items-center gap-3 px-4 py-3 rounded-2xl border ${t.bg} active:scale-[0.99] transition`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  return <div className={cls}>{content}</div>;
}

function AppointmentRow({
  appointment,
  clientName,
  teamLabel,
  city,
  onOpen,
}: {
  appointment: Appointment;
  clientName: string;
  teamLabel: string;
  city: string;
  onOpen: () => void;
}) {
  const paid = getPaidAmount(appointment);
  const debt = getDebtAmount(appointment);
  const statusLabel =
    appointment.status === "completed"
      ? debt > 0
        ? "долг"
        : "оплачено"
      : appointment.status === "in_progress"
        ? "в работе"
        : "запланировано";
  const statusTone =
    appointment.status === "completed"
      ? debt > 0
        ? "bg-rose-50 text-rose-700"
        : "bg-emerald-50 text-emerald-700"
      : appointment.status === "in_progress"
        ? "bg-violet-50 text-violet-700"
        : "bg-slate-100 text-slate-600";
  const cityColor = city ? getCityColor(city) : "#64748b";

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 bg-white rounded-2xl px-3 py-2.5 text-left active:bg-slate-50 transition"
    >
      <div className="flex flex-col items-center justify-center w-14 shrink-0">
        <span className="text-[15px] font-semibold text-slate-900 tabular-nums">
          {appointment.time_start}
        </span>
        <span className="text-[10px] text-slate-400 tabular-nums">
          {appointment.time_end}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-slate-900 truncate">
          {clientName || "—"}
        </div>
        <div className="text-[11px] text-slate-500 truncate flex items-center gap-1.5">
          {city && (
            <span style={{ color: cityColor }} className="font-semibold">
              {city}
            </span>
          )}
          {city && <span className="text-slate-300">·</span>}
          <span className="truncate">{teamLabel}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {(appointment.total_amount ?? 0) > 0 && (
          <span className="text-[13px] font-semibold text-slate-900 tabular-nums">
            {formatEUR(appointment.total_amount)}
          </span>
        )}
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusTone}`}>
          {statusLabel}
          {paid > 0 && debt > 0 && ` · ${formatEUR(paid)}`}
        </span>
      </div>
    </button>
  );
}
