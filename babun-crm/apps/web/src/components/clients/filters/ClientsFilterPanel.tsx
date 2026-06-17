"use client";

// v809 — centered «Фильтры» panel. One scrim, one card; sticky header
// (Сбросить · Фильтры · ✕), scrollable grouped body, sticky footer with
// a live «Показать N» button. All controls apply LIVE — the footer just
// closes. ≤400 lines.

import { useEffect } from "react";
import {
  ArrowUpDown,
  Calendar,
  Check,
  MapPin,
  Sparkles,
  Tag,
  Users,
  X,
} from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { registerModalBack } from "@/lib/history-stack";
import { countWordRu } from "@babun/shared/common/utils/pluralize";
import { SortPills } from "./SortPills";
import { FacetSection } from "./FacetSection";
import { PeriodSection } from "./PeriodSection";
import {
  SEGMENT_OPTIONS,
  type SortKey,
  type Segment,
  type ClientFilterResult,
} from "./useClientFilters";
import type { PeriodValue } from "./types";

export interface SegmentCounts {
  debt: number;
  birthday: number;
  blacklist: number;
  silent: number;
  new: number;
  loyal: number;
}

interface ClientsFilterPanelProps {
  /** Derived data + counts from useClientFilters. */
  result: ClientFilterResult;
  /** Auto-segment counts (>0 gate which status pills render). */
  segmentCounts: SegmentCounts;
  // ── Controlled state ──
  sort: SortKey;
  segment: Segment;
  selectedTeams: string[];
  selectedCities: string[];
  activeTags: string[];
  period: PeriodValue | null;
  // ── Setters ──
  onSortChange: (next: SortKey) => void;
  onSegmentChange: (next: Segment) => void;
  onToggleTeam: (value: string) => void;
  onToggleCity: (value: string) => void;
  onToggleTag: (value: string) => void;
  onPeriodChange: (next: PeriodValue | null) => void;
  onResetFilters: () => void;
  onClose: () => void;
}

export function ClientsFilterPanel({
  result,
  segmentCounts,
  sort,
  segment,
  selectedTeams,
  selectedCities,
  activeTags,
  period,
  onSortChange,
  onSegmentChange,
  onToggleTeam,
  onToggleCity,
  onToggleTag,
  onPeriodChange,
  onResetFilters,
  onClose,
}: ClientsFilterPanelProps) {
  // Hardware Back / iOS edge-swipe closes the panel.
  useEffect(() => {
    const popClose = registerModalBack("clients-filter-panel", onClose);
    return popClose;
  }, [onClose]);

  // Escape closes; body scroll lock while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const { filtered, facetCounts, activeCount, teamOptions, cityOptions, tagOptions } =
    result;
  const shownCount = filtered.length;
  const nothingActive = activeCount === 0;

  // Render a status pill when it has matches OR when it's the active
  // segment — otherwise an active segment whose count just dropped to 0
  // would vanish from the panel and become impossible to toggle off.
  const availableSegments = SEGMENT_OPTIONS.filter(
    (s) => segmentCounts[s.key] > 0 || s.key === segment,
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[3px] p-5 animate-backdrop-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Фильтры"
    >
      <div
        className="w-full max-w-[344px] max-h-[82vh] bg-[var(--surface-card)] rounded-[24px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden animate-popup-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="relative flex items-center justify-center px-3 h-[52px] border-b border-[var(--separator)] shrink-0">
          <button
            type="button"
            disabled={nothingActive}
            onClick={() => {
              if (nothingActive) return;
              haptic("tap");
              onResetFilters();
            }}
            className={`absolute left-3 text-[13px] font-semibold px-1.5 py-1 transition ${
              nothingActive
                ? "text-[var(--label-tertiary)] pointer-events-none"
                : "text-[var(--accent)] active:opacity-60"
            }`}
          >
            Сбросить
          </button>
          <span className="text-[15px] font-semibold text-[var(--label)]">
            Фильтры
          </span>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              onClose();
            }}
            aria-label="Закрыть"
            className="absolute right-3 w-8 h-8 flex items-center justify-center rounded-full text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] transition"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-4 flex flex-col gap-5">
          <Section icon={<ArrowUpDown size={15} strokeWidth={2.2} />} caption="Порядок">
            <SortPills value={sort} onChange={onSortChange} />
          </Section>

          {availableSegments.length > 0 && (
            <Section icon={<Sparkles size={15} strokeWidth={2.2} />} caption="Статус">
              <div className="flex flex-wrap gap-1.5">
                {availableSegments.map((s) => {
                  const on = segment === s.key;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => {
                        haptic("tap");
                        onSegmentChange(on ? "all" : s.key);
                      }}
                      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-semibold whitespace-nowrap border transition press-scale ${
                        on
                          ? "bg-[var(--accent-tint)] border-[var(--accent)] text-[var(--accent)]"
                          : "bg-[var(--surface-card-secondary)] border-transparent text-[var(--label)] active:bg-[var(--fill-quaternary)]"
                      }`}
                    >
                      {on && (
                        <span className="animate-check-pop">
                          <Check size={13} strokeWidth={2.6} />
                        </span>
                      )}
                      {s.label}
                      <span className="tabular-nums opacity-70">
                        {segmentCounts[s.key]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {teamOptions.length > 0 && (
            <Section icon={<Users size={15} strokeWidth={2.2} />} caption="Команда">
              <FacetSection
                options={teamOptions}
                selected={selectedTeams}
                counts={facetCounts.team}
                onToggle={onToggleTeam}
              />
            </Section>
          )}

          {cityOptions.length > 0 && (
            <Section icon={<MapPin size={15} strokeWidth={2.2} />} caption="Метка">
              <FacetSection
                options={cityOptions}
                selected={selectedCities}
                counts={facetCounts.city}
                onToggle={onToggleCity}
              />
            </Section>
          )}

          {tagOptions.length > 0 && (
            <Section icon={<Tag size={15} strokeWidth={2.2} />} caption="Тег">
              <FacetSection
                options={tagOptions}
                selected={activeTags}
                counts={facetCounts.tag}
                onToggle={onToggleTag}
              />
            </Section>
          )}

          <Section icon={<Calendar size={15} strokeWidth={2.2} />} caption="Период">
            <PeriodSection value={period} onChange={onPeriodChange} />
          </Section>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-[var(--separator)] p-3">
          <button
            type="button"
            onClick={() => {
              haptic("tap");
              onClose();
            }}
            className="w-full h-12 rounded-[14px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] transition press-scale"
          >
            {shownCount === 0
              ? "Ничего не найдено"
              : `Показать ${shownCount} ${countWordRu(
                  shownCount,
                  "клиента",
                  "клиента",
                  "клиентов",
                )}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  caption,
  children,
}: {
  icon: React.ReactNode;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-[8px] bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
          {icon}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--label-tertiary)]">
          {caption}
        </span>
      </div>
      {children}
    </div>
  );
}
