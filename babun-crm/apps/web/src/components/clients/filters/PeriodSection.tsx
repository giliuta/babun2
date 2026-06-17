"use client";

// v809 — ПЕРИОД section: single-select preset chips computed from the
// REAL current date + a full-width «Свой диапазон» chip that expands an
// in-place С/До wheel range picker. Match logic lives in the hook
// (ANY appointment date within [from, to]).

import { useEffect, useMemo, useState } from "react";
import { Check } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { DateRangeWheel } from "./DateRangeWheel";
import type { PeriodPreset, PeriodValue } from "./types";

interface PresetDef {
  key: PeriodPreset;
  label: string;
  from: string;
  to: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function key(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return key(d);
}

/** Build the preset list against the real current date. */
function buildPresets(): PresetDef[] {
  const now = new Date();
  const today = key(now);
  const y = now.getFullYear();
  const m = now.getMonth();
  const monthStart = key(new Date(y, m, 1));
  const monthEnd = key(new Date(y, m + 1, 0));
  const prevStart = key(new Date(y, m - 1, 1));
  const prevEnd = key(new Date(y, m, 0));
  const yearStart = key(new Date(y, 0, 1));
  const yearEnd = key(new Date(y, 11, 31));
  return [
    { key: "today", label: "Сегодня", from: today, to: today },
    { key: "7d", label: "Последние 7 дней", from: daysAgo(6), to: today },
    { key: "30d", label: "Последние 30 дней", from: daysAgo(29), to: today },
    { key: "90d", label: "Последние 90 дней", from: daysAgo(89), to: today },
    { key: "month", label: "Этот месяц", from: monthStart, to: monthEnd },
    { key: "prevMonth", label: "Прошлый месяц", from: prevStart, to: prevEnd },
    { key: "year", label: "Этот год", from: yearStart, to: yearEnd },
  ];
}

interface PeriodSectionProps {
  value: PeriodValue | null;
  onChange: (next: PeriodValue | null) => void;
}

export function PeriodSection({ value, onChange }: PeriodSectionProps) {
  const presets = useMemo(buildPresets, []);
  const [customOpen, setCustomOpen] = useState(
    value?.preset === "custom",
  );

  // Collapse the wheel when the period is cleared from outside (panel
  // «Сбросить» or a bar token ✕ sets value → null while we're open).
  useEffect(() => {
    if (value === null) setCustomOpen(false);
  }, [value]);

  const isAll = value === null;
  const isCustom = value?.preset === "custom";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {/* «Всё время» = no selection */}
        <PresetChip
          active={isAll}
          onClick={() => {
            setCustomOpen(false);
            onChange(null);
          }}
        >
          Всё время
        </PresetChip>
        {presets.map((p) => (
          <PresetChip
            key={p.key}
            active={!isCustom && value?.preset === p.key}
            onClick={() => {
              setCustomOpen(false);
              onChange({ preset: p.key, from: p.from, to: p.to });
            }}
          >
            {p.label}
          </PresetChip>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          haptic("tap");
          setCustomOpen((v) => !v);
        }}
        className={`w-full h-11 px-3 rounded-[12px] text-[14px] font-semibold flex items-center justify-center gap-1.5 border transition press-scale ${
          isCustom
            ? "bg-[var(--accent-tint)] border-[var(--accent)] text-[var(--accent)]"
            : "bg-[var(--surface-card-secondary)] border-transparent text-[var(--label)] active:bg-[var(--fill-quaternary)]"
        }`}
      >
        {isCustom && (
          <span className="animate-check-pop">
            <Check size={14} strokeWidth={2.6} />
          </span>
        )}
        Свой диапазон
      </button>

      {customOpen && (
        <DateRangeWheel
          initialFrom={isCustom ? value.from : null}
          initialTo={isCustom ? value.to : null}
          onApply={(from, to) => {
            onChange({ preset: "custom", from, to });
          }}
        />
      )}
    </div>
  );
}

function PresetChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("tap");
        onClick();
      }}
      className={`inline-flex items-center h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap border transition press-scale ${
        active
          ? "bg-[var(--accent-tint)] border-[var(--accent)] text-[var(--accent)]"
          : "bg-[var(--surface-card-secondary)] border-transparent text-[var(--label)] active:bg-[var(--fill-quaternary)]"
      }`}
    >
      {children}
    </button>
  );
}
