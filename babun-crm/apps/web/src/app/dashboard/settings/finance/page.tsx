"use client";

// Настройки → Финансы. Hub for finance configuration. Reached from the
// gear in the /finances header. Groups the reference books (categories,
// templates) and the invoice/company details used on PDF invoices.

import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";

interface Row {
  href: string;
  title: string;
  subtitle: string;
  icon: string;
}

const SECTIONS: Array<{ heading: string; rows: Row[] }> = [
  {
    heading: "Справочники",
    rows: [
      {
        href: "/dashboard/settings/finance/categories",
        title: "Категории",
        subtitle: "Доходы и расходы по полочкам",
        icon: "🏷️",
      },
      {
        href: "/dashboard/settings/finance/templates",
        title: "Шаблоны операций",
        subtitle: "Быстрый ввод: аренда, ЗП, чаевые",
        icon: "⚡",
      },
    ],
  },
  {
    heading: "Документы",
    rows: [
      {
        href: "/dashboard/settings/company",
        title: "Реквизиты и НДС",
        subtitle: "Данные компании для инвойсов и чеков",
        icon: "🧾",
      },
    ],
  },
];

export default function FinanceSettingsPage() {
  return (
    <>
      <PageHeader title="Настройки финансов" backHref="/dashboard/finances" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.heading} className="space-y-2">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--label-tertiary)] px-1">
                {section.heading}
              </div>
              <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
                {section.rows.map((row, idx) => (
                  <Link
                    key={row.href}
                    href={row.href}
                    className={`flex items-center gap-3 px-4 py-3 active:bg-[var(--fill-quaternary)] transition-colors ${
                      idx > 0 ? "border-t border-[var(--separator)]" : ""
                    }`}
                  >
                    <span className="text-[20px] w-7 text-center flex-shrink-0">
                      {row.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] text-[var(--label)]">
                        {row.title}
                      </span>
                      <span className="block text-[12px] text-[var(--label-tertiary)] truncate">
                        {row.subtitle}
                      </span>
                    </span>
                    <span className="text-[var(--label-tertiary)] text-[18px]">›</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <p className="text-[12px] text-[var(--label-tertiary)] px-1 leading-relaxed">
            Счета создаются прямо на странице «Финансы» — раздел «Счета».
          </p>
        </div>
      </div>
    </>
  );
}
