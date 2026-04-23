"use client";

// Sprint 033 Phase I42 — Brigade permissions (placeholder).
//
// В разделе бригады отдельная страница «Доступы»: настройка, что
// каждый мастер этой бригады может делать внутри её календаря —
// создавать записи, менять метку, редактировать, удалять, видеть
// финансы, etc. Это уточнение глобальных permissions из /masters/
// [id]/access, но scope-ограниченное одной бригадой.
//
// Инфраструктура пермишенов ещё не финализирована — на этот заход
// страница показывает список участников бригады и плашку «скоро»
// рядом с каждым, плюс краткое объяснение что здесь будет. Данные
// хранятся на master, а не тут — оставляем для следующего коммита.

import { use } from "react";
import { ShieldCheck, Users } from "lucide-react";
import {
  useMasters,
  useTeams,
} from "@/app/dashboard/layout";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import {
  getInitials,
  getTeamLeadIds,
  ROLE_LABELS,
  type Master,
  type Team,
} from "@/lib/masters";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function BrigadePermissionsPage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams } = useTeams();
  const { masters } = useMasters();
  const team = teams.find((t) => t.id === id);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Доступы" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  const memberIds = [
    ...getTeamLeadIds(team),
    ...(team.helper_ids ?? []),
  ];
  const membersList: Master[] = Array.from(new Set(memberIds))
    .map((mid) => masters.find((m) => m.id === mid))
    .filter((m): m is Master => Boolean(m));

  return (
    <BrigadeSectionShell brigadeId={id} title="Доступы" hideSave>
      {/* Пояснение о назначении страницы */}
      <div className="bg-[var(--accent-tint)] rounded-[var(--radius-card)] p-4 flex items-start gap-3">
        <span className="w-9 h-9 rounded-lg bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center shrink-0">
          <ShieldCheck size={18} strokeWidth={2} />
        </span>
        <div className="flex-1 text-[13px] text-[var(--label)] leading-snug">
          <div className="font-semibold text-[14px] mb-1">
            Доступы к календарю бригады
          </div>
          Здесь вы настроите, что каждый мастер этой бригады может
          делать в её календаре — создавать записи, менять метку дня,
          редактировать, удалять, видеть финансы. Список пермишенов
          ещё в проработке.
        </div>
      </div>

      {/* Список участников */}
      <Group
        title="Участники бригады"
        footer="Тап откроет настройку доступа для этого мастера внутри бригады."
      >
        {membersList.length === 0 ? (
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-8 text-center text-[13px] text-[var(--label-tertiary)]">
            <Users
              size={28}
              strokeWidth={1.5}
              className="mx-auto mb-2 text-[var(--label-quaternary)]"
            />
            В этой бригаде пока нет мастеров. Добавьте через «Мастера».
          </div>
        ) : (
          <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
            {membersList.map((m) => (
              <MemberRow key={m.id} master={m} team={team} />
            ))}
          </div>
        )}
      </Group>
    </BrigadeSectionShell>
  );
}

function MemberRow({ master, team }: { master: Master; team: Team }) {
  const leadIds = getTeamLeadIds(team);
  const isLead = leadIds.includes(master.id);
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--label-on-accent)] font-semibold text-[13px] shrink-0"
        style={{ backgroundColor: team.color }}
      >
        {getInitials(master.full_name)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium text-[var(--label)] truncate">
          {master.full_name}
        </div>
        <div className="text-[12px] text-[var(--label-tertiary)] truncate">
          {isLead ? "Бригадир" : "Помощник"} · {ROLE_LABELS[master.role]}
        </div>
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-tertiary)]">
        скоро
      </span>
    </div>
  );
}

function Group({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
      </div>
      {children}
      {footer && (
        <div className="px-4 pt-1.5 text-[12px] text-[var(--label-tertiary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}
