import LandingImage from "./LandingImage";

interface Step {
  num: string;
  title: string;
  desc: string;
  image?: string;
  imageAlt?: string;
}

const STEPS: Step[] = [
  {
    num: "1",
    title: "Зарегистрируйся",
    desc: "За 30 секунд. Email + пароль, без подтверждения по SMS.",
  },
  {
    num: "2",
    title: "Настрой бизнес",
    desc: "Название, тип (HVAC / красота / авто / клининг / другое), город. Минута через onboarding wizard.",
    image: "/landing/onboarding.png",
    imageAlt: "Скриншот онбординга",
  },
  {
    num: "3",
    title: "Работай",
    desc: "Добавляй клиентов, планируй встречи, приглашай команду через email-инвайт. Всё бесплатно во время беты.",
    image: "/landing/dashboard.png",
    imageAlt: "Скриншот рабочего экрана",
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-[var(--surface-grouped)] py-16 lg:py-24">
      <div className="max-w-6xl mx-auto px-4 lg:px-8">
        <h2 className="text-[28px] sm:text-[32px] lg:text-[40px] font-semibold tracking-tight text-[var(--label)] text-center">
          С нуля до первой записи — за 2 минуты
        </h2>

        <div className="mt-10 lg:mt-14 space-y-8 lg:space-y-12">
          {STEPS.map((step, idx) => (
            <div
              key={step.num}
              className={`grid lg:grid-cols-2 gap-6 lg:gap-12 items-center ${
                idx % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-bold"
                    style={{
                      background: "rgba(62, 136, 247, 0.10)",
                      color: "var(--accent)",
                    }}
                  >
                    {step.num}
                  </div>
                  <h3 className="text-[20px] lg:text-[24px] font-semibold tracking-tight text-[var(--label)]">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-3 text-[15px] lg:text-[16px] text-[#3C3C43D9] leading-snug max-w-md">
                  {step.desc}
                </p>
              </div>
              {step.image && (
                <div className="aspect-[4/3] lg:aspect-[5/4]">
                  <LandingImage src={step.image} alt={step.imageAlt ?? ""} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
