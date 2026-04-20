# Chief of Staff — критический разбор идей

**Дата:** 2026-04-20
**5 агентов сгенерили 63 идеи.** Прочитал каждую, оценил честно. Метка **GO** = стоит делать, **MAYBE** = требует уточнения, **SKIP** = вред или shelf-ware. Обоснование у каждой — почему именно так.

Принцип: "красиво на бумаге" ≠ "ship на iPhone". Моя задача — срезать половину чтобы CEO не тонул в шуме.

---

## 📐 Design language (14 идей)

| # | Идея | Моя метка | Обоснование |
|---|------|-----------|-------------|
| 1 | PressableButton (scale + haptic) | **GO** | Дешёвый pro-signal, закрывает неравномерный feedback. **Bundles с идеей #7 fast-booking haptic.** |
| 2 | Long-press ripple на сетке | MAYBE | Визуально круто, но `@keyframes pressRipple` на weak iPhone = jank на драге. Если делать — после Phase 2 touch-drag |
| 3 | Typography hierarchy для денег | **GO** | Самый дешёвый визуальный апгрейд. 2-3 часа работы, эффект везде. **Первая в очереди.** |
| 4 | EmptyState component | **GO** | Реально уродливое «Пусто» в 4+ местах. Одна обёртка = всё закрыто |
| 5 | Skeleton cross-fade | SKIP | Перфекционизм. Blank-to-content достаточно — никто не жалуется. Риск med (hydration в Next 16), выгода low |
| 6 | Logo mark upgrade | MAYBE | «Курсив minus-2° + тонкая \|» — рискует выглядеть tacky. Лучше проще: просто ExtraBold + чище круг. **Оставим CEO-решение** когда будет брендинг sprint |
| 7 | lucide-react миграция | **GO** | L-сложность, но критично системный. Emoji vs SVG microscopic-inconsistency чувствуется как «любительский проект». **Бандим отдельным sprint'ом.** |
| 8 | Card shadow+ring вместо border | **GO** | Под солнцем border-slate-200 исчезает — это факт из UX audit. Ring+shadow-xs = классика. Low risk, med impact |
| 9 | Auto-dark mode | **SKIP** | Пользователь на скутере в +35°C днём, dark-mode irrelevant. L-сложность, high risk (ломает календарь). Не AirFix priority, потенциально для будущего SaaS-b2c |
| 10 | Live build-version + pulse dot | MAYBE | Cute pro-signal, но `BUILD_VERSION` chip уже был и я его **убрал** (P2 audit — перекрывал AppointmentBlock). Возвращать только в Sidebar, не в Calendar |
| 11 | Number morph (FLIP на суммах) | **GO** | `AnimatedNumber.tsx` уже есть — просто grep и apply. Pro-signal который каждый день радует |
| 12 | First-run coach marks | SKIP | Onboarding для 1 юзера (Дима) — overkill. Переоткроем когда будет SaaS с внешними клиентами |
| 13 | Spring drag на календаре | MAYBE | Мили-секундная «радость» — но drag-drop пока отключён touch-wise (P1 audit). Смысл только после Phase 2 |
| 14 | Unified client status-dot | **GO** | Один 6px цветной dot перед именем — сканируется за 200мс. Переиспользует уже готовый `segmentClient()`. S-сложность |

**Дизайн-bundle для отдельного sprint'а:**
- #3 typography + #4 empty state + #8 card style + #11 number morph + #14 status dot + #1 PressableButton
- **Всё S-сложности, все low-risk.** ~1 день суммарно, визуально апгрейд приложения на порядок.

---

## ⚡ Fast booking (15 идей)

