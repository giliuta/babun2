import {
  Smartphone,
  RefreshCw,
  Users,
  Calendar,
  User,
  FileUp,
} from "@babun/shared/icons";

interface Feature {
  icon: typeof Smartphone;
  title: string;
  desc: string;
}

const FEATURES: Feature[] = [
  {
    icon: Smartphone,
    title: "Mobile-first PWA",
    desc: "Устанавливается на iPhone и Android как обычное приложение. Работает быстро, выглядит как родное.",
  },
  {
    icon: RefreshCw,
    title: "Синхронизация в реальном времени",
    desc: "Изменения с телефона мгновенно появляются на компьютере у коллег. Без F5, без задержек.",
  },
  {
    icon: Users,
    title: "Команда и роли",
    desc: "Owner, Dispatcher, Master с гранулярным доступом. Мастер видит только свои встречи и не трогает финансы.",
  },
  {
    icon: Calendar,
    title: "Умный календарь",
    desc: "Смены команды, рабочие часы, выходные, выезд по городам. Перетаскивай, копируй, повторяй.",
  },
  {
    icon: User,
    title: "Карточки клиентов",
    desc: "История визитов, заметки, фото объектов, теги, контакты. Всё в одном экране.",
  },
  {
    icon: FileUp,
    title: "Импорт из других CRM",
    desc: "Загрузи CSV из Bumpix, HubSpot или Excel. За 5 минут переедешь со всеми клиентами.",
  },
];

export default function Features() {
  return (
    <section
      id="features"
      className="bg-[var(--surface-card)] py-16 lg:py-24 border-y border-[var(--separator)]"
    >
      <div className="max-w-6xl mx-auto px-4 lg:px-8">
        <h2 className="text-[28px] sm:text-[32px] lg:text-[40px] font-semibold tracking-tight text-[var(--label)] text-center max-w-2xl mx-auto">
          Всё, что нужно сервисному бизнесу
        </h2>
        <p className="mt-3 text-[16px] text-[#3C3C43D9] text-center max-w-xl mx-auto">
          От первой записи клиента до отчёта за месяц.
        </p>

        <div className="mt-10 lg:mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon: Icon, title, desc }: Feature) {
  return (
    <div className="bg-[var(--surface-grouped)] rounded-2xl p-5 lg:p-6">
      <div
        className="w-10 h-10 rounded-[10px] flex items-center justify-center"
        style={{ background: "rgba(62, 136, 247, 0.10)", color: "var(--accent)" }}
      >
        <Icon size={20} strokeWidth={2} />
      </div>
      <h3 className="mt-4 text-[16px] lg:text-[17px] font-semibold tracking-tight text-[var(--label)]">
        {title}
      </h3>
      <p className="mt-2 text-[14px] text-[#3C3C43D9] leading-snug">
        {desc}
      </p>
    </div>
  );
}
