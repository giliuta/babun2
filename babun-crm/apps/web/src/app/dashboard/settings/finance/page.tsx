"use client";

// Настройки → Финансы. Landing for finance configuration. Reached from
// the gear in the /finances header. Minimal for now — templates is the
// one live section; categories / accounts / VAT / payroll land later.

import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";

export default function FinanceSettingsPage() {
  return (
    <>
      <PageHeader title="Настройки финансов" backHref="/dashboard/finances" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)] p-4">
        <div className="bg-[var(--surface-card)] rounded-[12px] overflow-hidden">
          <Link
            href="/dashboard/settings/finance/templates"
            className="flex items-center justify-between px-4 h-[52px] text-[15px] text-[var(--label)] active:bg-[var(--fill-quaternary)] transition-colors"
          >
            <span>Шаблоны операций</span>
            <span className="text-[var(--label-tertiary)] text-[18px]">›</span>
          </Link>
        </div>

        <p className="text-[12px] text-[var(--label-tertiary)] mt-3 px-1 leading-relaxed">
          Скоро здесь появятся: категории доходов и расходов, счета, ставка
          НДС (VAT), правила зарплат.
        </p>
      </div>
    </>
  );
}
