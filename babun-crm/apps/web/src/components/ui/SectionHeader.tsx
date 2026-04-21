"use client";

interface SectionHeaderProps {
  title: string;
  /** Right-aligned action label (e.g. "Все", "Ещё"). */
  action?: { label: string; onClick: () => void };
}

// Standalone caption used above blocks that don't belong inside a
// ListGroup (e.g. "Расписание" on today's agenda, "Активные" on
// /dashboard/masters). Same typography as ListGroup's internal
// caption so the two surfaces look unified under Telegram's
// grouped-list spec: 13 px, uppercase, tracked secondary-label.
export default function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 pb-1.5">
      <span className="text-[13px] font-normal text-[var(--label-secondary)] uppercase tracking-wider">
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
