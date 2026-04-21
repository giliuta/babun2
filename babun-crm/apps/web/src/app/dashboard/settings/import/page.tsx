"use client";

import { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { getSupabase, hasSupabaseEnv } from "@/lib/supabase/client";
import { isSupabaseEnabled } from "@/lib/supabase/backend-mode";
import {
  importLocalStorageIntoTenant,
  type ImportProgress,
  type ImportResult,
} from "@/lib/supabase/import";
import { useSupabase } from "@/lib/supabase/SupabaseProvider";

// Settings → Импорт в Supabase.
//
// One-shot screen the CEO runs the first time the Supabase-backed
// build opens on their device. It drains the localStorage snapshot
// into the authenticated tenant's rows. Deliberately bare — no
// progress bar, just a log of stages; the import is a few thousand
// rows at most and finishes in seconds.

export default function ImportPage() {
  const { session, tenantId } = useSupabase();
  const [progress, setProgress] = useState<ImportProgress[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [running, setRunning] = useState(false);

  const supabaseLive = isSupabaseEnabled() && hasSupabaseEnv();
  const disabled = !supabaseLive || !session || !tenantId || running;

  const runImport = async () => {
    if (!session || !tenantId) return;
    setRunning(true);
    setProgress([]);
    setResult(null);
    const sb = getSupabase();
    const res = await importLocalStorageIntoTenant(sb, tenantId, (p) =>
      setProgress((prev) => [...prev, p])
    );
    setResult(res);
    setRunning(false);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-grouped)]">
      <PageHeader
        title="Импорт в Supabase"
        backHref="/dashboard/settings"
        showBack
      />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded-2xl bg-[var(--surface-card)] shadow-[var(--shadow-card)] p-4 space-y-2">
          <div className="text-[15px] font-semibold text-[var(--label)]">
            Что произойдёт
          </div>
          <ol className="text-[13px] text-[var(--label-secondary)] space-y-1 list-decimal pl-4">
            <li>Мы прочитаем все записи / клиентов / услуг из браузера.</li>
            <li>Создадим точные копии в Supabase под вашим tenant_id.</li>
            <li>localStorage не изменится — можно повторить при ошибке.</li>
          </ol>
        </div>

        {!supabaseLive && (
          <div className="rounded-[10px] bg-[rgba(255,149,0,0.1)] px-3 py-2 text-[12px] text-[var(--system-orange)]">
            Supabase ещё не подключён. Установите
            <code className="mx-1 px-1 rounded bg-[rgba(255,149,0,0.2)]">
              NEXT_PUBLIC_BACKEND_MODE=shadow
            </code>
            и ключи проекта в Vercel, пересоберите и вернитесь сюда.
          </div>
        )}

        {supabaseLive && !session && (
          <div className="rounded-[10px] bg-[var(--fill-tertiary)] px-3 py-2 text-[12px] text-[var(--label-secondary)]">
            Нужно войти в аккаунт прежде, чем запускать импорт.
          </div>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={runImport}
          className="w-full h-12 rounded-[10px] bg-[var(--accent)] text-white text-[15px] font-semibold active:scale-[0.99] active:bg-[var(--accent-pressed)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition"
        >
          {running ? "Импортируем…" : "Запустить импорт"}
        </button>

        {progress.length > 0 && (
          <div className="rounded-2xl bg-[var(--surface-card)] shadow-[var(--shadow-card)] p-4 text-[12px] font-mono">
            {progress.map((p, i) => (
              <div key={i} className="text-[var(--label-secondary)]">
                {p.stage} — {p.total}
              </div>
            ))}
          </div>
        )}

        {result && (
          <div
            className={`rounded-2xl p-4 text-[13px] ${
              result.ok
                ? "bg-[rgba(52,199,89,0.1)] text-[var(--system-green)]"
                : "bg-[rgba(255,59,48,0.1)] text-[var(--system-red)]"
            }`}
          >
            {result.ok ? (
              <>
                <div className="font-semibold mb-1">Готово</div>
                <pre className="text-[11px] whitespace-pre-wrap">
                  {JSON.stringify(result.imported, null, 2)}
                </pre>
              </>
            ) : (
              <>
                <div className="font-semibold mb-1">Ошибка</div>
                <div className="text-[12px]">{result.error}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
