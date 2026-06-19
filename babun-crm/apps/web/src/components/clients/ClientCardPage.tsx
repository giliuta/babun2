"use client";

// Unified client card — ONE page for create + view + edit.
//
// • View  (clientId): existing client resolved from context; edits persist
//   immediately (header inline edit, blocks via onUpdate).
// • Create (createMode): the SAME card opened on an empty draft held in
//   local state. Phone is the primary field (header create mode), a live
//   dedupe strip surfaces matches, and «Готово» persists the draft and
//   lands on its now-saved [id] card. Booking / chat deep-links persist
//   the draft first (its id is stable) so they resolve.
//
// Routing: app/dashboard/clients/[id]/page.tsx → view;
//          app/dashboard/clients/new/page.tsx  → create.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useAppointments,
  useClients,
  useServices,
} from "@/components/layout/DashboardClientLayout";
import { createBlankClient, type Client } from "@babun/shared/local/clients";
import { buildStats } from "@babun/shared/local/selectors/client-stats";
import { buildServiceDue } from "@babun/shared/local/selectors/service-due";
import { tryToE164 } from "@/lib/phone/normalize";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { useToast } from "@/components/ui/Toast";
import SendMessagePopup from "@/components/appointment/SendMessagePopup";
import ClientHeader from "./ClientHeader";
import ClientCardMenu from "./ClientCardMenu";
import ClientCardSkeleton from "./ClientCardSkeleton";
import ClientDedupeStrip from "./ClientDedupeStrip";
import ClientCardBlocks from "./ClientCardBlocks";
import ClientNextJob from "./ClientNextJob";
import ClientQuickActions from "./ClientQuickActions";
import ClientServiceSpine from "./ClientServiceSpine";
import { haptic } from "@/lib/haptics";

interface ClientCardPageProps {
  /** View mode — existing client id. */
  clientId?: string;
  /** Create mode — mount on an empty editable draft instead. */
  createMode?: boolean;
  onBack: () => void;
}

