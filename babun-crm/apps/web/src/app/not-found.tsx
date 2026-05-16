import Link from "next/link";

// Babun-branded 404 in Telegram style. Simple centered stack on
// the grouped canvas — no chrome, no distractions.
export default function NotFound() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-[var(--surface-grouped)] px-6 text-center"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
    >
      <div className="w-16 h-16 rounded-[18px] bg-[var(--accent)] text-[var(--label-on-accent)] flex items-center justify-center text-[28px] font-bold mb-6 shadow-[0_15px_30px_-10px_rgba(62,136,247,0.45)]">
        B
      </div>
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--accent)] mb-1">
        404
      </div>
      <h1 className="text-[22px] font-bold text-[var(--label)]">
        Страница не найдена
      </h1>
      <p className="mt-2 text-[15px] text-[var(--label-secondary)] max-w-xs leading-snug">
        Похоже, ссылка устарела или адрес введён с ошибкой. Возвращайтесь на
        главный экран.
      </p>
      {/* P0 #7 (CRM Core brief) — this page is shared with public URLs
          like /book/[slug]; pointing it at /dashboard or /dashboard/clients
          deep-links logged-out visitors into the admin login. Primary
          goes to the public root (the landing page short-circuits
          logged-in users to /dashboard anyway), secondary is a plain
          login link for people who actually wanted the app. */}
      <div className="mt-8 flex flex-col gap-2 w-full max-w-xs">
        <Link
          href="/"
          className="h-[50px] rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--label-on-accent)] text-[17px] font-semibold flex items-center justify-center active:bg-[var(--accent-pressed)] active:scale-[0.98] transition"
        >
          Вернуться на главную сайта
        </Link>
        <Link
          href="/login"
          className="h-11 rounded-[var(--radius-pill)] bg-[var(--fill-primary)] text-[var(--label)] text-[15px] font-medium flex items-center justify-center active:bg-[var(--fill-secondary)] transition"
        >
          Войти в систему
        </Link>
      </div>
    </main>
  );
}
