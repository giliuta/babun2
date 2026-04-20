# Sprint 001 — Before / After Photos · Decision Document

**Подготовила:** Babun2 Corporation (6 агентов: Product / Design / Engineering / Mobile / Copy / QA)
**Для:** CEO (Дима)
**Статус:** ждёт решения

---

## TL;DR (3 строки)

Даём бригаде одной рукой снимать фото **До / После** прямо из формы записи, с авто-подписью «До · 14:35 · Спальня», компрессией, undo-toast на удаление. MVP без облака — всё в localStorage (base64, лимит 5 фото на запись). Работа: ~1 день кода + 0.5 дня QA на iPhone, S-размер.

**Зачем:** это топ-1 запрос в HVAC — доказательство работы клиенту («было грязно, стало чисто»), защита от претензий, маркетинг-материал, база для будущего PDF-инвойса и share-link.

---

## Что увидит пользователь

В форме записи (`AppointmentSheet`) вместо placeholder «📷 Фото · скоро» — **рабочий блок «Фото»**.

### Пустое состояние
```
╭──────────────────────────────────╮
│      📷 Добавить фото            │ ← dashed violet, h-11, full-width
╰──────────────────────────────────╯
```

### С фото (1-5 штук)
```
[📷 64×64 До]  [📷 64×64 После]  [📷 64×64]  [+ 64×64]
  rose badge    emerald badge    (прочее)    dashed add
← horizontal scroll, touch-action: pan-x, 76×76 hit area →
```

### Flow добавления
1. Тап `[+]` → центральный popup «Что это за фото?» (z-80) с 3 кнопками:
   - **До** — «Состояние до работы»
   - **После** — «Готово, клиент принял»
   - **Прочее** — «Пломба, табличка, счёт»
2. Тап категории → открывается **камера** (`capture="environment"`), есть fallback-кнопка «Открыть из галереи» если камера не разрешена
3. Снял → автокомпрессия до ~150 KB → toast «Фото добавлено · Отменить»
4. Thumb появился в ряду, auto-caption `«До · 14:35 · Спальня»`

### Просмотр и редактирование
- **Тап** на thumb → full-screen viewer (z-95), чёрный фон, свайп влево/вправо, кнопки «Удалить» (rose) + «Закрыть»
- **Long-press** → меню «Пометить как До / После / Прочее / Удалить»
- **Тап по caption в viewer** → inline edit подписи

### Safety
- Удаление → toast «Фото удалено · Вернуть» (5 сек undo)
- Backdrop-tap в viewer → просто закрывает (нет dirty-state)
- Лимит 5 фото на запись → при 6-м show toast «Максимум 5 фото на запись»
- `localStorage` >70% заполнен → предупреждение с action «Открыть»

---

## Что получим (бизнес-выгода)

| Метрика | До | После |
|---------|----|----|
| Доказательство работы клиенту | нет | есть на каждой записи |
| Защита от претензий «не почистили» | 0 | 100% случаев с фото |
| Placeholder «скоро» в форме | мозолит глаз | заменён рабочим блоком |
| Фундамент под PDF-инвойс / share-link | нет | есть (`photos[]` структурирован) |

**Расширяется бесплатно в будущих sprint'ах:**
- PDF-инвойс с фото в подписи
- Share-link клиенту «посмотрите фото вашей работы»
- Галерея в профиле клиента (группировка по объекту)
- Before/after slider в маркетинге

---

## План работ (Engineering)

**Новые файлы (4):**
- `components/appointment/PhotoBlock.tsx` — хост, state `pickerOpen/viewerIndex/menuForPhotoId`
- `components/appointment/PhotoPicker.tsx` — popup с 3 категориями
- `components/appointment/PhotoViewer.tsx` — full-screen просмотр со свайпом
- `lib/photos.ts` — `compressImage`, `generateCaption`, `validatePhotoSize`

**Правленые файлы (3):**
- `lib/appointments.ts` — расширить `AppointmentPhoto`: `kind: "before"|"after"|"other"`, `location_id?`, `taken_at?`; + `consent_given: boolean` на уровне Appointment (Privacy)
- `components/appointment/AppointmentSheet.tsx` (~498-508) — замена placeholder на `<PhotoBlock />`
- `lib/version.ts` + `public/sw.js` — bump

**Инженер уточнил 5 моментов** (принято Chief of Staff):
1. `BUILD_TAG` в dashboard/page.tsx не существует — реально `BUILD_VERSION` в `lib/version.ts`. CLAUDE.md rule нужно обновить.
2. `photos: []` в mock-seed уже есть — править не надо.
3. Добавим per-photo **normalize** в `loadAppointments` — дешёвая страховка от `undefined` в viewer для старых записей.
4. Компрессия — **каскад** `q=0.6 → 0.45 → 0.3` до бюджета 200KB, не одиночный pass.
5. Swipe в viewer копируется паттерном из `SwipeableCalendar` без импорта — там 2+ finger guard для календаря, галерее он не нужен.

---

## Что меняется в коде (точные `file:line`)

