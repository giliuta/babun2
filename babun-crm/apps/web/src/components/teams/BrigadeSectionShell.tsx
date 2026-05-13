"use client";

import { ChevronLeft } from "@babun/shared/icons";
import { useRouter } from "next/navigation";

interface BrigadeSectionShellProps {
  /** Brigade id used to compose the back route. `new` sends the user
   *  back to /dashboard/teams (the list) since no concrete brigade
   *  record exists yet. */
  brigadeId: string;
  /** Title shown centered in the nav bar. */
  title: string;
  /** Label of the primary button (top-right). "Сохранить" by default. */
  saveLabel?: string;
  /** Disable save when the form can't be committed yet. */
  canSave?: boolean;
  /** Fired when the primary button is tapped. Return `true` to auto-
   *  navigate back after save (default), `false` to stay on the page.
   *  Ignored when `hideSave` is true. */
  onSave?: () => boolean | Promise<boolean> | void | Promise<void>;
  /** Hide the top-right Save pill entirely. Use for pages where each
   *  action persists instantly (iOS-Settings style). */
  hideSave?: boolean;
  /** Optional destructive action rendered at the bottom of the page.
   *  When set, renders as "Удалить …" in burgundy. */
  onDelete?: () => void;
  deleteLabel?: string;
  children: React.ReactNode;
}

export default function BrigadeSectionShell({
  brigadeId,
  title,
  saveLabel = "Сохранить",
  canSave = true,
  onSave,
  hideSave = false,
  onDelete,
  deleteLabel = "Удалить",
  children,
}: BrigadeSectionShellProps) {
  const router = useRouter();
  const backHref =
    brigadeId === "new" ? "/dashboard/teams" : `/dashboard/teams/${brigadeId}`;

  const handleSave = async () => {
    if (!onSave) return;
    const res = await onSave();
    if (res === false) return;
    router.push(backHref);
  };

  // v493 — back-arrow parity with PageHeader: walk history first
  // (snappy, doesn't pollute), fall back to backHref via replace().
  // Pre-v493 always-push left the user looping between the brigade
  // page and the section they just left because of duplicate entries.
  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.replace(backHref);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-grouped)]">
      {/* Flat iOS nav bar */}
      <div className="flex-shrink-0 bg-[var(--surface-card)] border-b border-[var(--separator)] h-12 flex items-center px-2 relative">
        <button
          type="button"
          onClick={goBack}
          aria-label="Назад"
          className="w-11 h-11 flex items-center justify-center rounded-full text-[var(--accent)] active:bg-[var(--fill-quaternary)] press-scale"
        >
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-semibold text-[var(--label)] tracking-tight truncate max-w-[55%] text-center">
          {title}
        </h1>
        {hideSave ? (
          <span className="ml-auto w-11 h-11" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="ml-auto h-9 px-3 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:bg-[var(--accent-pressed)] press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
          >
            {saveLabel}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+100px)] space-y-4">
          {children}
          {onDelete && brigadeId !== "new" && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onDelete}
                className="w-full h-12 flex items-center justify-center rounded-[var(--radius-card)] bg-[var(--surface-card)] text-[var(--system-red)] text-[15px] font-medium press-scale active:bg-[rgba(255,59,48,0.08)] shadow-[var(--shadow-card)]"
              >
                {deleteLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Small, reusable card-section wrapper for subroute bodies.
export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
      {(title || subtitle) && (
        <div className="px-4 pt-3.5 pb-2">
          {title && (
            <h2 className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-[13px] text-[var(--label-secondary)] mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className="px-4 pb-4 space-y-3">{children}</div>
    </section>
  );
}

export function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
