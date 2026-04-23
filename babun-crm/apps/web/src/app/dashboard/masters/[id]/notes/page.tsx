"use client";

// Sprint 033 Phase I31 — Master notes subroute. Single textarea with
// instant commit on blur, matching the iOS-Settings pattern everywhere
// else in the app. No Save pill.

import { use, useEffect, useState } from "react";
import { useMasters } from "@/app/dashboard/layout";
import MasterSectionShell from "@/components/masters/MasterSectionShell";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function MasterNotesPage({ params }: RouteParams) {
  const { id } = use(params);
  const { masters, upsertMaster } = useMasters();
  const master = masters.find((m) => m.id === id);

  const [value, setValue] = useState(master?.notes ?? "");

  useEffect(() => {
    setValue(master?.notes ?? "");
  }, [master]);

  if (!master) {
    return (
      <MasterSectionShell masterId={id} title="Заметки" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Сотрудник не найден.
        </div>
      </MasterSectionShell>
    );
  }

  const commit = (next: string) => {
    const trimmed = next;
    if (trimmed === (master.notes ?? "")) return;
    upsertMaster({ ...master, notes: trimmed || undefined });
  };

  return (
    <MasterSectionShell masterId={id} title="Заметки" hideSave>
      <div>
        <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
          Заметки
        </div>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-3">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            placeholder="Любые заметки об этом сотруднике — для себя"
            rows={8}
            maxLength={2000}
            className="w-full bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none leading-snug"
          />
        </div>
        <div className="px-4 pt-2 text-[12px] text-[var(--label-tertiary)] leading-snug">
          Сохраняется автоматически после ухода из поля.
        </div>
      </div>
    </MasterSectionShell>
  );
}
