"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  MapPin,
  Package,
  Users as UsersIcon,
  UserCircle2,
  UserCog,
  MessageSquare,
  Building2,
  ChevronRight,
  LogOut,
} from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import { useFormSettings } from "@/components/layout/DashboardClientLayout";
import { signOut } from "@/lib/supabase/auth-client";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  haptic,
  getHapticsEnabled,
  setHapticsEnabled,
  getHapticsAudio,
  setHapticsAudio,
} from "@/lib/haptics";
import type {
  FormFieldVisibility,
  RequiredFields,
} from "@babun/shared/local/appointments";

// v316 — iOS 26 redesign:
//   * Large title under glass nav
//   * Hero account card with gradient avatar
//   * Sections split by theme (Каталог / Команда / Оформление / Запись)
//   * Gradient tiles via .tile-grad utility

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

interface NavGroup {
  title: string;
  items: NavSection[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Команда",
    items: [
      {
        href: "/dashboard/teams",
        icon: UsersIcon,
        tone: "bg-[var(--tile-blue)]",
        title: "Бригады",
        desc: "Состав команд, цвета, % зарплаты",
      },
      {
        href: "/dashboard/masters",
        icon: UserCircle2,
        tone: "bg-[var(--tile-indigo)]",
        title: "Мастера",
        desc: "Сотрудники, контакты, доступы",
      },
    ],
  },
  {
    title: "Каталог",
    items: [
      {
        href: "/dashboard/settings/cities",
        icon: MapPin,
        tone: "bg-[var(--tile-red)]",
        title: "Города",
        desc: "Справочник для клиентов и записей",
      },
      {
        href: "/dashboard/inventory",
        icon: Package,
        tone: "bg-[var(--tile-mint)]",
        title: "Оборудование",
        desc: "Инструмент и приборы по бригадам",
      },
    ],
  },
  {
    title: "Записи",
    items: [
      {
        href: "/dashboard/settings/calendar",
        icon: CalendarDays,
        tone: "bg-[var(--tile-orange)]",
        title: "Календарь",
        desc: "Часы работы, шаг, часовой пояс",
      },
      {
        href: "/dashboard/sms-templates",
        icon: MessageSquare,
        tone: "bg-[var(--tile-green)]",
        title: "Шаблоны SMS",
        desc: "Тексты напоминаний и подтверждений",
      },
    ],
  },
  {
    title: "Компания",
    items: [
      {
        href: "/dashboard/settings/account",
        icon: UserCog,
        tone: "bg-[var(--tile-blue)]",
        title: "Аккаунт",
        desc: "Email, бизнес, пароль, удаление",
      },
      {
        href: "/dashboard/settings/team",
        icon: UsersIcon,
        tone: "bg-[var(--tile-orange)]",
        title: "Команда",
        desc: "Участники, роли, приглашения",
      },
      {
        href: "/dashboard/settings/company",
        icon: Building2,
        tone: "bg-[var(--tile-purple)]",
        title: "Реквизиты и VAT",
        desc: "Название, VAT-номер, ставка 19%",
      },
    ],
  },
];

