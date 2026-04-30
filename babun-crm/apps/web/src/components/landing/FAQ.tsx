interface QA {
  q: string;
  a: string;
}

const FAQS: QA[] = [
  {
    q: "Сколько стоит сейчас?",
    a: "Сейчас Babun полностью бесплатен. Платные тарифы появятся осенью 2026. Юзеры, которые зарегистрировались во время беты, получат особые условия при запуске платных тарифов.",
  },
  {
    q: "Можно ли импортировать клиентов из другого CRM?",
    a: "Да. Загрузи CSV из Bumpix, HubSpot, Excel или любого другого CRM — Babun сам определит колонки и проверит дубликаты по телефону. Поддерживаются UTF-8 и Windows-1251. До 5000 строк за один раз.",
  },
  {
    q: "Безопасны ли мои данные?",
    a: "Да. Каждый клиент изолирован на уровне базы данных — другие пользователи не могут получить доступ к вашим записям. Все соединения защищены шифрованием. Пароли хранятся в зашифрованном виде. Данные размещены в дата-центрах Supabase в Европейском Союзе и подпадают под действие GDPR.",
  },
  {
    q: "Какие устройства поддерживаются?",
    a: "iPhone, Android, любой современный браузер. Mobile-first дизайн — всё рассчитано на одну руку. На десктопе тоже хорошо. PWA устанавливается на главный экран iOS и Android как обычное приложение.",
  },
  {
    q: "Можно ли пригласить команду?",
    a: "Да. Owner отправляет email-инвайт с одной из трёх ролей: Owner (полный доступ), Dispatcher (календарь и клиенты, без финансов) или Master (только свои встречи, без редактирования). Ссылка живёт 7 дней, использовать можно один раз.",
  },
  {
    q: "Работает ли offline?",
    a: "Babun хранит данные в облаке для синхронизации между устройствами. При плохой связи приложение продолжает работать с последними загруженными данными. Создание новых записей требует интернета.",
  },
  {
    q: "Что будет когда появятся платные тарифы?",
    a: "Осенью 2026 мы введём бесплатный план (для самозанятых) и платные тарифы для команд. Юзеры из беты получат grandfathered-условия — лимиты выше или цена ниже. Базовые функции (клиенты, календарь, мобильное приложение) останутся доступны навсегда.",
  },
];

export default function FAQ() {
  return (
    <section className="bg-[var(--surface-grouped)] py-16 lg:py-24">
      <div className="max-w-3xl mx-auto px-4 lg:px-8">
        <h2 className="text-[28px] sm:text-[32px] lg:text-[40px] font-semibold tracking-tight text-[var(--label)] text-center">
          Частые вопросы
        </h2>
        <div className="mt-10 lg:mt-14 bg-[var(--surface-card)] rounded-2xl divide-y divide-[var(--separator)]">
          {FAQS.map((qa) => (
            <details
              key={qa.q}
              className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
                <h3 className="text-[15px] lg:text-[16px] font-semibold text-[var(--label)]">
                  {qa.q}
                </h3>
                <span
                  aria-hidden
                  className="text-[#3C3C43A6] text-[20px] leading-none transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-[14px] lg:text-[15px] text-[#3C3C43D9] leading-snug">
                {qa.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