| # | Идея | Моя метка | Обоснование |
|---|------|-----------|-------------|
| 1 | Recent clients chip-row | **GO** | Эffort 2, reward 9 (самый честный ROI в списке). `recentClientIds` уже есть в props |
| 2 | Predictive defaults | **GO** | 27x ROI. Город + бригада уже в context — грех не подставить |
| 3 | Swipe-to-create | **SKIP** | High risk случайных записей. Undo есть, но жест-конфликт с SwipeableCalendar навигацией недель = глюки. Не стоит 13x ROI |
| 4 | Smart client ranking в picker | **GO** | Сортировка по (city+team+recency) score. Решает «903 клиента каждый раз». Low risk — поиск остаётся fallback |
| 5 | Quick templates | MAYBE | Feature creep. У AirFix 2 бригады × 4 услуги = 8 шаблонов max — оправданный set? Спорно. Phase 2 после analytics |
| 6 | Duplicate appointment long-press | **GO** | Long-press уже работает на AppointmentBlock, просто добавить пункт меню. Для HVAC recurring (Sprint 003) это buildup block |
| 7 | Instant save + toast undo | **SKIP** | Риск «не знаю сохранилось ли» + risk двойной записи. Текущий close-confirm лучше |
| 8 | Smart time snap | **GO** | Чистая математика, 5 строк. В P0 audit про создание на :00 вместо :30 |
| 9 | Phone autocomplete | MAYBE | iOS Safari не даёт contacts API. Без неё ~half ROI. Clipboard-detect (idea №12 client-flow) лучше |
| 10 | Double-booking warning | **GO** | Реальная боль в HVAC — 2 бригады легко налетают. S-сложность, low risk. `findOverlappingAppointments` = 10 строк |
| 11 | Copy from yesterday | MAYBE | Bulk dub'ов много не бывает в HVAC (не салон красоты) — разные клиенты каждый день. Низкий use-case |
| 12 | Bulk creation mode | **SKIP** | L-сложность, низкий reward для 2 бригад. Для salon chains — да, не для AirFix |
| 13 | Haptic + sound confirm | MAYBE | Haptic — GO бесплатно, sound — нет (мешает клиенту в машине). Объединить с #1 design language |
| 14 | Slot preview on touch-hold | MAYBE | Круто, но конфликт со скроллом. Сложно починить. После Phase 2 |
| 15 | Keyboard-first quick-entry | SKIP | Для офисного диспетчера — может быть. Но Дима на скутере — нет. Bumpix-like feature |

**Fast-booking bundle:** #2 + #4 + #1 + #10 + #8 + #6. Все S, одним sprint'ом = создание за 5-8 сек вместо 20.

---

## 👥 Client flow (12 идей)

