"use client";

interface SectionHeaderProps {
  title: string;
  /** Right-aligned action label (e.g. "Все", "Ещё"). */
  action?: { label: string; onClick: () => void };
}

// Standalone caption used above blocks that don't belong inside a
// ListGroup (e.g. "Расписание" on /dashboard/today's agenda, or
// "Активные" on /dashboard/masters). Same typography as ListGroup's
// internal caption so the two surfaces look unified.
export default function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 pb-2">
      <span className="text-[11px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        {title}
      </span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-[13px] font-medium text-[var(--accent)] active:text-[var(--accent-pressed)]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
