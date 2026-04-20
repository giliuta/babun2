# Sprint 001 — QA + Data Safety Checklist

**Scope:** Before/After Photos в AppointmentSheet. Проверяем на iPhone 14 iOS 17 PWA если не указано иное. Перед ship — прогнать весь список.

---

## A. Happy path

- [ ] 1. Открыл existing appointment → tab «Фото» видно, placeholder «Нет фото» + две кнопки «Камера / Галерея».
- [ ] 2. Тап «Камера» → открылась задняя камера (не фронталка, не галерея).
- [ ] 3. Снял кадр → вернулся в sheet → thumb появился в ряду, kind по умолчанию `before`.
- [ ] 4. Тап по thumb → открылся viewer на весь экран с этим фото.
- [ ] 5. В viewer свайпом влево/вправо листаются другие фото этой записи.
- [ ] 6. Pinch-zoom в viewer работает плавно, double-tap возвращает к fit.
- [ ] 7. Long-press на thumb → контекст «Before / After / Other / Удалить» (или аналог).
- [ ] 8. Переключил kind с before на after → тег на thumb сменился, порядок пересортировался.
- [ ] 9. Добавил caption через edit → текст виден под thumb (или при tap).
- [ ] 10. Удалил фото → появился toast «Удалено · Отменить» 5 сек → Undo возвращает фото на место.
- [ ] 11. Закрыл sheet через «Сохранить» → reopen → все фото, kinds, captions на месте.
- [ ] 12. Создал новую запись → сразу добавил 2 фото «до» + 1 «после» → сохранил → фото persist.

## B. Edge cases

- [ ] 13. 0 фото — empty state читается, кнопки активны, нет layout-shift.
- [ ] 14. 1 фото — ряд thumb не растягивается на всю ширину некрасиво.
- [ ] 15. 5 фото — ровно на границе лимита (20/appointment по BRIEF — уточнить реальный лимит UI).
- [ ] 16. Попытка 6-го (или N+1-го) — блок или warning? Проверить что есть явное сообщение «Лимит X фото».
- [ ] 17. 12 MP фото с iPhone Pro (≈4 MB raw) — compression до ~100 KB JPEG 0.6 не падает, UI не замораживается >1 сек.
- [ ] 18. Очень маленькое фото (например screenshot 200×200) — нет артефактов пережатия, не размывается.
- [ ] 19. Caption 100+ символов — усечение в thumb-overlay, полный текст в viewer/edit.
- [ ] 20. Пустой caption — не рендерится пустой span, не ломает layout.
- [ ] 21. Одинаковый caption на двух фото — оба отдельно видны, id-keys корректные (нет React warning в console).
- [ ] 22. Фото с EXIF-ориентацией (снято боком) — отображается правильно, не лежит на боку.
- [ ] 23. Фото-panorama (очень широкое) — в thumb cover, в viewer contain.

## C. Gesture conflicts

- [ ] 24. Long-press на thumb в iOS Safari — наш custom menu работает, системное «Save image / Copy» НЕ вылазит сверху.
- [ ] 25. Свайп влево/вправо в viewer — не триггерит iOS back-swipe (edge-swipe от левого края).
- [ ] 26. Горизонтальный scroll thumb-ряда — не блокирует вертикальный scroll sheet'а.
- [ ] 27. Pinch в viewer — не конфликтует с pinch на календаре (viewer должен blocking).
- [ ] 28. Двойной tap на thumb — не триггерит ни double-tap-zoom страницы, ни случайно картинку два раза.
- [ ] 29. Tap на backdrop viewer'а — закрывает viewer, НЕ закрывает sheet.

## D. Data safety (data-loss-guardian)

- [ ] 30. Добавил фото → тап «Отмена» / backdrop sheet'а без «Сохранить» → появляется confirm «Есть несохранённые изменения»? Фото либо сохраняются либо явно отбрасываются (user-choice, не тихо).
- [ ] 31. Редактировал caption → tap backdrop в edit-модалке → confirm «Отменить изменения?» или автосохранение, но не тихая потеря.
- [ ] 32. Удалил фото → Undo toast виден минимум 5 сек → повторный тап «Удалить» на другом фото НЕ гасит старый toast мгновенно (или чейнит несколько undo).
- [ ] 33. Два быстрых тапа по «+ фото» (двойной клик) — picker открывается только один раз (debounce/guard).
- [ ] 34. Перезагрузил страницу во время compression (ещё base64 не записан) — фото либо в localStorage либо его нет, не partial/corrupted base64.
- [ ] 35. Закрыл браузер между «снял» и «сохранил sheet» — при следующем open состояние предсказуемо (или draft, или пусто, но без фантомных thumb).
- [ ] 36. Удалил appointment целиком — связанные photos тоже удалены из localStorage (нет orphan-записей).