/** Digits-only view of a phone string. */
function phoneDigits(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * Confident, offline (localStorage-phase) duplicate match by phone digits.
 * Exact equality matches at any length ≥5; otherwise a ≥7-digit shared
 * suffix is required so a half-typed number can't false-positive against
 * the whole base. (CY mobiles are 8 national digits → +357… = 11.)
 */
function phoneMatches(typed: string, existing: string): boolean {
  const a = phoneDigits(typed);
  const b = phoneDigits(existing);
  if (a.length < 5 || b.length < 5) return false;
  if (a === b) return true;
  const n = Math.min(a.length, b.length, 9);
  if (n < 7) return false;
  return a.slice(-n) === b.slice(-n);
}

export default function ClientCardPage({
  clientId,
  createMode = false,
  onBack,
}: ClientCardPageProps) {
  const router = useRouter();
  const { clients, clientsLoading, upsertClient, deleteClient } = useClients();
  const { appointments } = useAppointments();
  const { services } = useServices();
  const confirm = useConfirm();
  const toast = useToast();

  // Create mode holds the in-progress client here until «Готово». The id
  // is stable from the start so booking deep-links resolve after persist.
  const [draft, setDraft] = useState<Client>(() => createBlankClient());

  const foundClient = useMemo(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId],
  );
  const client = createMode ? draft : foundClient;

  const stats = useMemo(
    () => (client ? buildStats(client, appointments) : undefined),
    [client, appointments],
  );

  // Wires the previously-dead serviceDueState into the «Обслуживание»
  // spine + NEXT-JOB hero. Computed once here; passed down (single source).
  const serviceDue = useMemo(
    () => (client ? buildServiceDue(client) : null),
    [client],
  );

  // The unit the NEXT-JOB hero already names — the spine drops it so the
  // same overdue/soon unit is never shown twice (de-dup, one home per fact).
  const heroUnitId = useMemo(() => {
    if (!serviceDue || stats?.nextApt) return null;
    return serviceDue.overdue[0]?.unitId ?? serviceDue.soon[0]?.unitId ?? null;
  }, [serviceDue, stats]);

  // Live dedupe (create only) — surfaced as the user types the phone.
  // Opening a match IS the link; no separate «Привязать» step.
  const dedupeMatches = useMemo(() => {
    if (!createMode || phoneDigits(draft.phone).length < 5) return [];
    return clients
      .filter((c) => !c.deleted_at && phoneMatches(draft.phone, c.phone))
      .slice(0, 3);
  }, [createMode, clients, draft.phone]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [sendMsgOpen, setSendMsgOpen] = useState(false);
  // «Напомнить» quick-action triggers this native date input.
  const reminderInputRef = useRef<HTMLInputElement>(null);

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

  // Persist a full client snapshot. View → straight to the store; create →
  // into the local draft (not the store) until «Готово».
  const commitClient = (next: Client) => {
    if (createMode) setDraft(next);
    else void upsertClient(next);
  };
  const update = (patch: Partial<Client>) => commitClient({ ...client, ...patch });

  // Create: write the draft to the store (normalized). Returns false if the
  // phone gate isn't met yet (so booking/chat nav aborts with a hint).
  const draftPhoneValid = phoneDigits(draft.phone).length >= 5;
  const persistDraft = async (): Promise<boolean> => {
    if (!draftPhoneValid) {
      toast.show({ variant: "info", message: "Сначала введите телефон" });
      return false;
    }
    const name = draft.full_name.trim();
    const phone = draft.phone.trim();
    const toSave: Client = {
      ...draft,
      full_name: name,
      phone,
      phone_e164: tryToE164(phone, "CY"),
      sms_name: name.split(/\s+/)[0] || "",
    };
    await upsertClient(toSave);
    setDraft(toSave);
    return true;
  };

  const handleDone = async () => {
    haptic("medium");
    if (!(await persistDraft())) return;
    // Land on the same card, now persisted — objects / notes / city are
    // added from here over time.
    router.replace(`/dashboard/clients/${draft.id}`);
  };

  const handleBack = async () => {
    if (createMode && (draft.full_name.trim() || draft.phone.trim())) {
      const ok = await confirm({
        title: "Отменить создание?",
        message: "Введённые данные не сохранятся.",
        confirmLabel: "Отменить",
        cancelLabel: "Продолжить",
        danger: true,
      });
      if (!ok) return;
    }
    onBack();
  };

  // «Напомнить» — open a native date picker; on pick, store reminder_at.
  const onRemind = () => {
    haptic("tap");
    const el = reminderInputRef.current as
      | (HTMLInputElement & { showPicker?: () => void })
      | null;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.click();
  };

  const onReminderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value; // YYYY-MM-DD
    if (!value) return;
    update({ reminder_at: value });
    toast.show({ variant: "success", message: "Напоминание поставлено" });
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

  const beforeNavigate = createMode ? persistDraft : undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface-grouped)] h-full">
      <ClientHeader
        client={client}
        stats={stats}
        mode={createMode ? "create" : "view"}
        onOpenMenu={createMode ? undefined : () => setMenuOpen(true)}
        onDone={createMode ? handleDone : undefined}
        doneEnabled={createMode ? draftPhoneValid : undefined}
        onBack={handleBack}
        onPatch={update}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto pb-24">
          {/* Live dedupe (create only) — opening a match IS the link. */}
          <ClientDedupeStrip
            matches={dedupeMatches}
            onOpen={(id) => router.replace(`/dashboard/clients/${id}`)}
          />

          {/* NEXT-JOB hero — what to do now (booked / overdue ТО / +Записать) */}
          {serviceDue && (
            <div className="mx-3 mt-3 mb-2">
              <ClientNextJob
                client={client}
                stats={stats}
                serviceDue={serviceDue}
                beforeNavigate={beforeNavigate}
              />
            </div>
          )}

          {/* 5 always-visible quick actions */}
          <ClientQuickActions
            client={client}
            stats={stats}
            onRemind={onRemind}
            beforeNavigate={beforeNavigate}
          />

          {/* «Обслуживание» spine — equipment due for service (hides if none).
              Drops the unit the hero already names (de-dup). */}
          {serviceDue && (
            <ClientServiceSpine
              client={client}
              stats={stats}
              serviceDue={serviceDue}
              excludeUnitId={heroUnitId}
            />
          )}

          {/* ОБЪЕКТЫ first, then the collapsed reference blocks
              (visits / finance / notes / contacts / personal / meta). */}
          <ClientCardBlocks
            client={client}
            stats={stats}
            appointments={appointments}
            services={services}
            onUpdate={commitClient}
          />
        </div>
      </div>

      {/* «…» menu — view mode only. */}
      {menuOpen && (
        <ClientCardMenu
          client={client}
          onClose={() => setMenuOpen(false)}
          onSendMessage={() => {
            setMenuOpen(false);
            setSendMsgOpen(true);
          }}
          onToggleBlacklist={() => {
            update({ blacklisted: !client.blacklisted });
            setMenuOpen(false);
          }}
          onDelete={onDeleteClient}
        />
      )}

      <SendMessagePopup
        open={sendMsgOpen}
        onClose={() => setSendMsgOpen(false)}
        phone={client.phone ?? null}
        clientName={client.full_name}
      />

      {/* Hidden picker for the «Напомнить» quick-action. */}
      <input
        ref={reminderInputRef}
        type="date"
        defaultValue={client.reminder_at ?? undefined}
        onChange={onReminderPicked}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}
