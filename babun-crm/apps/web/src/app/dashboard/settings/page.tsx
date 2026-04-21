"use client";

import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Users as UsersIcon,
  UserCircle2,
  MessageSquare,
  Wrench,
  Building2,
  ChevronRight,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { useFormSettings } from "@/app/dashboard/layout";
import type {
  FormFieldVisibility,
  RequiredFields,
} from "@/lib/appointments";

// Sprint 028: redesigned in iOS grouped-list / Telegram settings style.
// Monochrome lucide icons replace decorative emojis ("🗓📍👥🧑‍🔧💬🔧🏢"),
// each icon sits in a tinted rounded-square tile. Typography follows
// system-UI conventions: 17px row label, 13px caption, 12px uppercase
// section header. The three settings cards below the nav use the same
// divided rounded-rectangle pattern as the nav card.

const FIELD_VIS_LABELS: Record<keyof FormFieldVisibility, string> = {
  show_address: "Адрес",
  show_comment: "Комментарий",
  show_prepaid: "Аванс / предоплата",
  show_payments: "Способы оплаты",
  show_source: "Источник заявки (скоро)",
  show_reminder: "Напоминание клиенту (скоро)",
};

const REQUIRED_LABELS: Record<keyof RequiredFields, string> = {
  require_client: "Клиент обязателен",
  require_phone: "Телефон клиента обязателен",
  require_services: "Услуги обязательны",
  require_address: "Адрес обязателен",
  require_comment: "Комментарий обязателен",
};

const DISABLED_FIELD_VIS: (keyof FormFieldVisibility)[] = [
  "show_source",
  "show_reminder",
];

interface NavSection {
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Tailwind bg colour for the icon tile — mirrors iOS Settings. */
  tone: string;
  title: string;
  desc: string;
}

const NAV_SECTIONS: NavSection[] = [
  {
    href: "/dashboard/settings/calendar",
    icon: CalendarDays,
    tone: "bg-[var(--tile-orange)]",
    title: "Календарь",
    desc: "Часы работы, шаг сетки, часовой пояс",
  },
  {
    href: "/dashboard/settings/cities",
    icon: MapPin,
    tone: "bg-[var(--tile-red)]",
    title: "Города",
    desc: "Справочник городов для клиентов и записей",
  },
  {
    href: "/dashboard/teams",
    icon: UsersIcon,
    tone: "bg-[var(--tile-blue)]",
    title: "Бригады",
    desc: "Состав команд, цвета, дефолтный город, % ЗП",
  },
  {
    href: "/dashboard/masters",
    icon: UserCircle2,
    tone: "bg-[var(--tile-indigo)]",
    title: "Мастера",
    desc: "Сотрудники, контакты, зарплата, доступы, документы",
  },
  {
    href: "/dashboard/sms-templates",
    icon: MessageSquare,
    tone: "bg-[var(--tile-mint)]",
    title: "Шаблоны SMS",
    desc: "Тексты напоминаний и подтверждений",
  },
  {
    href: "/dashboard/services",
    icon: Wrench,
    tone: "bg-[var(--tile-purple)]",
    title: "Услуги и категории",
    desc: "Каталог услуг, цены, длительность",
  },
  {
    href: "/dashboard/settings/company",
    icon: Building2,
    tone: "bg-[var(--system-indigo)]",
    title: "Реквизиты и VAT",
    desc: "Название, VAT-номер, режим 19% для счетов",
  },
];

export default function SettingsPage() {
  const { fieldVisibility, setFieldVisibility, requiredFields, setRequiredFields } =
    useFormSettings();

  const toggleFieldVis = (key: keyof FormFieldVisibility) => {
    if (DISABLED_FIELD_VIS.includes(key)) return;
    setFieldVisibility({ ...fieldVisibility, [key]: !fieldVisibility[key] });
  };

  const toggleRequired = (key: keyof RequiredFields) => {
    setRequiredFields({ ...requiredFields, [key]: !requiredFields[key] });
  };

  return (
    <>
      <PageHeader title="Настройки" />

      <div className="flex-1 overflow-y-auto bg-[var(--fill-tertiary)]">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-5">
          <Group title="Разделы">
            <div className="divide-y divide-[var(--separator)]">
              {NAV_SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="flex items-center gap-3 px-4 py-3 active:bg-[var(--fill-tertiary)] transition-colors"
                  >
                    <span
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${s.tone}`}
                    >
                      <Icon size={18} strokeWidth={2} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-medium text-[var(--label)] truncate">
                        {s.title}
                      </div>
                      <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 truncate">
                        {s.desc}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-[var(--label-quaternary)] shrink-0" />
                  </Link>
                );
              })}
            </div>
          </Group>

          <Group title="Учётная запись">
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-[15px] text-[var(--label)]">Email</span>
              <span className="text-[13px] text-[var(--label-secondary)] tabular-nums">
                airfix.cy@gmail.com
              </span>
            </div>
          </Group>

          <Group
            title="Поля записи"
            footer="Какие поля показывать в форме создания визита"
          >
            <div className="divide-y divide-[var(--separator)]">
              {(Object.keys(FIELD_VIS_LABELS) as (keyof FormFieldVisibility)[]).map(
                (key) => {
                  const disabled = DISABLED_FIELD_VIS.includes(key);
                  return (
                    <ToggleRow
                      key={key}
                      label={FIELD_VIS_LABELS[key]}
                      checked={fieldVisibility[key]}
                      onChange={() => toggleFieldVis(key)}
                      disabled={disabled}
                    />
                  );
                }
              )}
            </div>
          </Group>

          <Group
            title="Обязательные поля"
            footer="Без заполнения этих полей запись нельзя сохранить"
          >
            <div className="divide-y divide-[var(--separator)]">
              {(Object.keys(REQUIRED_LABELS) as (keyof RequiredFields)[]).map((key) => (
                <ToggleRow
                  key={key}
                  label={REQUIRED_LABELS[key]}
                  checked={requiredFields[key]}
                  onChange={() => toggleRequired(key)}
                />
              ))}
            </div>
          </Group>
        </div>
      </div>
    </>
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
      <div className="px-4 pb-2 text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        {title}
      </div>
      <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        {children}
      </div>
      {footer && (
        <div className="px-4 pt-2 text-[11px] text-[var(--label-tertiary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 min-h-[48px] ${
        disabled ? "opacity-50" : ""
      }`}
    >
      <span className="text-[15px] text-[var(--label)] flex-1">{label}</span>
      <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        aria-label={label}
        className={`relative w-[46px] h-[28px] rounded-full transition-colors flex-shrink-0 ${
          checked ? "bg-[var(--system-green)]" : "bg-[var(--fill-primary)]"
        } ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-6 h-6 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
