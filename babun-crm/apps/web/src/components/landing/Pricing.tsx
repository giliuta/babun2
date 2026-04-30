import Link from "next/link";

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="bg-[var(--surface-card)] py-16 lg:py-24 border-y border-[var(--separator)]"
    >
      <div className="max-w-2xl mx-auto px-4 lg:px-8 text-center">
        <h2 className="text-[28px] sm:text-[32px] lg:text-[40px] font-semibold tracking-tight text-[var(--label)]">
          Бесплатно сейчас
        </h2>
        <p className="mt-4 text-[16px] lg:text-[17px] text-[#3C3C43D9] leading-snug">
          Babun находится в активной разработке. Все функции доступны бесплатно во время беты.
          Платные тарифы появятся осенью 2026.
        </p>
        <p className="mt-3 text-[14px] text-[#3C3C43A6] leading-snug">
          Если зарегистрируешься сейчас — получишь grandfathered access к специальным условиям при запуске платных тарифов.
        </p>
        <div className="mt-8">
          <Link
            href="/register"
            className="inline-flex h-12 px-6 rounded-[12px] bg-[#1F66D7] text-white text-[16px] font-semibold items-center justify-center hover:bg-[#1850A8] active:scale-[0.99] transition"
          >
            Зарегистрироваться
          </Link>
        </div>
      </div>
    </section>
  );
}
