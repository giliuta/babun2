"use client";

// STORY-034 — Redesigned client card page (replaces ClientProfileView).
// Group 1 lays down the skeleton: sticky header + quick actions +
// placeholder for blocks.  Groups 2-3 fill in the collapsible cards
// (Objects / Visits / Finance / Notes / Contacts / Personal / Meta).
//
// Routing context: this is mounted by app/dashboard/clients/[id]/
// page.tsx.  The legacy ClientProfileView stays in the repo as a
// fallback (and remains used by /chats side-panel, see STORY-035).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  MessageSquare,
  MessageCircle,
  Share2,
  Ban,
  CheckCircle2,
  Trash2,
} from "@babun/shared/icons";
import {
  useAppointments,
  useClients,
  useServices,
} from "@/components/layout/DashboardClientLayout";
import { buildStats } from "@babun/shared/local/selectors/client-stats";
import { loadBlockConfig } from "@babun/shared/local/business-blocks";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import SendMessagePopup from "@/components/appointment/SendMessagePopup";
import ClientHeader from "./ClientHeader";
import ClientQuickActions from "./ClientQuickActions";
import ObjectsBlock from "./blocks/ObjectsBlock";
import VisitsBlock from "./blocks/VisitsBlock";
import FinanceBlock from "./blocks/FinanceBlock";
import NotesBlock from "./blocks/NotesBlock";
import ContactsBlock from "./blocks/ContactsBlock";
import PersonalBlock from "./blocks/PersonalBlock";
import MetaBlock from "./blocks/MetaBlock";
import { haptic } from "@/lib/haptics";

interface ClientCardPageProps {
  clientId: string;
  onBack: () => void;
}

export default function ClientCardPage({
  clientId,
  onBack,
}: ClientCardPageProps) {
  const router = useRouter();
  const { clients, clientsLoading, upsertClient, deleteClient } = useClients();
  const { appointments } = useAppointments();
  const { services } = useServices();
  const confirm = useConfirm();
  const blockConfig = loadBlockConfig();

  const client = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId],
  );

  const stats = useMemo(
    () => (client ? buildStats(client, appointments) : undefined),
    [client, appointments],
  );

  const [activeLocationId, setActiveLocationId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sendMsgOpen, setSendMsgOpen] = useState(false);
  // v335 — When the «+ Заметка» quick-action fires we just bump a
  // counter; NotesBlock (Group 3) will read it and refocus its input.
  // Counter rather than boolean so two consecutive taps both register.
  const [noteFocusToken, setNoteFocusToken] = useState(0);

  // Default to the primary location once we have the client.
  useEffect(() => {
    if (!client) return;
    if (activeLocationId) return;
    const primary =
      client.locations?.find((l) => l.isPrimary) ??
      client.locations?.[0] ??
      null;
    // Defaulting from external client state — legitimate sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (primary) setActiveLocationId(primary.id);
  }, [client, activeLocationId]);

  if (!client) {
    // P0 #1 (CRM Core brief): while the clients list is still being
    // fetched from Supabase, `client` is undefined and the old branch
    // misleadingly shouted «Клиент не найден» for a beat. Show a
    // skeleton during hydration; reserve the not-found copy for the
    // real case (URL hits a deleted / wrong id after load).
    if (clientsLoading) return <ClientCardSkeleton />;
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[var(--surface-grouped)] p-6">
        <div className="text-[14px] text-[var(--label-secondary)] mb-3">
          Клиент не найден
        </div>
        <Link
          href="/dashboard/clients"
          className="h-10 px-4 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold flex items-center active:bg-[var(--accent-pressed)]"
        >
          ← К списку клиентов
        </Link>
      </div>
    );
  }

  const update = (patch: Partial<typeof client>) =>
    upsertClient({ ...client, ...patch });

  const onAddNote = () => {
    haptic("tap");
    setNoteFocusToken((t) => t + 1);
    // Group 3 — focus the input inside NotesBlock via a hash + dom
    // lookup.  For now ensure the URL has #notes so a fresh deep-link
    // also lands on the right block when blocks ship.
    if (typeof window !== "undefined" && !window.location.hash) {
      window.history.replaceState({}, "", `${window.location.pathname}#notes`);
    }
  };

  const onDeleteClient = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: `Удалить ${client.full_name}?`,
      message:
        "Карточка клиента будет удалена. Связанные записи останутся, но привязка слетит.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    // STORY-036: await the Supabase delete before unmounting via
    // onBack(); otherwise the in-flight fetch is cancelled when the
    // page navigates away and the row stays in the database.
    await deleteClient(client.id);
    onBack();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface-grouped)] h-full">
      <ClientHeader
        client={client}
        stats={stats}
        activeLocationId={activeLocationId}
        onChangeLocation={setActiveLocationId}
        onOpenMenu={() => setMenuOpen(true)}
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto pb-24">
          <ClientQuickActions client={client} onAddNote={onAddNote} />

          {/* v336 — Group 2 blocks.  Group 3 (v337) ships the rest
              (Notes / Contacts / Personal / Meta). */}
          <div className="mt-2">
            {blockConfig.map((cfg) => {
              switch (cfg.kind) {
                case "objects":
                  return (
                    <ObjectsBlock
                      key={cfg.kind}
                      client={client}
                      onUpdate={(next) => upsertClient(next)}
                    />
                  );
                case "visits":
                  return (
                    <VisitsBlock
                      key={cfg.kind}
                      clientId={client.id}
                      appointments={appointments}
                      services={services}
                    />
                  );
                case "finance":
                  return (
                    <FinanceBlock
                      key={cfg.kind}
                      clientId={client.id}
                      stats={stats}
                      appointments={appointments}
                    />
                  );
                case "notes":
                  return (
                    <NotesBlock
                      key={cfg.kind}
                      client={client}
                      onUpdate={(next) => upsertClient(next)}
                      focusToken={noteFocusToken}
                    />
                  );
                case "contacts":
                  return (
                    <ContactsBlock
                      key={cfg.kind}
                      client={client}
                      onUpdate={(next) => upsertClient(next)}
                    />
                  );
                case "personal":
                  return (
                    <PersonalBlock
                      key={cfg.kind}
                      client={client}
                      onUpdate={(next) => upsertClient(next)}
                    />
                  );
                case "meta":
                  return (
                    <MetaBlock
                      key={cfg.kind}
                      client={client}
                      onUpdate={(next) => upsertClient(next)}
                    />
                  );
                default:
                  return null;
              }
            })}
          </div>
        </div>
      </div>

      {/* «…» menu — a centered popup per feedback_center_modals. */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-5"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="w-full max-w-[320px] bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] overflow-hidden animate-popup-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[var(--separator)] text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] truncate">
              {client.full_name}
            </div>
            <MenuRow
              icon={MessageSquare}
              label="Отправить сообщение"
              onClick={() => {
                setMenuOpen(false);
                setSendMsgOpen(true);
              }}
            />
            <MenuRow
              icon={MessageCircle}
              label="Перейти в чат"
              onClick={() => {
                setMenuOpen(false);
                router.push(`/dashboard/chats?client_id=${client.id}`);
              }}
            />
            <MenuRow
              icon={Share2}
              label="Поделиться контактом"
              onClick={async () => {
                setMenuOpen(false);
                const text = [client.full_name, client.phone]
                  .filter(Boolean)
                  .join(" · ");
                if (typeof navigator !== "undefined" && navigator.share) {
                  try {
                    await navigator.share({ title: client.full_name, text });
                  } catch {
                    // user dismissed
                  }
                } else if (
                  typeof navigator !== "undefined" &&
                  navigator.clipboard
                ) {
                  await navigator.clipboard.writeText(text);
                }
              }}
            />
            <MenuRow
              icon={client.blacklisted ? CheckCircle2 : Ban}
              label={client.blacklisted ? "Убрать из ЧС" : "В чёрный список"}
              onClick={() => {
                update({ blacklisted: !client.blacklisted });
                setMenuOpen(false);
              }}
              danger={!client.blacklisted}
            />
            {/* TODO(roles): hide for crew role */}
            <MenuRow
              icon={Trash2}
              label="Удалить клиента"
              onClick={onDeleteClient}
              danger
            />
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="w-full h-11 text-[13px] font-medium text-[var(--label-secondary)] border-t border-[var(--separator)] active:bg-[var(--fill-quaternary)]"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <SendMessagePopup
        open={sendMsgOpen}
        onClose={() => setSendMsgOpen(false)}
        phone={client.phone ?? null}
        clientName={client.full_name}
      />
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-[var(--fill-quaternary)] border-b border-[var(--separator)] last:border-0"
    >
      <span
        className={`w-6 flex items-center justify-center ${
          danger ? "text-[var(--system-red)]" : "text-[var(--label-secondary)]"
        }`}
      >
        <Icon size={18} strokeWidth={2} />
      </span>
      <span
        className={`text-[15px] font-medium flex-1 ${
          danger ? "text-[var(--system-red)]" : "text-[var(--label)]"
        }`}
      >
        {label}
      </span>
      <span className="text-[var(--label-tertiary)]">
        <ChevronLeft size={14} strokeWidth={2.5} className="rotate-180" />
      </span>
    </button>
  );
}