| # | Идея | Моя метка | Обоснование |
|---|------|-----------|-------------|
| 1 | Fuzzy search + transliteration | **GO** | Кипрская именная каша — реальная боль (Aseel/אור/Иван). 20-30мс на 903 — OK. Экономит 30% поисков |
| 2 | Поиск по адресу | **GO** | Уже в P0 UX audit. 5-строчная правка фильтра. **ставим первой.** |
| 3 | Voice search | **SKIP** | Точность webkit-speech на турецких/греческих именах = 50%. Fuzzy (#1) покрывает use-case без privacy-риска |
| 4 | vCard import | MAYBE | Одноразовое onboarding — не нужно если 903 клиента уже в базе. Перенесём когда появится 2-й клиент (другой бизнес на SaaS) |
| 5 | Duplicate detection | **GO** | Предотвращает дубли в источнике. Warning-only, не block. M-сложность оправдана |
| 6 | Quick-create из phone в чатах/waitlist | **GO** | Long-press на номер → «создать клиента» — реально часто. S-сложность, reuse existing deep-link |
| 7 | QR-код клиента | SKIP | До Supabase Auth — дыра в приватности (любой с фото QR зайдёт). После Supabase — может быть |
| 8 | Recent-calls hint | SKIP | iOS не даёт call log. Clipboard-proxy (#12) = то же самое, проще |
| 9 | Smart merge дублей | **MAYBE-blocker** | Критически нужен когда накопятся дубли — но Supabase-first для multi-device. В post-migration |
| 10 | Smart segments chips | **GO** | `segmentClient()` уже написана в `lib/clients.ts:379` — просто подключить к UI. 15 мин работы = огромный value |
| 11 | Client map view | MAYBE | L-сложность + geocoding TOS риски. Для route-optimization полезно, но подождём. Lots of HVAC orgs это хотят — хорошо для SaaS |
| 12 | Clipboard-detect phone | **GO** | Лучше voice и recent-calls. Safari permission — приемлемо. S-сложность, reuse |

**Client-bundle:** #2 (P0!) + #10 + #6 + #12 + #1 + #5.

---

## 💰 Money ergonomics (15 идей)

⚠️ **ОБЯЗАТЕЛЬНЫЙ prerequisite:** `lib/finance/compute.ts` — единый источник расчёта прибыли. Finances vs Reports расходятся (audit P0 #11). **Любая money-идея должна лететь только после этого.**

| # | Идея | Моя метка | Обоснование |
|---|------|-----------|-------------|
| **P0** | **Unify profit calc** | **GO-blocker** | Без этого остальные деньги-фичи вредны |
| 1 | Inline calculator | MAYBE | Кайф для power-user, но parsing свободного текста = error surface. Лучше кнопки +10%/±€5 |
| 2 | Split payment presets | **GO** | 3-4 конфигурации, очень облегчает Payment UX. S-сложность |
| 3 | Round-up to clean | **GO** | На скутере калькулятор лишний. Одним тапом €47.30→€50, скидка €2.70 — бригаде легко |
| 4 | Monthly target widget | MAYBE | Хорошо после P0 unify. Цель per-brigade сложнее per-business |
| 5 | VAT 19% toggle | **GO-delayed** | Cyprus B2B требует VAT. HIGH risk — нужны unit tests. После Supabase migration. PDF invoice (Sprint 004) зависит от этого |
| 6 | Expense quick-add со свайпом | **SKIP** | Swipe-down на календаре = случайные расходы. Risk не стоит reward. Лучше FAB (home-experience #3) |
| 7 | Brigade salary preview в AppointmentSheet | **GO** | Прозрачность бригаде = retention. S-сложность после #P0. Must reuse payroll func |
| 8 | Commission / daily-norm alert | MAYBE | Нужно только при росте 3-5+ бригад. Для 2 — излишне |
| 9 | Profit-per-visit тег | MAYBE | Сложно honest-определить (overhead allocation политика). Write `docs/finance-model.md` сначала |
| 10 | Currency picker € / ₺ / $ | SKIP | AirFix = EUR only. Излишне сейчас. Для SaaS Turkey — может быть |
| 11 | Receipt QR после payment | **MAYBE-Sprint004** | Это часть Sprint 004 PDF-invoice — уже в очереди |
| 12 | Cashbox reconciliation с «факт в кассе» | **GO** | Убрал placeholder в Phase 1 — это обещание. Теперь сдержать: реальное поле + trend shortages. HIGH owner trust |
| 13 | Debt tracking | **GO-post-Supabase** | Должник badge — важно для HVAC (иногда недоплачивают за А/С). Но требует partial-payments в модели |
| 14 | Weekly digest | MAYBE | Хорошо после P0. Email — post-Supabase. In-app — можно |
| 15 | «Сегодня заработали» 3-сек glance | **GO** | Owner's daily ritual. Reuse `computeProfit({today})`. S после P0 |

**Money-bundle post P0:** #15 + #3 + #2 + #12 + #7.

---

## 🏠 Home experience (10 идей)

| # | Идея | Моя метка | Обоснование |
|---|------|-----------|-------------|
| 1 | Sticky «Сейчас» pill | **GO** | 28px band = минимально. «Через 18 мин → Иванов 14:00» — это суперпрагматично |
| 2 | Day summary strip | **GO** | «6 записей · €450 · 1 без оплаты» — диспетчер видит статус утром за 2 сек |
| 3 | FAB `+` с bottom-sheet | **GO** | Из UX_AUDIT P0 #13. Главный write-path. **Но bottom-sheet противоречит правилу «все попапы по центру»!** → Надо решить: FAB тапает → центральный popup с 4 пунктами (не bottom-sheet) |
| 4 | Auto-scroll to now-line | **GO** | Zero risk, 0 cost. Просто `scrollIntoView({ block: "center" })` на mount |
| 5 | Unread chats count | **GO** | `unreadChats` уже computed. Заменить dot на число — 3 строки |
| 6 | End-of-day red-flag banner | **GO** | После 19:00 показать completed-без-payment. Классический «забыли закрыть». HVAC-relevant |
| 7 | Morning briefing | **MAYBE** | Coach-mark-ish. 1 раз в день может работать, но легко raздражать. Прототип A/B |
| 8 | Upcoming-gap hints | **GO** | Штриховка пустых слотов ≥60мин — «куда впихнуть срочного». Реально полезно диспетчеру |
| 9 | Brigade status rail | SKIP | Требует `Team.status` field + GPS integration. L-cложность, пока без Supabase не работает |
| 10 | Weather-aware chip | SKIP | Weather API $$ + HVAC-specific over-engineering. Cute, но не сейчас |

**Home-bundle:** #4 + #5 + #2 + #1 + #3 (adjusted) + #6 + #8.

---

## 📋 Сводная рекомендация — Sprint-очередь

Твоя уже утверждённая очередь:
- **Sprint 002:** Share-link (S)
- **Sprint 003:** Recurring cleanings (M)
- **Sprint 004:** PDF-invoice (M)

**Я предлагаю добавить 3 bundle-sprint'а из идей выше:**

### Sprint 005 — Design polish (S-bundle, 1 день)
Собраны low-risk high-value: #3 typography · #4 empty state · #8 card style · #11 number morph · #14 status dot · #1 PressableButton · #5 unread count · #4 auto-scroll home. Нулевой риск, максимум pro-signal.

### Sprint 006 — Fast booking v1 (S-bundle, 1-2 дня)
#2 predictive defaults · #4 smart client ranking · #1 recent clients chips · #10 double-booking · #8 time snap · #6 duplicate long-press. Создание записи 20 сек → 8 сек.

### Sprint 007 — Finance unification (M, 2 дня)
**P0:** `lib/finance/compute.ts` — единый источник прибыли. Потом сверху: #15 today-glance · #3 round-up · #2 split presets · #12 cashbox fact input · #7 brigade salary preview.

### Sprint 008 — Client ergonomics (S+M, 2 дня)
#2 address search (P0 audit) · #10 smart segments · #6 quick-create · #12 clipboard-detect · #1 fuzzy/transliteration · #5 duplicate detect.

### Sprint 009 — Home experience v1 (M, 2 дня)
#4+#5+#1+#2+#6+#8+#3(adjusted). Sticky pills, summary strips, end-of-day banners, gap hints, FAB для всего.

### Sprint 010 — Lucide migration (L, 2 дня)
Весь icon system на lucide-react. Отдельный sprint потому что механический и трогает много файлов.

---

## ⛔ Идеи которые я отклонил (чтобы не забыли почему)

- **Dark mode** — Дима на скутере днём не нужен, L-сложность
- **Voice search** — точность низкая для кипрских имён, fuzzy лучше
- **Swipe-to-create** — risk случайных записей > reward
- **Bulk creation** — HVAC нет массовых повторов как в салоне
- **Instant save** — риск double-save, пользователи боятся «не знаю сохранилось»
- **Coach marks onboarding** — 1 юзер не окупает
- **QR код клиента** — до Supabase Auth дыра
- **Brigade GPS rail** — требует fleet-tracking infrastructure
- **Weather chip** — $$API для cute-feature

---

## 🎯 Твоё решение, CEO

**Вариант A — по моей очереди:**
- Sprint 002-004 (share-link, recurring, PDF) уже утверждены
- После этого по порядку 005 → 009 (design, fast-booking, finance, clients, home)

**Вариант B — по твоему приоритету:**
- Какие bundle-sprint'ы важнее? Переставь порядок

**Вариант C — точечные GO:**
- Вместо bundle'ов — закажи конкретные идеи номерами. Например «делай только #1 recent chips + #15 today glance + #4 auto-scroll»

**Вариант D — делаем только одобренные CEO:**
- Пройдись по каждой GO выше — подтверди 👍 или зачеркни ❌

Скажи — и стартую после завершения Sprint 004.