export default function SettingsPage() {
  const router = useRouter();
  const { fieldVisibility, setFieldVisibility, requiredFields, setRequiredFields } =
    useFormSettings();

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

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

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-6 stagger-children">
          <h1 className="large-title">Настройки</h1>

          <AccountHero />

          {NAV_GROUPS.map((group) => (
            <Group key={group.title} title={group.title}>
              <div className="divide-y divide-[var(--separator)]">
                {group.items.map((s) => {
                  const Icon = s.icon;
                  return (
                    <Link
                      key={s.href}
                      href={s.href}
                      className="flex items-center gap-3 px-4 py-3 min-h-[58px] active:bg-[var(--fill-tertiary)] transition-colors press-scale"
                    >
                      <span
                        className={`tile tile-grad ${s.tone}`}
                        style={{ width: 30, height: 30 }}
                      >
                        <Icon size={18} strokeWidth={2.2} />
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
          ))}

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

          <HapticsSection />

          <button
            type="button"
            onClick={handleLogout}
            className="w-full section-card flex items-center justify-center gap-2 py-3.5 text-[15px] font-semibold text-[var(--system-red)] active:bg-[var(--fill-tertiary)] transition press-scale"
          >
            <LogOut size={16} strokeWidth={2.2} />
            Выйти из аккаунта
          </button>

          <div className="text-center text-[11px] text-[var(--label-quaternary)] py-2">
            Babun · v316
          </div>
        </div>
      </div>
    </>
  );
}

function AccountHero() {
  // Hydrate the tenant name + email after mount. The dashboard layout
  // already vouches for an authenticated session + tenant row, so we
  // skip the loading skeleton and just show empty values briefly.
  const [name, setName] = useState("Babun");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      setEmail(user.email ?? "");
      // STORY-039 — read active tenant from JWT app_metadata.
      const tenantId = (user.app_metadata as { tenant_id?: string } | undefined)
        ?.tenant_id;
      if (!tenantId) return;
      const { data: tenant } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantId)
        .maybeSingle();
      if (cancelled) return;
      if (tenant?.name) setName(tenant.name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Two-letter initials from the tenant name; falls back to the
  // first two characters when the name is short or has no spaces.
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "B";

  return (
    <div className="section-card relative overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 h-20 opacity-90"
        style={{
          background:
            "linear-gradient(135deg, var(--accent) 0%, var(--system-indigo) 70%, var(--system-purple) 100%)",
        }}
      />
      <div className="relative px-4 pt-5 pb-4 flex items-center gap-3">
        <div className="avatar-ring">
          <div className="w-14 h-14 flex items-center justify-center text-[20px] font-bold text-[var(--label)]">
            {initials}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-semibold text-[var(--label-on-accent)] truncate drop-shadow-sm">
            {name}
          </div>
          <div className="text-[12px] text-[var(--label-on-accent)]/85 truncate">
            {email}
          </div>
        </div>
        <Link
          href="/dashboard/settings/account"
          className="px-3 py-1.5 rounded-full bg-white/90 text-[13px] font-semibold text-[var(--accent)] active:scale-95 transition shrink-0"
        >
          Профиль
        </Link>
      </div>
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
      <div className="section-title">{title}</div>
      <div className="section-card">{children}</div>
      {footer && <div className="section-footer">{footer}</div>}
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
        onClick={() => {
          if (!disabled) haptic("select");
          onChange();
        }}
        disabled={disabled}
        aria-label={label}
        className={`relative w-[46px] h-[28px] rounded-full transition-colors flex-shrink-0 ${
          checked ? "bg-[var(--system-green)]" : "bg-[var(--fill-primary)]"
        } ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-6 h-6 bg-[var(--surface-card)] rounded-full shadow-[var(--shadow-card)] transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// v317 — User-controlled haptic feedback.  iPhone Safari gives web
// apps no access to the Taptic Engine, so on iOS we fall back to a
// short percussive audio "tk" click.  Default ON for both vibration
// and the audio click on iOS, OFF on Android (real vibration).
function HapticsSection() {
  const [enabled, setEnabledState] = useState(true);
  const [audio, setAudioState] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR mismatch).
  useEffect(() => {
    setEnabledState(getHapticsEnabled());
    setAudioState(getHapticsAudio());
  }, []);

  return (
    <Group
      title="Тактильная отдача"
      footer={
        enabled
          ? "На Android — настоящая вибрация. На iPhone Safari не даёт веб-приложениям доступ к Taptic Engine, поэтому подключён короткий звук-щелчок — звучит как клик в системных меню iOS. Если мешает — отключи второй тумблер."
          : "Все вибрации и щелчки выключены."
      }
    >
      <div className="divide-y divide-[var(--separator)]">
        <ToggleRow
          label="Вибрация / тактильный отклик"
          checked={enabled}
          onChange={() => {
            const next = !enabled;
            setHapticsEnabled(next);
            setEnabledState(next);
            if (next) haptic("medium");
          }}
        />
        <ToggleRow
          label="Звук-щелчок (только iPhone)"
          checked={audio}
          onChange={() => {
            const next = !audio;
            setHapticsAudio(next);
            setAudioState(next);
            if (next) haptic("tap");
          }}
          disabled={!enabled}
        />
      </div>
    </Group>
  );
}
