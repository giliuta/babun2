"use client";

// STORY-070 — single pending-sender row. Shows tenant + requested
// name + age, plus Approve / Reject buttons. Reject opens an inline
// reason textbox before confirming.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "@babun/shared/icons";
import { approveSender, rejectSender } from "@/app/admin/actions";
import { haptic } from "@/lib/haptics";

export default function SenderApprovalRow({
  tenantId,
  tenantName,
  ownerEmail,
  senderName,
  requestedAt,
}: {
  tenantId: string;
  tenantName: string;
  ownerEmail: string | null;
  senderName: string;
  requestedAt: string;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Age computed once on mount — pure-render rules ban Date.now()
  // in component body. The value doesn't need to update live since
  // the page is server-rendered and reload gives a fresh value.
  const [ageLabel, setAgeLabel] = useState("…");
  useEffect(() => {
    const ageHours = Math.floor(
      (Date.now() - new Date(requestedAt).getTime()) / (1000 * 60 * 60),
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAgeLabel(
      ageHours < 1
        ? "только что"
        : ageHours < 24
          ? `${ageHours} ч назад`
          : `${Math.floor(ageHours / 24)} дн назад`,
    );
  }, [requestedAt]);

  const onApprove = () => {
    setError(null);
    startTransition(async () => {
      const res = await approveSender(tenantId);
      if (!res.ok) setError(res.error);
      else haptic("medium");
    });
  };

  const onReject = () => {
    setError(null);
    startTransition(async () => {
      const res = await rejectSender(tenantId, reason);
      if (!res.ok) setError(res.error);
      else {
        haptic("warning");
        setRejectMode(false);
        setReason("");
      }
    });
  };

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[20px] font-bold text-[var(--label)] tracking-[0.04em] uppercase">
            «{senderName}»
          </div>
          <Link
            href={`/admin/tenants/${tenantId}`}
            className="text-[13px] text-[var(--accent)] active:opacity-70 mt-1 inline-block"
          >
            {tenantName} →
          </Link>
          <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 truncate">
            {ownerEmail ?? "—"}
          </div>
        </div>
        <span className="text-[11px] text-[var(--label-secondary)] tabular-nums whitespace-nowrap">
          {ageLabel}
        </span>
      </div>

      {error && (
        <p className="text-[12px] text-[var(--system-red)]">{error}</p>
      )}

      {!rejectMode ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            disabled={pending}
            className="flex-1 h-10 rounded-[10px] bg-[var(--system-green)] text-white text-[14px] font-semibold flex items-center justify-center gap-1.5 active:opacity-80 disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
          >
            <Check size={14} strokeWidth={2.5} />
            Одобрить
          </button>
          <button
            type="button"
            onClick={() => setRejectMode(true)}
            disabled={pending}
            className="flex-1 h-10 rounded-[10px] border border-[var(--separator)] text-[var(--system-red)] text-[14px] font-semibold flex items-center justify-center gap-1.5 active:bg-[var(--fill-tertiary)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
          >
            <X size={14} strokeWidth={2.5} />
            Отклонить
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Причина отказа (увидит клиент)"
            maxLength={200}
            autoFocus
            className="w-full h-10 px-3 text-[14px] bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] focus:outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRejectMode(false)}
              className="flex-1 h-9 rounded-[10px] border border-[var(--separator)] text-[13px] font-semibold text-[var(--label)] active:bg-[var(--fill-tertiary)]"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={pending || reason.trim().length === 0}
              className="flex-1 h-9 rounded-[10px] bg-[var(--system-red)] text-white text-[13px] font-semibold disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
            >
              {pending ? "..." : "Отклонить"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
