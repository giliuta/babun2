import Link from "next/link";
import LandingImage from "./LandingImage";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[var(--surface-grouped)]">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 pt-16 pb-12 lg:pt-24 lg:pb-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-[36px] leading-[1.1] sm:text-[44px] lg:text-[56px] font-semibold tracking-tight text-[var(--label)]">
              CRM для сервисного бизнеса
            </h1>
            <p className="mt-5 text-[17px] sm:text-[18px] lg:text-[20px] leading-snug text-[#3C3C43D9] max-w-xl mx-auto lg:mx-0">
              Клиенты, расписание, команда — всё в одном месте.{" "}
              <span className="whitespace-nowrap">Mobile-first,</span>{" "}
              multi-device sync.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                href="/register"
                className="h-12 px-6 rounded-[12px] bg-[#1F66D7] text-white text-[16px] font-semibold flex items-center justify-center hover:bg-[#1850A8] active:scale-[0.99] transition"
              >
                Попробовать бесплатно
              </Link>
              <Link
                href="/login"
                className="h-12 px-6 rounded-[12px] border border-[var(--separator)] text-[var(--label)] text-[16px] font-medium flex items-center justify-center hover:bg-[var(--fill-quaternary)] transition"
              >
                Войти
              </Link>
            </div>
            <p className="mt-4 text-[13px] text-[#3C3C43A6]">
              Бесплатно во время беты · регистрация без SMS
            </p>
          </div>

          <div className="relative aspect-[4/3] lg:aspect-[5/4]">
            <LandingImage
              src="/landing/hero-iphone.png"
              alt="Babun на iPhone и Macbook"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
