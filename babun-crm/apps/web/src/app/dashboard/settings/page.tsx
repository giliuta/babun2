"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Globe,
  Users as UsersIcon,
  MessageSquare,
  Building2,
  ChevronRight,
  LogOut,
  IdCard,
  Receipt,
  Shield,
  CreditCard,
} from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import {
  useTenantName,
  useUserEmail,
} from "@/components/layout/DashboardClientLayout";
import { DISPLAY_VERSION } from "@babun/shared/common/utils/version";
import { TutorialOverlay } from "@/components/onboarding/TutorialOverlay";
import { useTutorialState } from "@/components/onboarding/useTutorialState";
import { signOut } from "@/lib/supabase/auth-client";
import { useRouter } from "next/navigation";
import {
  haptic,
  getHapticsEnabled,
  setHapticsEnabled,
  getHapticsAudio,
  setHapticsAudio,
} from "@/lib/haptics";

// v316 — iOS 26 redesign:
//   * Large title under glass nav
//   * Hero account card with gradient avatar
//   * Sections split by theme (Каталог / Команда / Оформление / Запись)
//   * Gradient tiles via .tile-grad utility

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
    // Personal account hub. Was a separate /dashboard/settings/account
    // page with the same four rows and a profile card on top — collapsed
    // into the root settings page so the user has one fewer hop. The
    // hero card above the groups now shows the same identity info
    // without a redundant "Профиль" CTA.
    title: "Личный кабинет",
    items: [
      {
        href: "/dashboard/settings/account/personal",
        icon: IdCard,
        tone: "bg-[var(--tile-blue)]",
        title: "Личная информация",
        desc: "Бизнес, регион, бренд, контакты",
      },
      {
        href: "/dashboard/settings/account/billing-info",
        icon: Receipt,
        tone: "bg-[var(--tile-green)]",
        title: "Счёт компании",
        desc: "Реквизиты для инвойсов",
      },
      {
        href: "/dashboard/settings/account/security",
        icon: Shield,
        tone: "bg-[var(--tile-orange)]",
        title: "Вход и безопасность",
        desc: "Пароль, 2FA, устройства",
      },
      {
        href: "/dashboard/settings/billing",
        icon: CreditCard,
        tone: "bg-[var(--tile-purple)]",
        title: "Тариф и оплата",
        desc: "Подписка, история платежей",
      },
    ],
  },
  // v431 — "Команда" (Команды, Мастера) and "Каталог" (Города,
  // Оборудование) groups dropped from settings per user request.
  // Команды/Мастера live in the sidebar (Ещё → Команды/Мастера) and
  // Города/Оборудование are configured inside the brigade/master
  // detail pages, not as standalone catalog screens.
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
      {
        href: "/dashboard/settings/sms",
        icon: MessageSquare,
        tone: "bg-[var(--tile-mint)]",
        title: "Автоматические SMS",
        desc: "Возвраты за 24 ч / 2 ч, Twilio",
      },
      {
        href: "/dashboard/settings/online-booking",
        icon: Globe,
        tone: "bg-[var(--tile-cyan)]",
        title: "Онлайн запись",
        desc: "Адрес страницы, рабочие часы, предоплата",
      },
    ],
  },
  {
    // "Личная информация" + "Тариф и оплата" used to live here and
    // duplicated the "Личный кабинет" group above. Trimmed to just
    // the multi-user / corporate-config rows.
    title: "Компания",
    items: [
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
  // STORY-059b — first-visit tutorial pointing at the billing tile.
  // Discoverable nudge for users on Free plan to find paid tiers; only
  // fires once, then babun:tutorial-settings-billing-completed is set.
  const tutorialBilling = useTutorialState("settings-billing");

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {tutorialBilling.show && (
        <TutorialOverlay
          targetId="settings-billing"
          text="Здесь подключаешь платный тариф когда команда вырастет. Free доступен навсегда — без срока и привязки карты."
          onDismiss={tutorialBilling.complete}
        />
      )}
      <PageHeader title="Настройки" backHref="/dashboard" />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-6 stagger-children">
          <h1 className="large-title">Настройки</h1>

          <AccountHero />

          {NAV_GROUPS.map((group) => (
            <Group key={group.title} title={group.title}>
              <div className="divide-y divide-[var(--separator)]">
                {group.items.map((s) => {
                  const Icon = s.icon;
                  const tutorialId =
                    s.href === "/dashboard/settings/billing"
                      ? "settings-billing"
                      : undefined;
                  return (
                    <Link
                      key={s.href}
                      href={s.href}
                      data-tutorial={tutorialId}
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
            Babun · {DISPLAY_VERSION}
          </div>
        </div>
      </div>
    </>
  );
}

function AccountHero() {
  // Tenant name + user email come from the server-resolved context
  // populated by DashboardClientLayout. No client-side fetching, no
  // flicker — the values are already in memory by the time the hero
  // renders. (Old behaviour was a useState("Babun") default that
  // visibly swapped to the real name after a Supabase round-trip.)
  const name = useTenantName();
  const email = useUserEmail();

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
        className="absolute inset-0 opacity-95"
        style={{
          background:
            "linear-gradient(135deg, var(--accent) 0%, var(--system-indigo) 60%, var(--system-purple) 100%)",
        }}
      />
      {/* Display-only — the four rows that used to live behind a
          «Профиль» button are now in the «Личный кабинет» group below,
          one tap away. */}
      <div className="relative px-4 py-4 flex items-center gap-3">
        <div className="avatar-ring shrink-0">
          <div className="w-14 h-14 flex items-center justify-center text-[20px] font-bold text-[var(--label)]">
            {initials}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[17px] font-semibold text-[var(--label-on-accent)] truncate drop-shadow-sm">
            {name}
          </div>
          <div className="text-[12px] text-[var(--label-on-accent)]/85 truncate mt-0.5">
            {email}
          </div>
        </div>
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
  // Same hydration-from-storage pattern as OfflineIndicator /
  // usePwaInstallState — legitimate "external system → React" sync.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
