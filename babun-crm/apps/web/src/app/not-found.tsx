import Link from "next/link";

// Babun-branded 404. Renders for any URL that didn't match a route or
// a redirect (next.config.ts handles short-form aliases like /clients).
// Sprint 024 STORY-008 — replaces the default English chrome page.
export default function NotFound() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-6 text-center"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
    >
      <div className="w-14 h-14 rounded-2xl bg-violet-600 text-white flex items-center justify-center text-2xl font-bold mb-5 shadow-lg">
        B
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 mb-1">
        404
      </div>
      <h1 className="text-[22px] font-bold text-slate-900">Страница не найдена</h1>
      <p className="mt-2 text-sm text-slate-500 max-w-xs">
        Похоже, ссылка устарела или адрес введён с ошибкой. Возвращайтесь на
        главный экран — там календарь и всё остальное.
      </p>
      <div className="mt-6 flex flex-col gap-2 w-full max-w-xs">
        <Link
          href="/dashboard"
          className="h-12 rounded-xl bg-violet-600 text-white text-[14px] font-semibold flex items-center justify-center active:scale-[0.99]"
        >
          На главную
        </Link>
        <Link
          href="/dashboard/clients"
          className="h-11 rounded-xl bg-slate-100 text-slate-700 text-[13px] font-medium flex items-center justify-center active:bg-slate-200"
        >
          Открыть клиентов
        </Link>
      </div>
    </main>
  );
}
