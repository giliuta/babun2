# Sprint 001 — Before / After Photos

## Цель
Дать бригаде одной рукой добавлять фото до/после работы прямо из формы записи, видеть их в галерее и использовать как доказательство + маркетинг-материал.

## Кому и зачем
- **Бригадир на объекте** → фото «до», далее работает, фото «после», клиент доволен. Защита от претензий «не почистили».
- **Диспетчер / владелец** → видит в записи что реально было сделано, может переслать клиенту.
- **Клиент** → получает визуальное подтверждение (через share-link в будущем sprint'е).

## Scope
- **IN:** Галерея фото в AppointmentSheet, категория before/after/other, подписи, удаление с undo, offline-первый (localStorage как base64 — MVP без Supabase storage).
- **OUT:** Загрузка в облако, пережатие на сервере, OCR, share-link клиенту (отдельный sprint).

## Зависимости
- `lib/appointments.ts` уже имеет `photos: AppointmentPhoto[]` (id, data_url base64, caption, uploaded_at). Добавляем поле `kind: "before" | "after" | "other"`.
- Компонент `PhotoBlock` в `components/appointment/` — на замену placeholder'у «Фото · скоро» в AppointmentSheet.
- `file input` с `capture="environment"` для мгновенного открытия задней камеры iPhone.

## Риски
- **localStorage size** — base64 быстро забивает 5-10 MB лимит. Митигация: client-side compression через `canvas.toDataURL("image/jpeg", 0.6)` до ~100 KB на фото. Кэшируем только последние 20 за appointment.
- **iOS Safari quirks** — `capture` может открыть галерею а не камеру на старых iOS. Митигация: рядом две кнопки «Камера» и «Галерея», не одна.
- **Offline** — если снимаешь без сети, должно всё равно сохраниться. `localStorage` это даёт из коробки.

## Оценка
M — 1 день на код + 0.5 дня на QA mobile.