## E. Storage

- [ ] 37. Приблизился к localStorage quota (~5-10 MB) — graceful error «Хранилище заполнено», не silent fail.
- [ ] 38. При quota exceeded — UI показывает какие appointments жирные, предлагает удалить старые фото (nice-to-have, минимум — error message).
- [ ] 39. DevTools → Application → Local Storage — base64 строки под ожидаемым ключом, не раскиданы по 10 ключам.
- [ ] 40. Очистка старых фото: через год appointment'ов фото с закрытых записей старше N дней авто-удаляются? Или это on-demand? Зафиксировать поведение.
- [ ] 41. Экспорт/backup: есть ли способ выгрузить все фото на desktop (JSON с base64 / zip)? Если нет — задокументировать как known gap.

## F. iOS-specific

- [ ] 42. PWA home-screen icon → open → tap «Камера» → открывается реальная камера (НЕ галерея, НЕ «Файлы»).
- [ ] 43. iPad PWA — camera работает (известно что iPadOS иногда блокирует `capture` в standalone mode — проверить).
- [ ] 44. iOS share-sheet из viewer: есть ли кнопка «Поделиться» → можно сохранить в Photos / отправить в WhatsApp.
- [ ] 45. Offline (airplane mode): снял фото → виден thumb → закрыл sheet → открыл → фото на месте (localStorage не требует сети).
- [ ] 46. Offline → online: ничего не падает, нет попыток upload в облако (OUT-of-scope по BRIEF).
- [ ] 47. `capture="environment"` (задняя) vs `capture="user"` (селфи) — проверить что для «Камера» используется environment; если нужна селфи-кнопка — отдельная.
- [ ] 48. iOS dark mode — thumb-ряд, viewer backdrop, captions читаемы.

## G. Regression check

- [ ] 49. AppointmentSheet всё ещё открывается из календаря tap'ом на слот.
- [ ] 50. Close-confirm при несохранённых изменениях (не связанных с фото) по-прежнему работает.
- [ ] 51. IncomeBlock / FinanceSheet — суммы, платежи не поломаны.
- [ ] 52. TeamPicker, ClientPicker, ServicePicker — открываются, выбор сохраняется.
- [ ] 53. DateWheelModal — scroll wheel не зажёван новыми touch-handler'ами.
- [ ] 54. Save appointment — сохраняет photos в localStorage под правильным appointment.id (проверить через DevTools).
- [ ] 55. Reload после save — photos загружаются обратно в правильный appointment.
- [ ] 56. Swipeable calendar 2-finger pinch — НЕ сломан (см. Critical Known Issues в CLAUDE.md).
- [ ] 57. ServiceWorker: после bump `CACHE_VERSION` и `BUILD_TAG` — пользователь видит новую версию без manual hard-reload.

## H. Browser / device matrix

- [ ] 58. iPhone 14, iOS 17, Safari PWA — полный happy path (A).
- [ ] 59. iPhone SE (маленький экран 375×667) — thumb-ряд и viewer не ломают layout.
- [ ] 60. Android Chrome — `capture="environment"` открывает камеру, fallback на галерею работает.
- [ ] 61. Desktop Safari / Chrome — file input открывает file picker, viewer работает с мышкой (не обязателен для MVP, но не должен крашиться).
- [ ] 62. Landscape на iPhone — viewer адаптируется (nice-to-have, не блокер).

---

**Критерии ship:**
- Все пункты A, D, F, G обязательны (happy path + data safety + iOS + regression).
- B, C, E — минимум 80% пройдено, остальное задокументировано как known issue.
- H — минимум iPhone 14 iOS 17 happy path + Android Chrome не падает.

**Если что-то красное в D (data safety) — не шипим.**
