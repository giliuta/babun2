// v676 / Audit-2026-05-21 P0-23 — scope-local not-found.
//
// Beta #52 feedback page calls `notFound()` when the token is missing,
// invalid, or fails the regex sanity check (see ./page.tsx).
// Without this file, Next.js falls back to the root `app/not-found.tsx`
// which shows a generic «404 Страница не найдена» message — surprising
// for a client who tapped a feedback link from an SMS and assumes the
// site itself is broken.
//
// Mirrors the public-share `/b/[token]` not-found copy («Ссылка больше
// не работает / Попросите мастера прислать актуальную ссылку») so the
// two public token surfaces feel consistent.

import Link from "next/link";
import { Link2Off } from "@babun/shared/icons";

export const metadata = {
  title: "Ссылка не работает · Babun",
};

export default function FeedbackTokenNotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[var(--surface-grouped)] px-6 text-center">
      <div className="w-14 h-14 rounded-[18px] bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] flex items-center justify-center mb-4">
        <Link2Off size={22} strokeWidth={2} />
      </div>
      <h1 className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
        Ссылка больше не работает
      </h1>
      <p className="mt-2 text-[13px] text-[var(--label-secondary)] max-w-sm leading-snug">
        Попросите команду прислать актуальную ссылку, чтобы оставить отзыв.
      </p>
      <Link
        href="/"
        className="mt-6 text-[15px] font-medium text-[var(--accent)] active:opacity-60"
      >
        На главную
      </Link>
    </main>
  );
}
