interface QA {
  q: string;
  a: string;
}

// STORY-061 — refreshed FAQ. Trimmed beta-only copy, added the
// questions the user spec called out (cancel subscription, Twilio
// BYOK, offline behaviour) so the landing answers what people
// actually ask before signing up.
const FAQS: QA[] = [
  {
    q: "Безопасны ли мои данные клиентов?",
    a: "Да. Каждый бизнес изолирован на уровне Postgres Row-Level Security — другие пользователи Babun физически не могут читать ваши записи. Соединения шифруются TLS 1.3. Пароли хранятся в виде bcrypt-хэшей. Данные лежат в дата-центрах Supabase в ЕС и подпадают под GDPR.",
  },
  {
    q: "Можно ли использовать на телефоне?",
    a: "Babun спроектирован прежде всего как мобильное приложение. Открой babun.app в Safari (iPhone) или Chrome (Android) и установи на главный экран — будет работать как обычное нативное приложение. На десктопе тоже всё хорошо: тот же интерфейс, те же данные.",
  },
  {
    q: "Что если у меня нет интернета?",
    a: "Babun хранит локальную копию клиентов и записей в браузере, поэтому при плохой связи приложение продолжает показывать данные. Новые записи и правки уходят в очередь и автоматически отправятся на сервер когда сеть появится — никаких потерянных изменений.",
  },
  {
    q: "Как импортировать существующих клиентов?",
    a: "Загрузи CSV из Bumpix, HubSpot, Excel или любого другого CRM — Babun сам определит колонки и проверит дубликаты по телефону. Поддерживаются UTF-8 и Windows-1251. До 5 000 строк за один раз.",
  },
  {
    q: "Можно ли отменить подписку?",
    a: "Да, в любой момент. Отмена через Stripe Customer Portal — кнопка прямо в Настройки → Биллинг. Подписка остаётся активной до конца оплаченного периода, после чего аккаунт переходит на Free план. Все клиенты и записи остаются на месте.",
  },
  {
    q: "Подключается ли к моему Twilio?",
    a: "Да. На тарифах Pro и Business можно подключить свой Twilio аккаунт — Account SID, Auth Token, From-номер вводятся в Настройки → SMS. Babun будет отправлять напоминания через ваш номер, и стоимость SMS оплачивается напрямую Twilio. На Business есть альтернатива — общий номер Babun по подписке.",
  },
  {
    q: "Можно ли пригласить команду?",
    a: "Да. Owner отправляет email-инвайт с одной из трёх ролей: Owner (полный доступ), Dispatcher (календарь и клиенты, без финансов) или Master (только свои встречи, без редактирования). Ссылка живёт 7 дней, использовать можно один раз.",
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
