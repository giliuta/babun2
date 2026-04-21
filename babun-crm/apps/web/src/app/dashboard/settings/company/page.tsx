"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { loadCompany, saveCompany, type CompanyInfo, type VatMode } from "@/lib/finance/company";

// Company / VAT settings. Printed verbatim on every invoice PDF, so
// typos here become typos on every client receipt — keep the form
// minimal and explicit. No validation yet; Cyprus VAT numbers aren't
// regex-safe.

const VAT_MODE_LABEL: Record<VatMode, string> = {
  inclusive: "Цены уже с VAT",
  exclusive: "VAT добавляется сверху",
  off: "Без VAT",
};

export default function CompanySettingsPage() {
  const [info, setInfo] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    setInfo(loadCompany());
  }, []);

  if (!info) return null;

  const update = <K extends keyof CompanyInfo>(key: K, value: CompanyInfo[K]) => {
    const next = { ...info, [key]: value };
    setInfo(next);
    saveCompany(next);
  };

  return (
    <>
      <PageHeader title="Реквизиты компании" backHref="/dashboard/settings" />
      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-xl mx-auto p-3 lg:p-4 space-y-3">

          <Section title="Название и реквизиты">
            <Field
              label="Название компании"
              value={info.name}
              onChange={(v) => update("name", v)}
              placeholder="AirFix"
            />
            <Field
              label="Правовая форма"
              value={info.legal_form}
              onChange={(v) => update("legal_form", v)}
              placeholder="LTD, IE, ФЛП…"
            />
            <Field
              label="VAT-номер"
              value={info.vat_number}
              onChange={(v) => update("vat_number", v)}
              placeholder="CY10123456X"
            />
            <Field
              label="Адрес"
              value={info.address}
              onChange={(v) => update("address", v)}
              placeholder="Limassol, Cyprus"
            />
          </Section>

          <Section title="Контакты">
            <Field
              label="Телефон"
              value={info.phone}
              onChange={(v) => update("phone", v)}
              placeholder="+357 …"
            />
            <Field
              label="Email"
              value={info.email}
              onChange={(v) => update("email", v)}
              placeholder="info@…"
              type="email"
            />
            <Field
              label="Сайт"
              value={info.website}
              onChange={(v) => update("website", v)}
              placeholder="airfix.cy"
            />
          </Section>

          <Section title="VAT режим">
            <div className="space-y-2">
              {(Object.keys(VAT_MODE_LABEL) as VatMode[]).map((mode) => (
                <label
                  key={mode}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer ${
                    info.vat_mode === mode
                      ? "bg-violet-50 border-violet-300"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="vat-mode"
                    checked={info.vat_mode === mode}
                    onChange={() => update("vat_mode", mode)}
                    className="accent-violet-600"
                  />
                  <span className="text-sm text-slate-800">
                    {VAT_MODE_LABEL[mode]}
                  </span>
                </label>
              ))}
            </div>

            {info.vat_mode !== "off" && (
              <div className="mt-3">
                <Field
                  label="Ставка VAT, %"
                  value={String(info.vat_rate_percent)}
                  onChange={(v) => update("vat_rate_percent", Number(v) || 0)}
                  placeholder="19"
                  type="number"
                />
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200/70 shadow-sm p-4">
      <div className="text-xs font-semibold text-slate-400 uppercase mb-3">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-lg border border-slate-200 text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-violet-400"
      />
    </label>
  );
}
