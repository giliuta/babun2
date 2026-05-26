"use client";

import { AlertTriangle, ChevronRight } from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";

export function ListGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden divide-y divide-[var(--separator)]">
      {children}
    </div>
  );
}

export function NavRow({
  icon,
  tone,
  title,
  value,
  warning,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  value: string;
  /** When true, subtitle tints yellow and gets a ⚠ icon — signals
   *  that this subsection isn't set up yet. */
  warning?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic("tap");
        onClick();
      }}
      className="w-full flex items-center gap-3 px-4 py-3 min-h-[56px] active:bg-[var(--fill-quaternary)] transition press-scale"
    >
      <span
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-[var(--label-on-accent)] shrink-0 ${tone}`}
      >
        {icon}
      </span>
      <span className="flex-1 text-left min-w-0">
        <span className="block text-[15px] font-medium text-[var(--label)] truncate">
          {title}
        </span>
        {value && (
          <span
            className={`text-[13px] truncate mt-0.5 flex items-center gap-1 ${
              warning
                ? "text-[color:var(--system-yellow-strong,#B78600)] font-medium"
                : "text-[var(--label-secondary)]"
            }`}
          >
            {warning && (
              <AlertTriangle
                size={12}
                strokeWidth={2.5}
                className="shrink-0 text-[var(--system-yellow)] fill-[var(--system-yellow)]"
              />
            )}
            <span className="truncate">{value}</span>
          </span>
        )}
      </span>
      <ChevronRight size={16} className="text-[var(--label-quaternary)] shrink-0" />
    </button>
  );
}
