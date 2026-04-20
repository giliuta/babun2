# IDEAS — Клиент-флоу: ускорение поиска и добавления

**Дата:** 2026-04-19
**Контекст:** 903 клиента (AirFix), поиск руками диспетчера на скутере. Сейчас поиск ограничен (`full_name / phone / phones[] / whatsapp_phone / telegram_username / instagram_username` — `clients/page.tsx:72-82`; в `ClientPickerSheet.tsx:48-56` ещё уже: только имя + основной телефон). Нет адресов/комментариев/тегов в фильтре. Создание клиента происходит в трёх местах: `clients/page.tsx` CreateClientPage, `ClientPickerSheet`, `AppointmentSheet` через ClientPicker — с разной логикой.

**Параллельные обязательные гигиенические фиксы из `UX_AUDIT.md` (P0/P1, не включены в список ниже):**
- расширение фильтра на `comment / sms_name / locations[].address / tag_ids` (п. 17)
- `inputMode="tel"` на phone-инпутах (Клиенты P1)
- унификация трёх карточек клиента (ClientPanel vs ClientProfileView vs ClientCard) — прежде чем строить новые фичи поверх, нужно выбрать одну

---

## 1. Fuzzy search + латиница↔кириллица

**Use case:** «мамед» находит `Мамедов Али`, `Магомед А.`, `Mehmet`. Диспетчер записывает со слуха кипрские имена — часто не знает, пишется ли клиент латиницей или кириллицей. Сейчас «mehmet» не найдёт `Мехмет Оздемир`.

**Реализация:** Добавить в `lib/clients-search.ts` нормализатор: lowercase → strip diacritics → прогон через двунаправленную транслитерационную таблицу (BGN/PCGN для RU, latin passport-style для TR). Поиск — по `Levenshtein ≤ 2` на префиксах слов. Для 903 клиентов — in-memory, без индекса, O(n×k) ≈ 20-30 мс. При `query.length < 2` выходим в текущую `includes`-ветку.

**Сложность:** M (один lib + замена фильтров в 2 местах)
**Supabase:** нет — клиентская функция
**Risk:** false-positives («ива» матчит пол списка). Митигация: fuzzy только когда exact `includes` не дал >3 результатов — показываем exact-результаты сверху, fuzzy под разделителем «Похожие».

---

## 2. Поиск по фрагменту адреса

**Use case:** «макариос» находит всех клиентов с Makarios Ave. Клиент звонит: «я тот, с Макариос 134» — диспетчер не помнит имя. Сейчас адрес в `locations[].address` не индексируется.

**Реализация:** Расширить `filtered` в `clients/page.tsx:72` и `ClientPickerSheet` на `c.locations.some(l => normalize(l.address).includes(q)) || normalize(c.address).includes(q)`. В ClientCard добавить highlight — жирно выделить совпавший фрагмент адреса.

**Сложность:** S (5 строк в фильтре + вывод адреса в списке)
**Supabase:** нет
**Risk:** адрес на карточке занимает строку — на 375px плотнее верстка. Митигация: показывать адрес только когда совпадает с query (иначе legacy-layout).

---

## 3. Voice search (голосовой ввод)

**Use case:** Руки в масках/маслах после ремонта AC. Диспетчер жмёт микрофон → «Иван Петров» → input заполнен, список отфильтрован.

**Реализация:** `webkitSpeechRecognition` (Safari 14.1+, iOS PWA supported). Кнопка-микрофон справа в search-поле (рядом с существующей lupa). `lang="ru-RU"`, single-shot. Результат идёт в `setSearch()`.

**Сложность:** S
**Supabase:** нет
**Risk:** точность на тюркских/греческих именах низкая (Safari игнорирует `lang` подсказки для экзотики — пишет «Мехмет» как «Махмуд»). Privacy: браузер просит микрофон каждый раз в PWA. Митигация: тихо degrade-hint если API нет + fuzzy из идеи №1 подхватит косяки распознавания.

---

## 4. Импорт контактов из iPhone через Contact Picker API

**Use case:** Один тап «Импорт из телефона» → iOS шит контактов → юзер выбирает 20 человек → создаются клиенты с phone + full_name. Сейчас 903 клиента забиты руками.

**Реализация:** `navigator.contacts.select(['name','tel'], { multiple: true })`. Доступно в Chrome Android, но **не в Safari** на апрель 2026 (WebKit bug 205886 открыт). Для PWA на iPhone реально работает только через `<input type="file" accept=".vcf">` (vCard) + парсер. Добавить кнопку «Импортировать vCard» на `/dashboard/clients`, парсить vCard 3.0/4.0 → прогонять через duplicate detection (№5) → batch-create.

**Сложность:** M (vCard parser — 80 строк, либо `vcf`-npm 4 kB)
**Supabase:** нет сейчас (insert в localStorage), после миграции — bulk insert с RLS
**Risk:** privacy — юзер может случайно загрузить весь свой адресник. Митигация: preview-шаг «Нашли 80 контактов, выберите кого импортировать» с чекбоксами и дефолт «ничего не выбрано».

