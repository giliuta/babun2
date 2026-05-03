"use client";

// STORY-059 — CSV import stub.
//
// Placeholder route so the onboarding hint banner has a real target
// to link to. The full importer (file picker + CSV parser + dedup
// preview + bulk insert + error handling) is its own story (logged
// as STORY-063 in the followup queue). Until then this page tells the
// user the feature is in progress and points back to the manual flow.

import Link from "next/link";
import { Upload } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";

export default function ClientsImportPage() {
  return (
    <>
      <PageHeader title="Импорт клиентов" backHref="/dashboard/clients" />

      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-md mx-auto px-4 py-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--accent-tint)] flex items-center justify-center text-[var(--accent)] mb-4">
            <Upload size={28} strokeWidth={2} />
          </div>
          <h2 className="text-[20px] font-semibold text-[var(--label)] tracking-tight">
            Импорт скоро появится
          </h2>
          <p className="mt-2 text-[14px] leading-snug text-[var(--label-secondary)]">
            Загрузка клиентов из CSV в работе. Пока добавляй вручную — это занимает пару минут на клиента.
          </p>
          <Link
            href="/dashboard/clients/new"
            className="mt-6 h-11 px-5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold flex items-center press-scale"
          >
            + Добавить клиента вручную
          </Link>
          <Link
            href="/dashboard/clients"
            className="mt-3 text-[14px] text-[var(--accent)] active:opacity-70 transition"
          >
            Вернуться к списку
          </Link>
        </div>
      </div>
    </>
  );
}
