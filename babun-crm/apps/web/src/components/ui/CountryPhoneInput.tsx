// Phone input with country flag/code selector — Sprint clients-99 (F2.7).
//
// Drops the hardcoded "+357" prefix and lets the user pick any
// supported country. Defaults to the tenant's country. When the user
// types a "+" prefix manually, the country picker auto-syncs.

"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "@babun/shared/icons";
import {
  SUPPORTED_COUNTRIES,
  countryFlag,
  COUNTRY_NAMES_RU,
  guessCountry,
  formatDisplay,
  type CountryCode,
} from "@/lib/phone/normalize";
import { getCountryCallingCode } from "libphonenumber-js";

interface Props {
  /** Raw phone string (what the user typed). */
  value: string;
  onChange: (next: string) => void;
  /** Country to default to when the value is empty. */
  defaultCountry?: CountryCode;
  /** Country picker is forced to this value (uncontrolled otherwise). */
  country?: CountryCode;
  onCountryChange?: (next: CountryCode) => void;
  placeholder?: string;
  className?: string;
  /** Mark the field invalid (red ring). */
  invalid?: boolean;
  autoFocus?: boolean;
  inputId?: string;
  "aria-label"?: string;
}

export function CountryPhoneInput({
  value,
  onChange,
  defaultCountry = "CY",
  country: countryProp,
  onCountryChange,
  placeholder = "Номер телефона",
  className = "",
  invalid,
  autoFocus,
  inputId,
  ...rest
}: Props) {
  const reactId = useId();
  const id = inputId ?? `phone-${reactId}`;
  const [internalCountry, setInternalCountry] = useState<CountryCode>(defaultCountry);
  const country = countryProp ?? internalCountry;
  const setCountry = (next: CountryCode) => {
    if (onCountryChange) onCountryChange(next);
    else setInternalCountry(next);
  };

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Auto-detect country when the user pastes a "+..." number.
  useEffect(() => {
    if (!value || !value.startsWith("+")) return;
    const guess = guessCountry(value);
    if (guess && guess !== country) setCountry(guess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close picker on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const callingCode = useMemo(() => {
    try {
      return `+${getCountryCallingCode(country)}`;
    } catch {
      return "+";
    }
  }, [country]);

  const display = value && value.startsWith("+") ? formatDisplay(value, country) : value;

  return (
    <div ref={wrapRef} className={`relative flex items-stretch rounded-xl border ${invalid ? "border-[var(--system-red)]" : "border-[var(--separator)]"} bg-[var(--surface)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-tint)] ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-3 border-r border-[var(--separator)] rounded-l-xl active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-tint)]"
        aria-label="Выбрать страну"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-[18px] leading-none" aria-hidden>{countryFlag(country)}</span>
        <span className="text-[14px] text-[var(--label-secondary)] tabular-nums">{callingCode}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden />
      </button>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={display}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 h-11 px-3 bg-transparent text-[16px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none rounded-r-xl"
        aria-label={rest["aria-label"] ?? placeholder}
      />
      {open && (
        <div
          className="absolute top-full left-0 z-50 mt-1 max-h-[280px] w-[280px] overflow-y-auto rounded-xl border border-[var(--separator)] bg-[var(--surface-elevated)] shadow-lg"
          role="listbox"
        >
          {SUPPORTED_COUNTRIES.map((cc) => {
            let code = "+";
            try { code = `+${getCountryCallingCode(cc)}`; } catch { /* ignore */ }
            const name = COUNTRY_NAMES_RU[cc] ?? cc;
            const active = cc === country;
            return (
              <button
                key={cc}
                type="button"
                onClick={() => { setCountry(cc); setOpen(false); }}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-[14px] hover:bg-[var(--surface-active)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:bg-[var(--surface-active)] ${active ? "bg-[var(--accent-tint)] text-[var(--accent)]" : "text-[var(--label)]"}`}
                role="option"
                aria-selected={active}
              >
                <span className="text-[18px]" aria-hidden>{countryFlag(cc)}</span>
                <span className="flex-1 truncate">{name}</span>
                <span className="tabular-nums text-[var(--label-secondary)]">{code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
