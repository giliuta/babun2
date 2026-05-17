// Brief 3 #13 — /dashboard/settings/integrations.
//
// Three messenger-channel cards:
//   · Telegram — MVP working (TelegramIntegrationCard, client). User
//     creates a bot via @BotFather, pastes the token, we save it
//     locally in tenant-integrations. Real server-side dispatch +
//     webhook receive lives in STORY-094-channels follow-up.
//   · WhatsApp Business — still «Скоро», but the disabled «Подключить»
//     became a mailto «Уведомить меня» so the user can subscribe to
//     launch news instead of staring at a dead button.
//   · Instagram Direct — same «Уведомить меня» pattern.
//
// Per user decision 2026-05-17 (response to «Подключить канал»).

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/layout/PageHeader";
import { MessageSquare } from "@babun/shared/icons";
import TelegramIntegrationCard from "@/components/settings/integrations/TelegramIntegrationCard";
// Beta #50 (CRM Core brief) — webhooks CRUD card.
import WebhooksCard from "@/components/settings/integrations/WebhooksCard";

interface SoonCard {
  id: string;
  name: string;
  description: string;
  /** ISO query string for the mailto subject so URL-encoding stays
   *  consistent across the two cards. */
  notifySubject: string;
}

const SOON: SoonCard[] = [
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description:
      "Принимайте заявки в WhatsApp прямо из Babun. Подключение через Cloud API (Meta) или 360dialog.",
    notifySubject: "Babun: WhatsApp интеграция — уведомить о запуске",
  },
  {
    id: "instagram",
    name: "Instagram Direct",
    description:
      "Входящие DM попадут в общий inbox. Подключение через Meta Business Suite (Instagram Business Account).",
    notifySubject: "Babun: Instagram интеграция — уведомить о запуске",
  },
];

export default async function IntegrationsPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tenantId =
    (user.app_metadata as { tenant_id?: string } | undefined)?.tenant_id ?? "";

  return (
    <>
      <PageHeader title="Интеграции" />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-2xl mx-auto px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+80px)] space-y-3">
          <p className="px-1 text-[13px] text-[var(--label-secondary)] leading-snug">
            Подключите мессенджеры, чтобы переписка с клиентами попадала
            в раздел «Чаты». Сейчас доступен Telegram; WhatsApp и
            Instagram — на подходе.
          </p>

          <TelegramIntegrationCard tenantId={tenantId} />

          <WebhooksCard tenantId={tenantId} />

          {SOON.map((card) => (
            <div
              key={card.id}
              className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-4 flex items-start gap-3"
            >
              <span className="flex-shrink-0 w-11 h-11 rounded-[12px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
                <MessageSquare size={20} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[15px] font-semibold text-[var(--label)] truncate">
                    {card.name}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-bold px-2 h-5 inline-flex items-center rounded-full bg-[var(--fill-tertiary)] text-[var(--label-secondary)] shrink-0">
                    Скоро
                  </span>
                </div>
                <div className="text-[13px] text-[var(--label-secondary)] leading-snug">
                  {card.description}
                </div>
                <a
                  href={`mailto:support@babun.app?subject=${encodeURIComponent(card.notifySubject)}`}
                  className="mt-3 inline-flex items-center h-9 px-3.5 rounded-full bg-[var(--fill-tertiary)] text-[var(--label)] text-[13px] font-semibold active:bg-[var(--fill-secondary)] transition"
                >
                  Уведомить меня
                </a>
              </div>
            </div>
          ))}

          <div className="px-1 pt-2 text-[11px] text-[var(--label-tertiary)] leading-snug">
            Нужна интеграция, которой здесь нет? Напишите на{" "}
            <a
              href="mailto:support@babun.app?subject=Babun%3A%20интеграция"
              className="text-[var(--accent)] underline"
            >
              support@babun.app
            </a>
            .
          </div>
        </div>
      </div>
    </>
  );
}
