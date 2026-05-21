"use client";

import { ChevronLeft } from "@babun/shared/icons";
import { useRouter } from "next/navigation";

// Sprint 033 Phase I31 — mirror of BrigadeSectionShell for /dashboard/masters
// subroutes. Keeps concerns separate so the two detail flows can evolve
// independently without accidental coupling through shared props.

interface MasterSectionShellProps {
  /** Master id used to compose the back route. `new` sends the user
   *  back to /dashboard/masters (the list). */
  masterId: string;
  title: string;
  saveLabel?: string;
  canSave?: boolean;
  onSave?: () => boolean | Promise<boolean> | void | Promise<void>;
  hideSave?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
  children: React.ReactNode;
}

export default function MasterSectionShell({
  masterId,
  title,
  saveLabel = "Сохранить",
  canSave = true,
  onSave,
  hideSave = false,
  onDelete,
  deleteLabel = "Удалить",
  children,
}: MasterSectionShellProps) {
  const router = useRouter();
  const backHref =
    masterId === "new" ? "/dashboard/masters" : `/dashboard/masters/${masterId}`;

  const handleSave = async () => {
    if (!onSave) return;
    const res = await onSave();
    if (res === false) return;
    router.push(backHref);
  };

  // v694 — backHref-first; PWA standalone reports history.length > 1
  // even on cold launches, which made router.back() silently no-op.
  const goBack = () => {
    router.replace(backHref);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-grouped)]">
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
          {onDelete && masterId !== "new" && (
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
