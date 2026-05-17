// Search-match highlight — Sprint clients-99 (F2.1).
//
// Wraps every occurrence of `match` inside `text` in a <mark> with our
// brand highlight color. `match` is case- and diacritic-insensitive
// for Cyrillic + Latin alphabets so "Анна" hits "АННА" and "anna"
// hits "Аnnа". We never re-render markup the user typed — the input
// is rendered as plain text + escaped <mark> tags only.

import { useMemo } from "react";

interface HighlightProps {
  /** Original text to render. */
  text: string;
  /** What to highlight inside `text`. Empty / whitespace = no highlight. */
  match: string;
  /** Optional className for the wrapping span. */
  className?: string;
}

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("ru")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Escape a string for use inside a RegExp character set. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function Highlight({ text, match, className }: HighlightProps) {
  const parts = useMemo(() => {
    const needle = (match ?? "").trim();
    if (!needle || !text) return [{ kind: "text" as const, value: text }];
    const normalizedHaystack = normalize(text);
    const normalizedNeedle = normalize(needle);
    if (!normalizedNeedle) return [{ kind: "text" as const, value: text }];

    // Walk normalized indices but slice from the original `text` so
    // capitalization & diacritics survive in the output.
    const re = new RegExp(escapeRegex(normalizedNeedle), "g");
    const out: Array<{ kind: "text" | "mark"; value: string }> = [];
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(normalizedHaystack)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (start > cursor) out.push({ kind: "text", value: text.slice(cursor, start) });
      out.push({ kind: "mark", value: text.slice(start, end) });
      cursor = end;
      if (m[0].length === 0) re.lastIndex += 1; // safety against zero-width matches
    }
    if (cursor < text.length) out.push({ kind: "text", value: text.slice(cursor) });
    return out;
  }, [text, match]);

  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.kind === "mark" ? (
          <mark
            key={i}
            className="bg-[var(--highlight-bg,rgba(255,204,0,0.45))] text-inherit rounded-[2px] px-[1px]"
          >
            {p.value}
          </mark>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  );
}
