import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[var(--surface-grouped)] border-t border-[var(--separator)]">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10 lg:py-14">
        <div className="grid lg:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-[7px] bg-[var(--accent)] text-white flex items-center justify-center text-[13px] font-bold">
                B
              </div>
              <span className="text-[14px] font-semibold tracking-tight text-[var(--label)]">
                Babun
              </span>
            </div>
            <p className="mt-3 text-[13px] text-[var(--label-tertiary)] max-w-[18em]">
              CRM для сервисного бизнеса.
            </p>
          </div>

          <nav className="text-[14px] grid grid-cols-2 gap-y-2">
            <Link
              href="#features"
              className="text-[var(--label)] hover:text-[var(--accent)] transition"
            >
              О продукте
            </Link>
            <Link
              href="/terms"
              className="text-[var(--label)] hover:text-[var(--accent)] transition"
            >
              Условия
            </Link>
            <Link
              href="/privacy"
              className="text-[var(--label)] hover:text-[var(--accent)] transition"
            >
              Конфиденциальность
            </Link>
            <a
              href="mailto:hello@babun.app"
              className="text-[var(--label)] hover:text-[var(--accent)] transition"
            >
              Контакты
            </a>
          </nav>

          <div className="text-[13px] text-[var(--label-tertiary)] lg:text-right">
            <a
              href="mailto:hello@babun.app"
              className="text-[var(--label)] hover:text-[var(--accent)] transition"
            >
              hello@babun.app
            </a>
            <p className="mt-2">© 2026 Babun · Cyprus</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
