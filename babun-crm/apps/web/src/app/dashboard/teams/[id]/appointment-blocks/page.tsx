"use client";

// Sprint 033 Phase I42 — Brigade appointment-sheet layout.
//
// Each brigade can toggle which optional blocks show up when someone
// creates or edits a visit on this brigade's calendar. Client +
// services are always on (sticky rows at the top, disabled switches
// to make the rule visible, not hidden by omission). Everything else
// — address, comment, photos, prepay, expenses, reminder, source —
// is opt-in per brigade.
//
// Wiring to the AppointmentSheet itself lands in a follow-up commit;
// this page just persists the flags onto team.appointment_blocks so
// the data structure is ready.

import { use } from "react";
import { Check } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { useTeams } from "@/app/dashboard/layout";
import IOSSwitch from "@/components/ui/IOSSwitch";
import BrigadeSectionShell from "@/components/teams/BrigadeSectionShell";
import {
  type BrigadeAppointmentBlocks,
} from "@/lib/masters";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type BlockKey = keyof BrigadeAppointmentBlocks;

const OPTIONAL_BLOCKS: Array<{
  key: BlockKey;
  label: string;
  description: string;
  defaultOn: boolean;
}> = [
  {
    key: "show_address",
    label: "Адрес",
    description: "Поле для адреса визита отдельно от клиента.",
    defaultOn: true,
  },
  {
    key: "show_address_note",
    label: "Заметка к адресу",
    description: "«Зелёная дверь, звонок» — подсказка бригаде у порога.",
    defaultOn: true,
  },
  {
    key: "show_comment",
    label: "Комментарий",
    description: "Свободный текст к записи.",
    defaultOn: true,
  },
  {
    key: "show_photos",
    label: "Фото до / после",
    description: "Блок загрузки фото по визиту.",
    defaultOn: true,
  },
  {
    key: "show_prepaid",
    label: "Аванс / предоплата",
    description: "Сумма, которую клиент внёс заранее.",
    defaultOn: false,
  },
  {
    key: "show_payment",
    label: "Способы оплаты",
    description: "Нал / карта / сплит при закрытии визита.",
    defaultOn: true,
  },
  {
    key: "show_expenses",
    label: "Расходы",
    description: "Материалы, транспорт, прочие издержки визита.",
    defaultOn: true,
  },
  {
    key: "show_reminder",
    label: "Напоминание клиенту",
    description: "SMS за X минут до начала.",
    defaultOn: false,
  },
  {
    key: "show_source",
    label: "Источник заявки",
    description: "Откуда пришёл клиент — Instagram / WhatsApp / онлайн.",
    defaultOn: false,
  },
];

export default function BrigadeAppointmentBlocksPage({ params }: RouteParams) {
  const { id } = use(params);
  const { teams, upsertTeam } = useTeams();
  const team = teams.find((t) => t.id === id);

  if (!team) {
    return (
      <BrigadeSectionShell brigadeId={id} title="Запись" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Бригада не найдена.
        </div>
      </BrigadeSectionShell>
    );
  }

  const blocks = team.appointment_blocks ?? {};

  const toggle = (key: BlockKey, current: boolean) => {
    haptic("tap");
    upsertTeam({
      ...team,
      appointment_blocks: {
        ...blocks,
        [key]: !current,
      },
    });
  };

  const resetToDefaults = () => {
    haptic("warning");
    upsertTeam({
      ...team,
      appointment_blocks: undefined,
    });
  };

  const isEnabled = (b: (typeof OPTIONAL_BLOCKS)[number]) =>
    blocks[b.key] ?? b.defaultOn;

  return (
    <BrigadeSectionShell brigadeId={id} title="Запись" hideSave>
      {/* ── Базовые (всегда видимы) ─────────────────────── */}
      <Group
        title="Всегда включены"
        footer="Клиент и услуги — основа записи. Отключить нельзя."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          <Locked label="Клиент" />
          <Locked label="Услуги" last />
        </div>
      </Group>

      {/* ── Опциональные блоки ─────────────────────────── */}
      <Group
        title="Дополнительные блоки"
        footer="Перестраивает форму записи только в этой бригаде. Например, одна команда фоткает работу до/после — включаем; другая никогда — отключаем, и блок перестанет маячить в глазах."
      >
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
          {OPTIONAL_BLOCKS.map((b) => {
            const on = isEnabled(b);
            return (
              <div
                key={b.key}
                className="flex items-start gap-3 px-4 py-3 min-h-[56px]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] text-[var(--label)]">
                    {b.label}
                  </div>
                  <div className="text-[12px] text-[var(--label-tertiary)] leading-snug mt-0.5">
                    {b.description}
                  </div>
                </div>
                <IOSSwitch
                  checked={on}
                  onChange={() => toggle(b.key, on)}
                  ariaLabel={b.label}
                />
              </div>
            );
          })}
        </div>
      </Group>

      {team.appointment_blocks && (
        <button
          type="button"
          onClick={resetToDefaults}
          className="w-full h-12 flex items-center justify-center rounded-[var(--radius-card)] bg-[var(--surface-card)] text-[var(--accent)] text-[14px] font-medium press-scale active:bg-[var(--fill-quaternary)] shadow-[var(--shadow-card)]"
        >
          Сбросить к стандартным
        </button>
      )}
    </BrigadeSectionShell>
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

function Locked({ label, last }: { label: string; last?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 min-h-[48px] ${
        last ? "" : "border-b border-[var(--separator)]"
      }`}
    >
      <span className="w-5 h-5 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
        <Check size={12} strokeWidth={3} />
      </span>
      <span className="flex-1 text-[15px] text-[var(--label)]">{label}</span>
      <span className="text-[11px] text-[var(--label-tertiary)] uppercase tracking-wider">
        всегда
      </span>
    </div>
  );
}
