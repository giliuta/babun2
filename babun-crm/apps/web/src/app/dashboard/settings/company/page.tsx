"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { loadCompany, saveCompany, type CompanyInfo, type VatMode } from "@babun/shared/local/finance/company";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import type { Database } from "@babun/shared/db/database.types";

type TenantUpdate = Database["public"]["Tables"]["tenants"]["Update"];

// ─── DB-backed company details (used by the new server-issued
// invoices flow). Distinct from the localStorage `CompanyInfo` below
// which still drives the legacy jsPDF generator.

interface DbCompanyDetails {
  legal_name: string;
  vat_number: string;
  address: string;
  iban: string;
  bank_name: string;
  contact_email: string;
  contact_phone: string;
  invoice_prefix: string;
}

const DB_FIELDS: Array<{ key: keyof DbCompanyDetails; label: string; placeholder?: string }> = [
  { key: "legal_name", label: "Юр. название", placeholder: "AirFix LTD" },
  { key: "vat_number", label: "VAT-номер", placeholder: "CY10123456X" },
  { key: "address", label: "Юр. адрес", placeholder: "Limassol, Cyprus" },
  { key: "iban", label: "IBAN", placeholder: "CY00..." },
  { key: "bank_name", label: "Банк", placeholder: "Bank of Cyprus" },
  { key: "contact_email", label: "Email", placeholder: "billing@airfix.cy" },
  { key: "contact_phone", label: "Телефон", placeholder: "+357 ..." },
  { key: "invoice_prefix", label: "Префикс инвойса", placeholder: "INV" },
];

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
  const tenantId = useTenantId();
  const [info, setInfo] = useState<CompanyInfo | null>(null);
  const [db, setDb] = useState<DbCompanyDetails | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSupabaseBrowser()
      .from("tenants")
      .select("legal_name, vat_number, address, iban, bank_name, contact_email, contact_phone, invoice_prefix")
      .eq("id", tenantId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setDbError(error.message);
          return;
        }
        setDb({
          legal_name: data?.legal_name ?? "",
          vat_number: data?.vat_number ?? "",
          address: data?.address ?? "",
          iban: data?.iban ?? "",
          bank_name: data?.bank_name ?? "",
          contact_email: data?.contact_email ?? "",
          contact_phone: data?.contact_phone ?? "",
          invoice_prefix: data?.invoice_prefix ?? "INV",
        });
      });
    return () => { alive = false; };
  }, [tenantId]);

  const updateDb = async <K extends keyof DbCompanyDetails>(key: K, value: DbCompanyDetails[K]) => {
    if (!db) return;
    const next = { ...db, [key]: value };
    setDb(next);
    const update = { [key]: value } as TenantUpdate;
    const { error } = await getSupabaseBrowser()
      .from("tenants")
      .update(update)
      .eq("id", tenantId);
    if (error) setDbError(error.message);
  };

  useEffect(() => {
    // Client-only hydration: loadCompany() reads localStorage which
    // is unavailable on the server. The initial null render is
    // intentional so SSR + client produce identical markup; this
    // effect replaces it with real data after mount. React-Compiler
    // flags the pattern as a cascading render, but no externally
    // observable cascade exists — render-once-then-edit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-xl mx-auto px-4 py-4 space-y-5">

          {/* DB-backed company details (used by the new server-issued
              invoice flow). Saves directly to public.tenants. */}
          {db && (
            <Section title="Реквизиты для PDF-инвойсов">
              {DB_FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  value={db[f.key]}
                  onChange={(v) => updateDb(f.key, v)}
                  placeholder={f.placeholder}
                />
              ))}
              {dbError && (
                <div className="text-[12px] text-[var(--system-red)] mt-1">
                  Ошибка: {dbError}
                </div>
              )}
            </Section>
          )}

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
              placeholder="example.com"
            />
          </Section>

          <Section title="VAT режим">
            <div className="space-y-2">
              {(Object.keys(VAT_MODE_LABEL) as VatMode[]).map((mode) => (
                <label
                  key={mode}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-[10px] cursor-pointer transition ${
                    info.vat_mode === mode
                      ? "bg-[var(--accent-tint)]"
                      : "bg-[var(--fill-tertiary)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="vat-mode"
                    checked={info.vat_mode === mode}
                    onChange={() => update("vat_mode", mode)}
                    className="accent-[var(--accent)]"
                  />
                  <span className="text-[15px] text-[var(--label)]">
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
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
        {children}
      </div>
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
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
        {label}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
      />
    </label>
  );
}
