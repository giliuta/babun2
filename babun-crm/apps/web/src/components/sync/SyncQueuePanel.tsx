"use client";

// STORY-054 G4 — manual inspection + retry UI for the sync queue.
//
// Lives behind a tap on the OfflineIndicator pill. Lists every
// QueuedOp ordered by created_at ASC (oldest first — same order the
// replayer drains in). For each row:
//
//   - line 1: bold human label («Клиент / создание», «Запись /
//     обновление», «Тег / удаление»)
//   - line 2: secondary text — created_at relative time + attempts
//     («2 мин назад · попытка 1/3»)
//   - last_error (if any) shown as a red one-liner under the row
//   - row actions: «Повторить» (resets attempts → next drain picks
//     it up) and «Удалить» (drops the op without sending). Discard
//     is final and unconfirmed — power-user surface; the user only
//     reaches it by deliberately tapping the indicator.
//
// "Повторить" both resets attempts AND triggers a drain pass via
// kickReplayer so the user gets immediate feedback if we're online.
// Offline: resetting attempts is still useful — when connectivity
// returns the auto-replay will pick it up fresh.
//
// Header «Повторить все» = retry-all (kickReplayer). NOT delete-all
// — there's no bulk-discard button by design; nuking the whole
// queue with one tap is the sort of "I shouldn't have done that"
// destructive action this story explicitly avoids.
//
// Per-row «Удалить» is gated through useConfirm() because discard
// is unrecoverable: the queued payload was the user's last optimistic
// edit and IDB is the only place it lives. Same blast radius as
// /clients delete → same confirm pattern.
//
// Future polish (non-blocking, deferred past G4):
//   - last_error sanitization: NetworkError → «Нет сети»,
//     PostgREST 401/403 → «Нет доступа», truncate stack frames.
//     Power-user surface in v1; raw text is OK.
//   - Relative time format: switch to absolute («14:32») once an
//     op is older than ~1 h, matching the standard iOS pattern.

import { useEffect, useState } from "react";
import { dequeueAll, type QueuedOp } from "@babun/shared/db/cache";
import {
  removeOpAndEmit,
  resetOpAttemptsAndEmit,
  subscribeQueueChange,
} from "@/lib/sync/queue-events";
import { kickReplayer } from "@/lib/sync/replayer";
import { isOnline } from "@/lib/sync/network";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import SheetShell from "@/components/ui/SheetShell";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { labelForOp, relativeTime, pluralizeOps } from "@/lib/sync/format";

interface Props {
  onClose: () => void;
}

export default function SyncQueuePanel({ onClose }: Props) {
  const [ops, setOps] = useState<QueuedOp[] | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const list = await dequeueAll();
        if (!cancelled) setOps(list);
      } catch {
        if (!cancelled) setOps([]);
      }
    };
    void refresh();
    const unsub = subscribeQueueChange(() => void refresh());
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const handleRetry = async (id: number) => {
    await resetOpAttemptsAndEmit(id);
    if (isOnline()) {
      void kickReplayer({ supabase: getSupabaseBrowser() });
    }
  };

  const handleDiscard = async (id: number) => {
    const ok = await confirm({
      title: "Удалить операцию?",
      message: "Изменения, которые ещё не отправлены, будут потеряны. Отменить нельзя.",
      confirmLabel: "Удалить",
      cancelLabel: "Отмена",
      danger: true,
    });
    if (!ok) return;
    await removeOpAndEmit(id);
  };

  const handleRetryAll = () => {
    // Retry-all only — there is no bulk-discard by design (see header
    // comment). No confirm needed: kickReplayer is non-destructive.
    if (!isOnline()) return;
    void kickReplayer({ supabase: getSupabaseBrowser() });
  };

  return (
    <SheetShell
      open
      onClose={onClose}
      title="Очередь синхронизации"
      subtitle={
        ops === null
          ? "Загрузка…"
          : ops.length === 0
            ? "Очередь пуста"
            : `${ops.length} ${pluralizeOps(ops.length)}`
      }
      headerAccessory={
        ops && ops.length > 0 && isOnline() ? (
          <button
            type="button"
            onClick={handleRetryAll}
            className="px-3 h-8 rounded-full bg-[var(--system-blue)] text-white text-[12px] font-semibold active:opacity-70 transition"
          >
            Повторить все
          </button>
        ) : undefined
      }
      maxWidth="max-w-md"
      height="80vh"
    >
      <div className="px-3 py-3 space-y-2">
        {ops && ops.length === 0 && (
          <div className="text-center text-[14px] text-[var(--label-secondary)] py-12">
            Все изменения отправлены.
          </div>
        )}
        {ops?.map((op) => (
          <OpRow
            key={op.id}
            op={op}
            onRetry={() => void handleRetry(op.id)}
            onDiscard={() => void handleDiscard(op.id)}
          />
        ))}
      </div>
    </SheetShell>
  );
}

function OpRow({
  op,
  onRetry,
  onDiscard,
}: {
  op: QueuedOp;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="bg-[var(--surface-card)] rounded-[12px] px-3 py-2.5 shadow-[var(--shadow-tile)]">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--label)] truncate">
            {labelForOp(op)}
          </div>
          <div className="text-[12px] text-[var(--label-secondary)] mt-0.5">
            {relativeTime(op.created_at)} · попытка {op.attempts}/3
          </div>
          {op.last_error && (
            <div className="text-[12px] text-[var(--system-red,#FF3B30)] mt-1 break-words">
              {op.last_error}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 h-7 rounded-full bg-[var(--fill-primary)] text-[var(--label)] text-[12px] font-semibold active:bg-[var(--fill-secondary)] transition"
          >
            Повторить
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="px-2.5 h-7 rounded-full bg-transparent text-[var(--system-red,#FF3B30)] text-[12px] font-semibold active:opacity-60 transition"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

