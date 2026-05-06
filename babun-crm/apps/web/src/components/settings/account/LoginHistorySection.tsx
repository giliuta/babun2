"use client";

// STORY-077 — Login history placeholder.
//
// Real implementation reads auth.audit_log_entries (last N login
// events) joined with whatever GeoIP service we add later. For now
// renders a single 'Скоро' card so the security page has the right
// shape and users see the feature is on the roadmap.

import { Clock } from "@babun/shared/icons";

export default function LoginHistorySection() {
  return (
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        История входов
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] flex items-center justify-center shrink-0">
            <Clock size={18} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium text-[var(--label)]">
              Журнал входов
            </div>
            <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 leading-snug">
              Покажем последние 30 успешных входов и попытки взлома: дата, устройство, страна по IP. Скоро.
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center h-7 px-2.5 rounded-full bg-[var(--fill-tertiary)] text-[10px] uppercase tracking-wider font-bold text-[var(--label-tertiary)]">
            Скоро
          </span>
        </div>
      </div>
    </div>
  );
}