---

## 5. Duplicate detection на создании

**Use case:** Диспетчер вбивает «Иван Петров» — в базе уже есть «Петров Иван» и «Иван П.» с тем же номером. Сейчас создаются дубли, потом объединять некому.

**Реализация:** При изменении name/phone в `CreateClientPage` и `ClientPickerSheet` — дебаунсом (300 мс) прогнать fuzzy-match по существующим (fuzzy из №1). Если score > 0.75 на имени ИЛИ последние 7 цифр телефона совпадают — показать под полем мягкий баннер «Возможно, это [Имя] · [phone]. Открыть?». Баннер — **warning, не block** (явно сказано в ТЗ). Создание остаётся доступным.

**Сложность:** M
**Supabase:** нет для prototype, при миграции — тот же алгоритм на клиенте
**Risk:** false-positives раздражают на кипрской фамильной каше (десятки Georgiou). Митигация: «похожих слишком много» (>5) — вместо списка одна строка «Возможно, уже есть — открыть поиск?».

---

## 6. Quick-create из телефона в чатах/waitlist

**Use case:** В waitlist/chats длинный тап на номер `+357 99 …` → action sheet: «Создать клиента с этим номером», «Позвонить», «Скопировать». Сейчас диспетчер вручную копирует номер → идёт в /clients → new → вставляет.

**Реализация:** Компонент `<PhoneContextMenu phone={...} onCreateClient={...}>` (long-press 550ms, 300 мс таймаут показать menu). При выборе «Создать клиента» → `router.push('/dashboard/clients?new=1&phone=...')`, либо прямо inline-шит `ClientPickerSheet` с pre-filled phone. Deep-link уже частично есть (`clients/page.tsx:45-53` читает `id` из query) — добавить `new=1&phone=X&name=Y`.

**Сложность:** S
**Supabase:** нет
**Risk:** long-press конфликтует с iOS native context-menu (копирование). Митигация: у Babun2 уже есть свой long-press handler в `AppointmentBlock` — переиспользовать паттерн + `e.preventDefault()` в touchstart.

---

## 7. QR-код карточки клиента

**Use case:** Бригада на объекте сканит QR на двери «Вы у клиента №134, склад инструментов здесь» — открывается клиентская карточка в их приложении. Или: клиент на ресепшне показывает QR из своего SMS → диспетчер сканит → открывает карточку за 2 секунды.

**Реализация:** Генерить QR с URL `https://babun.app/c/{client_id}` (компактный) через `qrcode` npm 3 kB. Редирект внутри PWA на `/dashboard/clients?id=X`. В профиле — кнопка «Показать QR» рядом с phone/SMS/chat. Обратный флоу — сканер: уже есть готовые `qr-scanner` npm, но это отдельная фича.

**Сложность:** S для генерации, M+ для сканера (камера-permission)
**Supabase:** нет, но при миграции URL должен быть auth-gated
**Risk:** privacy — QR с URL без auth = любой с фото QR зайдёт в карточку. Митигация: до Supabase Auth — QR бесполезен для внешних. После — signed short-lived токен в URL (7 дней).

---

## 8. Recent-calls hint

**Use case:** Диспетчер закрыл чат, открывает Клиенты — сверху чип «Только что звонил [+357 99 …]· создать?». Не надо даже вспоминать номер.

**Реализация:** Браузерного API для iOS call log **нет** (и не будет — privacy). Но есть proxy: `navigator.clipboard.readText()` при focus на search-input (если clipboard содержит phone-like regex `/\+?\d{7,15}/`) → показать баннер «В буфере: +357… создать?». Safari требует user gesture перед clipboard-read — так что чип показывается только после первого tap в input.

**Сложность:** S
**Supabase:** нет
**Risk:** clipboard-read требует permission в iOS Safari (показывает подтверждение один раз за session). Митигация: чип показывается только при наличии phone-regex, не читаем clipboard иначе. Никогда не читаем автоматом — только по focus.

---

## 9. Smart merge (объединение дублей)

**Use case:** База прогнана, найдены 8 пар вероятных дублей («Иван Петров» + «Petrov Ivan»). В settings → «Дубликаты (8)» → лист пар → выбираешь winner → заявки/заметки/теги мёрджатся.

**Реализация:** Batch-скрипт в `lib/clients-dedupe.ts`: fuzzy name + last-7-digits-phone → группы. UI — `/dashboard/settings/clients-dedupe`. Merge: `winner.notes = [...winner.notes, ...loser.notes]`, `appointments.where(client_id=loser).update(client_id=winner)`, `deleteClient(loser)`. Undo-toast 10 сек (см. паттерн из UX_AUDIT п.5).

