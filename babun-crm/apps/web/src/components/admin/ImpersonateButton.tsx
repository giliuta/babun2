"use client";

// STORY-070 wave 2 — Tenant impersonation button.
// STORY-081 — replaced window.confirm with iOS-styled ConfirmDialog.

import { useState, useTransition } from "react";
import { LogIn } from "@babun/shared/icons";
import { impersonateTenantOwner } from "@/app/admin/actions";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Props {
  tenantId: string;
  tenantName: string;
}

export default function ImpersonateButton({ tenantId, tenantName }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    setShowConfirm(false);
    setError(null);
    setBusy(true);
    startTransition(async () => {
      const res = await impersonateTenantOwner(tenantId);
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={busy || isPending}
        className="w-full h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[13px] font-semibold active:bg-[var(--fill-secondary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
      >
        <LogIn size={14} />
        {busy || isPending ? "Готовим ссылку…" : "Войти как владелец"}
      </button>
      {error && (
        <div className="text-[12px] text-[var(--system-red)] leading-snug">
          {error}
        </div>
      )}

      {showConfirm && (
        <ConfirmDialog
          title={`Войти как владелец «${tenantName}»?`}
          message="Сгенерируется magic-link, откроется в новой вкладке. Используй только для поддержки клиента."
          confirmLabel="Войти"
          cancelLabel="Отмена"
          danger={false}
          onConfirm={handleConfirm}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
