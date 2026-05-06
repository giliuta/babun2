// STORY-077 — Счёт компании subpage placeholder.
//
// Different from /dashboard/settings/billing (which is the platform's
// Stripe subscription billing). THIS page is for the tenant's OWN
// company billing details — name on invoice, VAT/tax ID, IBAN, billing
// address — used when the tenant generates invoices for THEIR clients.
//
// Existing data already lives in localStorage via finance/company.ts
// (loadCompany/saveCompany). Migrating that to Supabase is its own
// story (~1 hour). v402 ships the entry point + migration plan.

import { Receipt } from "@babun/shared/icons";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";

export default function BillingInfoPage() {
  return (
    <>
      <PageHeader title="Счёт компании" backHref="/dashboard/settings/account" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5 space-y-3">
            <div className="w-12 h-12 rounded-[12px] bg-[#34C759] text-white flex items-center justify-center">
              <Receipt size={22} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[18px] font-semibold text-[var(--label)]">
                Реквизиты для инвойсов
              </h2>
              <p className="text-[14px] text-[var(--label-secondary)] mt-1 leading-snug">
                Здесь будет всё, что нужно для PDF-инвойсов клиентам:
                название компании на инвойсе, VAT-номер, IBAN, юридический
                адрес, режим VAT (включён в цену / сверху / без). После
                заполнения — подставится в каждый инвойс одним кликом.
              </p>
            </div>
            <div className="text-[12px] text-[var(--label-tertiary)] leading-snug pt-2 border-t border-[var(--separator)]">
              Сейчас часть этих данных уже редактируется в старом разделе{" "}
              <Link
                href="/dashboard/settings/company"
                className="text-[var(--accent)] underline"
              >
                Реквизиты компании
              </Link>{" "}
              (хранится в браузере). Перенесём в Supabase в следующей версии вместе с PDF-инвойсами.
            </div>
          </div>

          <div className="px-4 text-[11px] text-[var(--label-tertiary)] leading-snug">
            Если нужно срочно — открой раздел «Реквизиты компании» по ссылке выше, заполни VAT и адрес. PDF-генерация подключится позже автоматически.
          </div>
        </div>
      </div>
    </>
  );
}
