import type { Viewport } from "next";
import Link from "next/link";

export const metadata = {
  title: "Конфиденциальность — Babun",
  description:
    "Политика конфиденциальности Babun. Сейчас Babun находится в режиме беты — публичная политика будет опубликована перед запуском.",
};

export const viewport: Viewport = {
  themeColor: "#3E88F7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] bg-[var(--surface-grouped)] text-[var(--label)]">
      <div className="max-w-2xl mx-auto px-4 lg:px-8 py-16">
        <Link
          href="/"
          className="text-[14px] text-[var(--accent)] font-medium hover:underline"
        >
          ← На главную
        </Link>
        <h1 className="mt-6 text-[28px] sm:text-[32px] font-semibold tracking-tight">
          Конфиденциальность
        </h1>
        <div className="mt-6 space-y-4 text-[15px] leading-snug text-[var(--label-secondary)]">
          <p>
            Эта страница находится в разработке. До запуска публичной версии
            (осень 2026) Babun используется в режиме беты и обрабатывает
            только данные пользователей, которые сами зарегистрировались.
          </p>
          <p>
            Данные размещены в дата-центрах Supabase в Европейском Союзе и
            подпадают под действие GDPR. Каждый бизнес изолирован на уровне
            базы данных через row-level security — другие пользователи не
            могут получить доступ к вашим записям.
          </p>
          <p>
            Если у вас есть вопросы про обработку данных — напишите на{" "}
            <a
              href="mailto:hello@babun.app"
              className="text-[var(--accent)] hover:underline"
            >
              hello@babun.app
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
