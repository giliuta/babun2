"use client";

// STORY-070 wave 2 — Tenant impersonation button.
//
// Calls the impersonateTenantOwner server action which returns a
// magic-link URL. We open it in a new tab so the admin keeps their
// own /admin session intact. Confirms before firing — the magic
// link grants full owner access, so this is a load-bearing button.

import { useState, useTransition } from "react";
import { LogIn } from "@babun/shared/icons";
import { impersonateTenantOwner } from "@/app/admin/actions";

interface Props {
  tenantId: string;
  tenantName: string;
}

export default function ImpersonateButton({ tenantId, tenantName }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    if (busy || isPending) return;
    const ok = window.confirm(
      `Войти как владелец тенанта «${tenantName}»? Сгенерируется magic-link, ` +
        `откроется в новой вкладке. Используй только для поддержки.`,
    );
    if (!ok) return;
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
        onClick={onClick}
        disabled={busy || isPending}
        className="w-full h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[13px] font-semibold active:bg-[var(--fill-secondary)] disabled:opacity-50 transition flex items-center justify-center gap-2"
      >
        <LogIn size={14} />
        {busy || isPending ? "Готовим ссылку…" : "Войти как владелец"}
      </button>
      {error && (
        <div className="text-[12px] text-[var(--system-red)] leading-snug">
          {error}
        </div>
      )}
    </div>
  );
}
