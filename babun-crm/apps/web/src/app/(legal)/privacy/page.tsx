// STORY-071 — Privacy Policy.
//
// Russian-language version, EU-compliant baseline. Covers GDPR core
// requirements: what we collect, why, retention, rights, contact.
// Update the controller name + email when the legal entity changes.

export const metadata = {
  title: "Политика конфиденциальности · Babun",
};

const LAST_UPDATED = "5 мая 2026";
const CONTACT_EMAIL = "support@babun.app";
const CONTROLLER = "Babun (giluta.art@gmail.com)";

export default function PrivacyPage() {
  return (
    <div className="text-[15px] leading-relaxed text-[var(--label)] space-y-5">
      <header>
        <h1 className="text-[24px] font-semibold tracking-tight mb-1">
          Политика конфиденциальности
        </h1>
        <p className="text-[12px] text-[var(--label-tertiary)]">
          Последнее обновление: {LAST_UPDATED}
        </p>
      </header>

      <section>
        <h2 className="text-[17px] font-semibold mt-5 mb-2">1. Кто мы</h2>
        <p>
          Сервис Babun — облачная CRM-система для сервисного бизнеса.
          Контроллер данных: {CONTROLLER}. По вопросам конфиденциальности
          пишите на {CONTACT_EMAIL}.
        </p>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold mt-5 mb-2">2. Какие данные мы собираем</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Учётные данные владельца тенанта: email, хеш пароля (через Supabase Auth).</li>
          <li>Данные бизнеса: название компании, город, отрасль.</li>
          <li>Данные клиентов и записей, которые вы вносите вручную: имена, телефоны, адреса, заметки.</li>
          <li>Платёжные данные обрабатываются Stripe — мы храним только идентификаторы (customer_id, subscription_id, payment_intent_id), не сами карты.</li>
          <li>Технические логи (IP, user-agent) для диагностики и анти-абьюза, удаляются через 90 дней.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold mt-5 mb-2">3. Зачем мы это используем</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Чтобы вы могли вести расписание, клиентскую базу и SMS-рассылку.</li>
          <li>Чтобы биллинг работал (подписки и пополнения SMS-баланса через Stripe).</li>
          <li>Чтобы отправлять SMS-напоминания клиентам — Twilio выступает обработчиком.</li>
          <li>Чтобы предотвращать злоупотребления (rate limit, аудит-логи).</li>
        </ul>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold mt-5 mb-2">4. Кому мы передаём данные</h2>
        <p>
          Данные обрабатывают только наши процессоры, каждый по своей роли:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li><strong>Supabase</strong> (хостинг базы и аутентификация) — серверы в ЕС.</li>
          <li><strong>Vercel</strong> (хостинг приложения) — глобальная edge-сеть.</li>
          <li><strong>Stripe</strong> (платежи) — PCI-DSS Level 1.</li>
          <li><strong>Twilio</strong> (отправка SMS) — обрабатывает только номер получателя и текст сообщения.</li>
        </ul>
        <p className="mt-2">
          Мы не продаём данные третьим лицам и не используем их в рекламных целях.
        </p>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold mt-5 mb-2">5. Сколько мы храним</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Активный аккаунт — пока он активен.</li>
          <li>После удаления аккаунта данные тенанта удаляются в течение 30 дней. Бэкапы перетираются по своему циклу — не дольше 90 дней.</li>
          <li>Платёжная история сохраняется 7 лет — этого требует налоговое законодательство ЕС.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold mt-5 mb-2">6. Ваши права (GDPR)</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Право на доступ — экспорт данных по запросу.</li>
          <li>Право на исправление — большинство полей редактируется в интерфейсе.</li>
          <li>Право на удаление — кнопка «Удалить аккаунт» в Настройках → Аккаунт, либо запрос на {CONTACT_EMAIL}.</li>
          <li>Право на портативность — экспорт в JSON по запросу.</li>
          <li>Право на возражение и ограничение обработки.</li>
          <li>Право пожаловаться в надзорный орган страны вашего проживания.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold mt-5 mb-2">7. Cookies</h2>
        <p>
          Мы используем только функциональные cookies, нужные для работы аутентификации и
          настроек интерфейса. Маркетинговых и аналитических cookies нет.
        </p>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold mt-5 mb-2">8. Изменения</h2>
        <p>
          О существенных изменениях этой политики мы сообщаем по email и через
          уведомление в приложении не позднее, чем за 14 дней до вступления в силу.
        </p>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold mt-5 mb-2">9. Связь</h2>
        <p>
          Любые вопросы — {CONTACT_EMAIL}. Мы отвечаем в течение 5 рабочих дней.
        </p>
      </section>
    </div>
  );
}
