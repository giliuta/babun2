"use client";

import { useRef, useState } from "react";
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
  Download,
  Upload,
  Trash2,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { useFormSettings } from "@/app/dashboard/layout";
import type {
  FormFieldVisibility,
  RequiredFields,
} from "@/lib/appointments";
import {
  exportBackup,
  importBackup,
  clearBackup,
  downloadBackup,
  readBackupFile,
  type BackupPayload,
} from "@/lib/backup";
import { BUILD_VERSION } from "@/lib/version";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { haptic } from "@/lib/haptics";

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
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string>("");

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3500);
  };

  const toggleFieldVis = (key: keyof FormFieldVisibility) => {
    if (DISABLED_FIELD_VIS.includes(key)) return;
    setFieldVisibility({ ...fieldVisibility, [key]: !fieldVisibility[key] });
  };

  const toggleRequired = (key: keyof RequiredFields) => {
    setRequiredFields({ ...requiredFields, [key]: !requiredFields[key] });
  };

  const handleExport = () => {
    haptic("tap");
    const payload = exportBackup(BUILD_VERSION);
    downloadBackup(payload);
    const count = Object.keys(payload.data).length;
    showToast(`Скачан бэкап: ${count} ${count === 1 ? "запись" : "записей"}`);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const payload: BackupPayload = await readBackupFile(file);
      const count = Object.keys(payload.data ?? {}).length;
      const date = payload.exported_at
        ? new Date(payload.exported_at).toLocaleString("ru-RU")
        : "";
      const ok = await confirm({
        title: "Восстановить из бэкапа?",
        message: `Будут перезаписаны данные (${count} ключей). Бэкап от ${date}. Откатить потом будет нельзя.`,
        confirmLabel: "Восстановить",
      });
      if (!ok) return;
      const { restored } = importBackup(payload);
      showToast(`Восстановлено ${restored} ключей. Перезагрузите страницу.`);
      // Hard reload so all contexts pick up the restored state.
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Не удалось прочитать файл");
    }
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: "Удалить все данные?",
      message:
        "Все записи, клиенты, услуги, бригады, настройки и переписки исчезнут с этого устройства. Перед этим сделайте бэкап.",
      confirmLabel: "Удалить всё",
    });
    if (!ok) return;
    const removed = clearBackup();
    showToast(`Удалено ${removed} ключей. Перезагружаем…`);
    window.setTimeout(() => window.location.reload(), 1200);
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
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-[var(--label-on-accent)] shrink-0 ${s.tone}`}
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

          {/* Sprint 033 — backup / restore. Cross-device sync will come
              with Supabase, but meanwhile the user needs a way to carry
              data between devices and roll back if anything breaks. */}
          <Group
            title="Резервная копия"
            footer="Скачайте файл перед крупными изменениями. Для переноса между устройствами: скачайте на одном, откройте файл на втором и нажмите «Восстановить»."
          >
            <div className="divide-y divide-[var(--separator)]">
              <button
                type="button"
                onClick={handleExport}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] active:bg-[var(--fill-quaternary)] transition"
              >
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--system-green)] text-[var(--label-on-accent)] shrink-0">
                  <Download size={18} strokeWidth={2} />
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[15px] font-medium text-[var(--label)]">
                    Скачать копию
                  </span>
                  <span className="block text-[12px] text-[var(--label-secondary)] mt-0.5">
                    JSON-файл со всеми данными
                  </span>
                </span>
                <ChevronRight size={16} className="text-[var(--label-quaternary)] shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleImportClick}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] active:bg-[var(--fill-quaternary)] transition"
              >
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--system-blue)] text-[var(--label-on-accent)] shrink-0">
                  <Upload size={18} strokeWidth={2} />
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[15px] font-medium text-[var(--label)]">
                    Восстановить из файла
                  </span>
                  <span className="block text-[12px] text-[var(--label-secondary)] mt-0.5">
                    Выберите ранее скачанный JSON-бэкап
                  </span>
                </span>
                <ChevronRight size={16} className="text-[var(--label-quaternary)] shrink-0" />
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] active:bg-[rgba(255,59,48,0.08)] transition"
              >
                <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--system-red)] text-[var(--label-on-accent)] shrink-0">
                  <Trash2 size={18} strokeWidth={2} />
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[15px] font-medium text-[var(--system-red)]">
                    Очистить все данные
                  </span>
                  <span className="block text-[12px] text-[var(--label-secondary)] mt-0.5">
                    Сначала обязательно скачайте копию
                  </span>
                </span>
              </button>
            </div>
          </Group>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          className="hidden"
        />

        {toast && (
          <div
            role="status"
            className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-50 px-4 py-2.5 rounded-full bg-[rgba(0,0,0,0.85)] text-[var(--label-on-accent)] text-[14px] font-medium shadow-[var(--shadow-float)] animate-fade-in-up"
          >
            {toast}
          </div>
        )}
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
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl overflow-hidden shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
        {children}
      </div>
      {footer && (
        <div className="px-4 pt-2 text-[12px] text-[var(--label-tertiary)] leading-snug">
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
          className={`absolute top-[2px] left-[2px] w-6 h-6 bg-[var(--surface-card)] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
