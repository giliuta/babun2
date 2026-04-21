"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { ICON_TONE_BG, type IconTone } from "@/lib/design-tokens";

interface BaseProps {
  /** Lucide icon component (e.g. `CalendarDays`). Optional — some
   *  rows are text-only (like an email display row). */
  icon?: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Tone of the coloured icon tile. Defaults to "blue" (Telegram primary). */
  iconTone?: IconTone;
  label: ReactNode;
  subtitle?: ReactNode;
  /** Right-side content: amount, chip, switch. */
  accessory?: ReactNode;
  /** Show the trailing chevron. Defaults to true when `href` is set. */
  chevron?: boolean;
  destructive?: boolean;
  /** Force separator underneath even if this is the last child. */
  separator?: boolean;
}

type ListRowProps =
  | (BaseProps & { href: string; onClick?: never })
  | (BaseProps & { onClick: () => void; href?: never })
  | (BaseProps & { href?: undefined; onClick?: undefined });

// Single row inside a `ListGroup`. Three variants:
//   • href → renders a Next `<Link>` with chevron
//   • onClick → renders a <button>
//   • neither → renders a <div> (display-only)
//
// Left slot carries an optional 28×28 coloured tile with a lucide
// icon (mirrors Telegram Settings). Right slot is either a chevron
// (nav) or a caller-provided accessory (switch, amount, chip).
export default function ListRow(props: ListRowProps) {
  const {
    icon: Icon,
    iconTone = "blue",
    label,
    subtitle,
    accessory,
    chevron,
    destructive,
    separator,
  } = props;
  const isInteractive = "href" in props || "onClick" in props;
  const showChevron = chevron ?? ("href" in props && !accessory);

  const content = (
    <>
      {Icon && (
        <span
          className={`w-7 h-7 rounded-[var(--radius-tile)] flex items-center justify-center text-white shrink-0 ${ICON_TONE_BG[iconTone]}`}
        >
          <Icon size={16} strokeWidth={2.25} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div
          className={`text-[15px] font-normal leading-tight truncate ${
            destructive ? "text-[var(--system-red)]" : "text-[var(--label)]"
          }`}
        >
          {label}
        </div>
        {subtitle && (
          <div className="text-[12px] text-[var(--label-secondary)] mt-0.5 truncate">
            {subtitle}
          </div>
        )}
      </div>
      {accessory && (
        <div className="shrink-0 text-[15px] text-[var(--label-secondary)]">
          {accessory}
        </div>
      )}
      {showChevron && (
        <ChevronRight size={18} className="text-[var(--label-tertiary)] shrink-0 -mr-1" />
      )}
    </>
  );

  const rowCls = `flex items-center gap-3 px-4 py-2.5 min-h-[48px] ${
    separator !== false ? "row-separator" : ""
  } ${
    isInteractive ? "active:bg-[var(--fill-quaternary)] transition-colors" : ""
  }`;

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={rowCls}>
        {content}
      </Link>
    );
  }
  if ("onClick" in props && props.onClick) {
    return (
      <button type="button" onClick={props.onClick} className={`${rowCls} w-full text-left`}>
        {content}
      </button>
    );
  }
  return <div className={rowCls}>{content}</div>;
}