**Сложность:** L (1 день — UI + merge-логика + миграция appointments.client_id)
**Supabase:** **да, зависит критически.** На localStorage merge безопасен (одна вкладка), но когда появится multi-device — нужен серверный merge с блокировкой (иначе race condition: две вкладки мёрджат разные стороны одной пары).
**Risk:** необратимый data-loss при неправильном выборе winner. Митигация: обязательный diff-preview + 10-сек undo + soft-delete loser (`deleted_at: ISO`) вместо hard, восстанавливается 30 дней.

---

## 10. Tag-based quick-filter + smart segments

**Use case:** «Покажи VIP», «должники», «новые за неделю» — один тап. Сейчас чипы VIP/B2B/постоянный есть (`clients/page.tsx:14-20`), но уже есть готовые сегменты в `lib/clients.ts:379` (`active / sleeping / lost / new / debtors / prepaid / discounted`) — они **не подключены** к `/dashboard/clients`, только к analytics.

**Реализация:** Над поиском — скролл-ряд chips: `Все | Активные | Спящие | Должники (8) | Новые · неделя | VIP`. Считать через готовый `segmentClient()`. Считать cnt в label — диспетчер сразу видит «8 должников».

**Сложность:** S (переиспользуем готовый `segmentClient`)
**Supabase:** нет
**Risk:** chip-row уже забит текущими tag-chips — перегруз. Митигация: разделить на 2 ряда (segment + tag) с визуальным delimiter, либо слить в один horizontal-scroll с иконками-лейблами.

---

## 11. Client map view

**Use case:** Сегодня 12 заявок в Лимассоле, 5 в Пафосе. Маршрутизатор открывает карту клиентов → видит скопления → группирует заявки в бригады по районам. Или: «у меня сейчас клиент в Agios Tychonas, кто ещё рядом — может сразу зайти на ТО».

**Реализация:** `/dashboard/clients/map` — Leaflet + OpenStreetMap (бесплатно, no-key). Геокодинг адресов `locations[].address` → Nominatim API (1 req/sec лимит, для 903 клиентов — 15 мин в фоне, кешим в `client.locations[].geo: {lat,lng}`). Маркеры кликабельны → открывают `/clients?id=X`.

**Сложность:** L (геокод-кеш + view + route-links)
**Supabase:** желательно (кешить geo на сервере, не гонять 903 запроса из каждого устройства)
**Risk:** Nominatim TOS запрещает коммерческий bulk-geocoding. Митигация: либо Google Maps Geocoding API ($5/1k requests — 903 клиента = ~$5 один раз), либо MapBox free tier (100k/месяц). Privacy: клиентские адреса не должны уйти на чужой сервер — проверить TOS.

---

## 12. Clipboard-detect phone на фокус search

**Use case:** Пересекается с №8, но шире: диспетчер скопировал номер из WhatsApp Web → tap в search-поле Babun → чип «Вставить +357…» над клавиатурой. Один тап — или поиск, или новый клиент.

**Реализация:** `onFocus` на search-input → `navigator.clipboard.readText()` (async, with permission). Если phone-like → показать bar над input: `[Клипборд: +357 99…]  [Искать] [+ Клиент]`. Закрыть bar по Esc / при начале печати.

**Сложность:** S
**Supabase:** нет
**Risk:** iOS Safari показывает permission-confirm один раз за сессию — первое использование неочевидно. Privacy: читаем clipboard только при focus и молчим если там не телефон (не логируем и не показываем ничего другого).

---

## Сводная таблица приоритета

| # | Идея | Сложность | Supabase-зависимость | Impact |
|---|------|-----------|---------------------|--------|
| 2 | Поиск по адресу | S | нет | высокий — уже в P0 аудита, расширение 5 строк |
| 10 | Smart segment-chips | S | нет | высокий — переиспользуем готовый `segmentClient()` |
| 6 | Quick-create из phone | S | нет | высокий — экономит 3 тапа на чат→клиент |
| 1 | Fuzzy + транслитерация | M | нет | высокий — решает кипрскую именную кашу |
| 5 | Duplicate detection | M | нет | высокий — тушит рост дублей на входе |
| 12 | Clipboard-detect | S | нет | средний — часто, но мелкая экономия |
| 3 | Voice search | S | нет | средний — грязные руки специфичны |
| 8 | Recent-calls hint | S | нет | средний — пересекается с №12 |
| 7 | QR-код клиента | S | желателен | средний — B2B/бригадная фича |
| 4 | vCard import | M | желателен для bulk | средний — один раз при онбординге |
| 9 | Smart merge | L | **критично** | высокий, но после Supabase |
| 11 | Client map | L | желателен | высокий, но тяжёлый |

**Рекомендация порядка:** 2 → 10 → 1 → 6 → 5 → 12. Первые три дают максимум value/effort, не трогают карточку клиента (которую всё равно надо унифицировать — см. UX_AUDIT #8) и не зависят от Supabase. После этого ждём STORY-001 (Supabase), затем 9 (merge) и 11 (map).