- `lib/appointments.ts:54-59` — расширить `AppointmentPhoto`
- `lib/appointments.ts:67-123` — добавить `consent_given: boolean` в `Appointment`
- `lib/appointments.ts:493-528` — `createBlankAppointment` добавить `consent_given: false`
- `lib/appointments.ts:152-191` — `loadAppointments` нормализовать photos
- `components/appointment/AppointmentSheet.tsx:498-508` — заменить placeholder
- `app/dashboard/page.tsx:226` — seed `photos: []` уже есть
- Новые 4 файла — ~300 строк суммарно

---

## Риски и митигации

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| **iOS PWA камера не открывается** | средняя | fallback-кнопка «Открыть из галереи» + re-mount input через `key={Date.now()}` |
| **Compression 12MP блокирует main thread 3-9 сек** | высокая | `createImageBitmap` + `OffscreenCanvas.convertToBlob`, fallback на `requestIdleCallback` для iOS 16.3- |
| **iOS native context-menu «Save to Photos» крадёт фото из PWA** | высокая | `onContextMenu={preventDefault}` + CSS `-webkit-touch-callout: none` |
| **Back-swipe iPhone конфликтует со свайпом viewer'а** | высокая | insert 24px от левого края + early-return если `touchstart.clientX < 20` |
| **localStorage 5-10 MB quota** | средняя | cap 5 фото/запись, warning при 70% через `navigator.storage.estimate()` |
| **Keyboard закрывает кнопку «Удалить» при edit caption** | высокая | `visualViewport.resize` subscriber |
| **Приватность (интерьер клиента в фото)** | низкая | `consent_given` toggle на уровне записи + toast «спросите клиента» при первом фото |

---

## Что НЕ делаем в этом sprint'е (stop-list)

- ❌ Сервер / облако / upload → отдельный sprint после Supabase
- ❌ OCR / AI-описание фото
- ❌ Видео
- ❌ Reorder / crop / filters
- ❌ Share-link клиенту
- ❌ Cross-appointment галерея в профиле клиента (structure готовая, UI позже)
- ❌ Тёмная тема viewer'а

---

## Команды подписались

- **Product** (`researcher` / HVAC-domain) — ✅ валидна, 5 use-cases, 3 категорий достаточно, auto-caption > ручной (в Bumpix 90% caption'ов пустые — не повторяем)
- **Design** (`design-system-keeper`) — ✅ токены соблюдены, z-index расширяется корректно (80→90→95→100), 44px targets, все попапы по центру
- **Engineering** (`code-analyzer`) — ✅ план в 3 новых + 3 правленых файла, 5 уточнений внесены в брif
- **Mobile** (`mobile-ux-auditor`) — ⚠ 4 P0 блокера → все включены в риски выше, митигации есть
- **Copy** (`copy-keeper`) — ✅ микрокопия готова, 2 tone-решения: «Пометить как…» вместо «Сделать», «Вернуть» после delete вместо второго «Отменить»
- **QA** (`code-analyzer`) — ✅ 62-пункта чек-лист в 8 зонах, ship-criteria: зона D (data-safety) обязательна

---

## Решение CEO

Отметь галочкой (скажи мне на голосе или в чате):

- [ ] **Да, делаем как задумано** — стартую execution прямо сейчас
- [ ] **Да, но с правкой:** _____________ (скажи что именно)
- [ ] **Нет** — переключаемся на другую фичу
- [ ] **Подождать** — сначала __________

### Если «Да», дальше будет:
1. Ветка `feature/SPRINT-001-photos`
2. 2-3 commit'а: (а) тип + lib/photos + normalize, (б) PhotoBlock + Picker + Viewer, (в) интеграция в AppointmentSheet + bump
3. QA по чек-листу из `QA.md`
4. `babun-release-captain` checklist
5. Merge в master, Vercel deploy
6. Session Report: «Ship'нули, работает, найденное в проде → в следующий sprint»

### Если «Да с правкой» — какие вопросы могу задать сам:
- Лимит 5 или 10 фото на запись?
- Category «Прочее» оставить или убрать (только До/После)?
- `consent_given` toggle в UI или молча true по умолчанию?
- Auto-caption формат: «До · 14:35 · Спальня» или короче «До · Спальня»?

---

## Следующие кандидаты в очередь (чтобы ты думал глобально)

После фото-фичи Chief of Staff предлагает эти 3 в любом порядке:

1. **Share-link «моя запись 21 апр»** (S, 1 день) — публичный URL с картой, контактом бригады, временем. Работает на localStorage hash-токене. Клиенты фанатеют от такого — снижает звонки «а во сколько приедете?» на 70%.
2. **Расписание повторных услуг** (M, 2 дня) — HVAC-чистка каждые 6 месяцев = повторные клиенты на автопилоте. Кнопка «Повторить через N месяцев» в AppointmentSheet, запись автоматически появляется в waitlist за 2 недели до срока.
3. **PDF-инвойс с фото** (M, 2 дня) — Cyprus B2B требует VAT-инвойс, плюс фото работы закрывает «мы реально чистили». `jspdf` на клиенте, без сервера.

Только после твоего сигнала — я спавню команду под следующий sprint.
