# Babun2 — Анализ функциональных пробелов

**Дата:** 2026-04-19
**Цель:** Сравнить Babun2 с лидерами field-service (HouseCallPro, Jobber, ServiceTitan, Altegio) и выделить пробелы для Cyprus HVAC use-case + будущей SaaS-продажи.

---

## 1. Что реально работает (dashboard + lib)

1. **Календарь** — day/week/month, swipe/pinch-zoom, drag-drop mouse-only, overlap-колонки, bumpix-like slot-menu, touch-calendar с 15/30-мин сеткой, BUILD_TAG проверка.
2. **Запись (Appointment)** — multi-services со степпером, per-line + global discount, custom_total, expenses, photos (base64), color_override, reminder_offsets с SMS-шаблоном, payment как единый объект (cash+card split / invoice), statuses, address + `address_note` + lat/lng, `is_online_booking` flag (тело без бэка).
3. **Клиент** — теги, заметки, locations (несколько объектов — дом/офис/вилла), AC-units (split/ducted/cassette с indoor/outdoor чекбоксами), acquisition source (referral/ig/wa/google), balance, discount.
4. **Waitlist** — client/phone/services/master/deadline/time_pref/location/status (pending/contacted/booked/dropped).
5. **Chats (UI-только)** — unified inbox stub для WA/IG/Telegram/SMS, сообщения с reply/star/photo/location типами, conversation statuses. Без реального webhook.
6. **Финансы** — expenses по категориям, payroll per-master и per-brigade, reports, reconciliations (stub), income с split-оплатами, finance-model.md документ.
7. **Schedule** — per-team рабочие часы + weekday overrides + date-overrides (отпуска/спец.режим), несколько breaks/день.
8. **Бригады** — internal/outsource type, lead+helpers, perJobCostCents.
9. **Settings** — calendar, cities (Лимассол/Пафос), booking (stub), шрифты/1st-day-week toggle (не persists).
10. **Маршрут дня (`/route`)** — список записей с GPS-координатами, но БЕЗ оптимизации маршрута и интеграции с Maps Directions.
11. **SMS-шаблоны** с плейсхолдерами `{name}/{date}/{time}/{address}`.
12. **PWA** — service worker, offline-ready, haptics на iOS.

---

## 2. Топ-10 функциональных пробелов vs лидеры

| # | Фича | Зачем для HVAC Cyprus | Преимущество для SaaS | Сложность | Supabase? |
|---|------|----------------------|----------------------|-----------|-----------|
| 1 | **Job photos до/после + подпись клиента на экране** | Прямо на объекте: фото кондиционера до чистки/после, палец клиента на iPhone = акт приёмки. Доказательство выполнения при спорах. | Killer-feature любого field-service SaaS — HCP/Jobber строят на этом маркетинг. | **M** | Частично (storage для фото; подпись SVG можно в localStorage) |
| 2 | **Онлайн-бронирование** `/book/{slug}` | AirFix получает 40% заявок через WhatsApp вручную. Публичная страница = минус 2 часа диспетчера/день. | Без этого SaaS не продаётся — базовая галочка у всех конкурентов. | **L** | Да (нужна публичная страница + auth-less запись) |
| 3 | **GPS-tracking бригад в реальном времени** | Диспетчер видит "George в 7 мин от клиента" → даёт ETA клиенту. На скутере +35°C звонки "где вы?" — боль. | ServiceTitan продаёт это за $200/мес. | **L** | Да (Realtime + team_locations таблица) |
| 4 | **Invoicing + PDF-генерация** | На Кипре B2B-клиенты (рестораны/офисы) требуют VAT-invoice. Сейчас Дмитрий делает в Google Docs. | Invoicing + Stripe payment-link = закрытие цикла. | **M** | Частично (PDF — клиент; хранение — Supabase Storage) |
| 5 | **Route optimization (Google Directions)** | 2 бригады × 6-8 визитов/день в Лимассоле. Оптимизация маршрута = 30-60 мин/день на бригаду. | Jobber даёт это в Pro-плане. | **M** | Нет (Google API + клиентская карта; data persist можно в localStorage) |
| 6 | **Recurring jobs (подписки на обслуживание)** | HVAC = сезонные чистки 2×/год. Сейчас ручное копирование записей. 903 клиента × 2 = 1800 напоминаний/год теряются. | Огромный retention-драйвер для сервисов (контракты на обслуживание). | **M** | Да (cron jobs + pg_cron) |
| 7 | **WhatsApp Business API (inbox + send)** | WhatsApp = 80% коммуникации на Кипре. Chat-UI уже есть — нужен webhook. | Ключевое для EU-рынка. | **L** | Да (webhook endpoint + realtime) |
| 8 | **Client portal** (история + предстоящие визиты) | Клиент видит: "следующая чистка 15 мая, счёт €80, фото прошлого визита". Меньше звонков "когда придёте?". | SaaS white-label для других сервисов. | **M** | Да (публичный auth через magic-link) |
| 9 | **Estimate / quote + approval link** | Монтаж split-системы = €800-2000. Нужно quote → клиент жмёт "Согласен" → создаётся job. Сейчас обмен PDF вручную. | Jobber's killer feature for contractor-upsell. | **M** | Да (public approval URL) |
| 10 | **Inventory + parts (freon/кронштейны)** | Склад фреона + расходников. Сейчас "бригадир помнит". При списании в job = автосписание со склада. | Serious-level SaaS-фича (ServiceTitan). | **L** | Да |

---

## 3. Топ-5 quick wins (localStorage, 1-2 дня)

1. **Подпись клиента на экране** (canvas → SVG, 1 день). Фото уже работают — нужен только `<SignaturePad/>` компонент + сохранение в `Appointment.signature_svg`. Value: сразу ощутимо "профессиональнее".
2. **Recurring templates** (duplicate-job "каждые 6 мес") — без cron, просто кнопка "Повторить через N месяцев" в completed-appointment + создание future appointment с тем же клиентом/ценой. 1 день. Поле `parent_appointment_id` для связи.
3. **PDF-invoice генерация на клиенте** (jspdf, 1 день) — кнопка "Invoice" в completed appointment → PDF с VAT-номером AirFix, позициями из `services[]`, подписью клиента. Share/Download. Без бэка.
4. **Route-optimization через Google Maps Directions API** (без бэка — прямо из браузера, 2 дня). `/route` уже показывает записи с lat/lng — добавить "Оптимизировать" → запрос в Directions с `waypoints=optimize:true` → перерисовать порядок. API key на клиенте (ограничить через HTTP referrer).
5. **Client portal read-only через share-link** (2 дня) — `/c/{clientToken}` где token = hash(client_id + secret). Показывает только предстоящие + прошлые визиты этого клиента из localStorage (через QR/ссылку, отправленную из CRM). Zero-auth preview — демонстрирует SaaS-потенциал инвесторам.

---

**Итог:** основной стратегический пробел — **фото+подпись+PDF-invoice цепочка "на объекте"** (#1 + quick-win #3) и **recurring contracts** (#6 + quick-win #2). Это даёт HVAC-боль и SaaS-историю одновременно, не требуя Supabase.