// P0 #1 (CRM Core brief) — first-paint skeleton for the client card.
// Mirrors the real layout coarsely: sticky header bar + avatar + name
// + phone placeholders, two primary action chips, then two stub
// content blocks. Renders only while `clientsLoading && !client`
// (initial hydration). Once `clientsLoading` flips false, the real
// not-found branch takes over.
function ClientCardSkeleton() {
  const bar = "bg-[var(--fill-secondary)] rounded animate-pulse";
  return (
    <div className="flex-1 flex flex-col bg-[var(--surface-grouped)]">
      <div className="sticky top-0 z-10 bg-[var(--surface-card)] border-b border-[var(--separator)] px-4 py-3 flex items-center gap-3">
        <div className={`w-7 h-7 rounded-full ${bar}`} />
        <div className={`flex-1 h-4 ${bar}`} />
        <div className={`w-7 h-7 rounded-full ${bar}`} />
      </div>

      <div className="px-4 pt-4 flex items-center gap-3">
        <div className={`w-14 h-14 rounded-full ${bar}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-4 w-2/3 ${bar}`} />
          <div className={`h-3 w-1/2 ${bar}`} />
        </div>
      </div>

      <div className="px-4 pt-4 flex items-center gap-2">
        <div className={`flex-1 h-11 rounded-[10px] ${bar}`} />
        <div className={`flex-1 h-11 rounded-[10px] ${bar}`} />
        <div className={`w-11 h-11 rounded-full ${bar}`} />
      </div>

      <div className="px-4 pt-5 space-y-3">
        <div className={`h-24 rounded-2xl ${bar}`} />
        <div className={`h-32 rounded-2xl ${bar}`} />
      </div>
    </div>
  );
}
