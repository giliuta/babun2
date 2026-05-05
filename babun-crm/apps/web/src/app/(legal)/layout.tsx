// STORY-071 — Legal pages shell. Plain reading layout used by
// /privacy and /terms. No sidebar, no auth gate — these pages are
// public and linked from auth + Stripe Checkout footer.

import Link from "next/link";

export const metadata = {
  title: "Babun · Юридическая информация",
};

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[var(--surface-grouped)]">
      <header className="border-b border-[var(--separator)] bg-[var(--surface-card)] px-5 py-4">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight text-[var(--label)]"
        >
          ← Babun
        </Link>
      </header>

      <article className="mx-auto max-w-2xl px-5 py-8 prose prose-sm prose-neutral">
        {children}
      </article>

      <footer className="border-t border-[var(--separator)] mt-12 py-6 text-center text-[12px] text-[var(--label-tertiary)]">
        <Link href="/privacy" className="underline mx-2">Политика конфиденциальности</Link>
        <span>·</span>
        <Link href="/terms" className="underline mx-2">Условия использования</Link>
        <div className="mt-2">Babun &copy; 2026</div>
      </footer>
    </main>
  );
}
