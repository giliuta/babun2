// v528 §3.11 — /dashboard/settings/integrations.
//
// Stub page for messenger channel integrations. Three placeholder
// cards (WhatsApp / Telegram / Instagram) with «Скоро» badges and
// short status copy. Owner-gated like the rest of /settings/* —
// non-owners get bounced to /dashboard.
//
// Why a stub: the chats empty-state CTA now points here, so the user
// has somewhere to land instead of a 404. Wiring real OAuth /
// Business API flows lives in §4.5 (multi-week scope). Until then
// the page documents intent + sets expectations.

import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import PageHeader from "@/components/layout/PageHeader";
import { MessageSquare } from "@babun/shared/icons";

interface IntegrationCard {
  id: string;
  name: string;
  description: string;
  /** Lucide icon name to keep stub footprint small; rendered as
   *  inline SVG below to avoid the dependency chain we'd need for
   *  per-channel brand icons. Real icons land with §4.5. */
  badge: "soon" | "beta";
}

const CARDS: IntegrationCard[] = [
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description:
      "Принимайте заявки и отвечайте клиентам в WhatsApp прямо из Babun. Через Twilio или 360dialog.",
    badge: "soon",
  },
  {
    id: "telegram",
    name: "Telegram",
    description:
      "Бот для уведомлений сотрудникам и чат с клиентами. Подключение через @BotFather.",
    badge: "soon",
  },
  {
    id: "instagram",
    name: "Instagram Direct",
    description:
      "Входящие DM-сообщения и ответы в едином inbox. Через Meta Business API.",
    badge: "soon",
  },
];

export default async function IntegrationsPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <PageHeader title="Интеграции" />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-2xl mx-auto px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+80px)] space-y-3">
          <p className="px-1 text-[13px] text-[var(--label-secondary)] leading-snug">
            Подключите мессенджеры, чтобы вся переписка с клиентами
            попадала в раздел «Чаты» Babun. Сейчас интеграции в разработке —
            мы напишем, когда они будут готовы.
          </p>

          {CARDS.map((card) => (
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
                <button
                  type="button"
                  disabled
                  className="mt-3 h-9 px-3.5 rounded-full bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] text-[13px] font-semibold cursor-not-allowed"
                  title="Появится после релиза интеграции"
                >
                  Подключить
                </button>
              </div>
            </div>
          ))}

          <div className="px-1 pt-2 text-[11px] text-[var(--label-tertiary)] leading-snug">
            Хотите интеграцию которой здесь нет? Напишите на{" "}
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
