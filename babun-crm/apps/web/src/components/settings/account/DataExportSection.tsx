"use client";

// STORY-071 GDPR — Right to data portability.
//
// Owner-only "download a JSON of everything" button. Calls the
// tenant_data_export RPC server-side, packages the response into a
// download attachment, names it with the tenant name + ISO date.

import { useState } from "react";
import { Download } from "@babun/shared/icons";
import { exportTenantData } from "@/app/dashboard/settings/account/data-export-action";

export default function DataExportSection() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await exportTenantData();
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `babun-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось экспортировать");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        Экспорт данных
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
        <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
          Скачайте JSON-файл со всеми данными вашего аккаунта: клиенты, записи,
          расписание, история SMS, пополнения. Это право на портативность по GDPR.
        </p>
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="w-full h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-semibold active:bg-[var(--fill-secondary)] disabled:text-[var(--label-tertiary)] disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          <Download size={16} />
          {busy ? "Готовим JSON…" : "Скачать данные (JSON)"}
        </button>
        {error && (
          <div className="text-[13px] text-[var(--system-red)] leading-snug">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
