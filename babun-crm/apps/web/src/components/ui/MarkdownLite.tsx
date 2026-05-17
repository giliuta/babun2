// Lightweight markdown renderer — Sprint clients-99 (F3.9).
//
// We deliberately don't pull in a real markdown parser. Notes in
// Babun are short, structural patterns are well-bounded, and a tiny
// hand-rolled renderer keeps the bundle slim and the output trusted
// (no innerHTML, no user-injected markup). Supported syntax:
//
//   **bold**          → <strong>
//   *italic*          → <em>
//   ::red::АЛЛЕРГИЯ::  → red badge (allergy markers, etc)
//   - item            → bullet list
//   blank line        → paragraph break
//
// Anything else falls through as plain text + <br/> for line wraps.

import { Fragment, type ReactNode } from "react";

interface Props {
  text: string;
  className?: string;
}

const INLINE_RE = /(\*\*([^*]+)\*\*|\*([^*]+)\*|::red::([^:]+)::)/g;

function renderInline(line: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let cursor = 0;
  let i = 0;
  for (const m of line.matchAll(INLINE_RE)) {
    const start = m.index ?? 0;
    if (start > cursor) out.push(<Fragment key={`${keyBase}-t-${i++}`}>{line.slice(cursor, start)}</Fragment>);
    if (m[2] !== undefined) {
      out.push(<strong key={`${keyBase}-b-${i++}`} className="font-semibold">{m[2]}</strong>);
    } else if (m[3] !== undefined) {
      out.push(<em key={`${keyBase}-i-${i++}`} className="italic">{m[3]}</em>);
    } else if (m[4] !== undefined) {
      out.push(
        <span
          key={`${keyBase}-r-${i++}`}
          className="rounded-md bg-[rgba(255,59,48,0.12)] px-1.5 py-[1px] text-[var(--system-red)] font-semibold"
        >
          {m[4]}
        </span>,
      );
    }
    cursor = start + m[0].length;
  }
  if (cursor < line.length) out.push(<Fragment key={`${keyBase}-t-end`}>{line.slice(cursor)}</Fragment>);
  return out.length ? out : [line];
}

export function MarkdownLite({ text, className }: Props) {
  if (!text) return null;
  const lines = text.split("\n");

  // Group consecutive bullet rows into a single <ul>.
  const blocks: ReactNode[] = [];
  let bulletGroup: string[] | null = null;
  const flushBullets = (key: string) => {
    if (!bulletGroup) return;
    const items = bulletGroup;
    bulletGroup = null;
    blocks.push(
      <ul key={`ul-${key}`} className="ml-4 list-disc space-y-0.5">
        {items.map((item, j) => (
          <li key={`${key}-li-${j}`}>{renderInline(item, `${key}-li-${j}`)}</li>
        ))}
      </ul>,
    );
  };

  for (let n = 0; n < lines.length; n++) {
    const raw = lines[n];
    const trimmed = raw.trimStart();
    if (trimmed.startsWith("- ")) {
      bulletGroup = bulletGroup ?? [];
      bulletGroup.push(trimmed.slice(2));
      continue;
    }
    flushBullets(`b${n}`);
    if (raw.trim() === "") {
      blocks.push(<div key={`br-${n}`} className="h-2" aria-hidden />);
    } else {
      blocks.push(
        <p key={`p-${n}`} className="whitespace-pre-wrap break-words">
          {renderInline(raw, `p-${n}`)}
        </p>,
      );
    }
  }
  flushBullets("tail");

  return <div className={className}>{blocks}</div>;
}
