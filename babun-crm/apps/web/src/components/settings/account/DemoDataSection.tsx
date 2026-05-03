"use client";

// STORY-059 — Settings → Account demo-data section.
//
// "Загрузить демо-данные" button creates 5 mock clients + 3 mock
// appointments in the current tenant. "Удалить демо-данные" appears
// once seeded data exists. Both go through src/lib/demo-data/seed.ts
// which uses the `is_demo` column added in migration
// 20260503_002_demo_seed.sql.
//
// Useful for: testers seeing what a populated CRM looks like, founder
// QA sweeps, demos to prospects. Not intended for production tenants.

import { useEffect, useState } from "react";
import { Sparkles, Trash2 } from "@babun/shared/icons";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import {
  countDemoData,
  removeDemoData,
  seedDemoData,
} from "@/lib/demo-data/seed";

type Phase = "idle" | "loading" | "seeding" | "removing";

export default function DemoDataSection() {
  const tenantId = useTenantId();
  const [phase, setPhase] = useState<Phase>("loading");
  const [demoCount, setDemoCount] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const refreshCount = async () => {
    try {
      const supabase = getSupabaseBrowser();
      const n = await countDemoData(supabase, tenantId);
      setDemoCount(n);
    } catch {
      // ignore — count failure shouldn't block the section
    }
  };

  useEffect(() => {
    void (async () => {
      await refreshCount();
      setPhase("idle");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleSeed = async () => {
    if (phase !== "idle") return;
    setPhase("seeding");
    setMessage(null);
    try {
      const supabase = getSupabaseBrowser();
      const result = await seedDemoData(supabase, tenantId);
      setMessage(
        `Создано: ${result.clientCount} клиентов, ${result.appointmentCount} записей.`,
      );
      await refreshCount();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось загрузить демо";
      setMessage(`Ошибка: ${msg}`);
    } finally {
      setPhase("idle");
    }
  };

  const handleRemove = async () => {
    if (phase !== "idle") return;
    if (
      !window.confirm(
        "Удалить все демо-данные из этого аккаунта? Действие нельзя отменить.",
      )
    ) {
      return;
    }
    setPhase("removing");
    setMessage(null);
    try {
      const supabase = getSupabaseBrowser();
      const result = await removeDemoData(supabase, tenantId);
      setMessage(
        `Удалено: ${result.clientsDeleted} клиентов, ${result.appointmentsDeleted} записей.`,
      );
      await refreshCount();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось удалить демо";
      setMessage(`Ошибка: ${msg}`);
    } finally {
      setPhase("idle");
    }
  };

  const busy = phase === "seeding" || phase === "removing";
  const hasDemo = demoCount > 0;

  return (
    <section className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-[15px] font-semibold text-[var(--label)] tracking-tight">
          Демо-данные
        </h2>
        <p className="text-[13px] text-[var(--label-secondary)] mt-1 leading-snug">
          Создать 5 клиентов и 3 записи, чтобы посмотреть как выглядит заполненный кабинет. Можно удалить одной кнопкой.
        </p>
      </div>

      <div className="px-4 py-3 border-t border-[var(--separator)] flex flex-col gap-2">
        {!hasDemo && (
          <button
            type="button"
            onClick={handleSeed}
            disabled={busy}
            className="h-11 px-4 rounded-[12px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50 transition"
          >
            <Sparkles size={16} strokeWidth={2} />
            {phase === "seeding" ? "Загружаю…" : "Загрузить демо-данные"}
          </button>
        )}

        {hasDemo && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="h-11 px-4 rounded-[12px] bg-[var(--system-red-tint,rgba(255,59,48,0.12))] text-[var(--system-red)] text-[15px] font-semibold flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50 transition"
          >
            <Trash2 size={16} strokeWidth={2} />
            {phase === "removing"
              ? "Удаляю…"
              : `Удалить демо (${demoCount} клиентов)`}
          </button>
        )}

        {message && (
          <div
            className="text-[13px] text-[var(--label-secondary)] mt-1 leading-snug"
            aria-live="polite"
          >
            {message}
          </div>
        )}
      </div>
    </section>
  );
}
