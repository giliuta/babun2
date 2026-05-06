import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-[var(--surface-grouped)]/80 border-b border-[var(--separator)]">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-[8px] bg-[var(--accent)] text-white flex items-center justify-center text-[15px] font-bold tracking-tight">
            B
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--label)]">
            Babun
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-[14px]">
          <Link
            href="/login"
            className="h-9 px-3 rounded-[10px] text-[var(--label)] font-medium hover:bg-[var(--fill-quaternary)] transition flex items-center"
          >
            Войти
          </Link>
          <Link
            href="/register"
            className="h-9 px-4 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] font-semibold hover:bg-[var(--accent-pressed)] transition flex items-center"
          >
            Попробовать
          </Link>
        </nav>
      </div>
    </header>
  );
}
