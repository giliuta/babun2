# Babun CRM — UX Psychology Audit (iPhone 390×844, prod walkthrough)

**Persona:** Dima. Scooter, +35°C, helmet on, one thumb. Needs: "who's next, where, how much did I bank today." Frequency: 50–100 opens/day. Tolerance for fluff: zero.

---

## 1. First impressions per screen

**[01-dashboard-week.png] — Dashboard / today.** Dima opens the app. He sees purple header "Апрель 2026", two skinny tabs Y&D / D&K he didn't ask for, one blue "ПАФОС ПН 20" bar, and a wall of pale-blue empty slots from 09:00 to 17:00. Inner voice: "OK, где сегодня? Где следующий визит?" There is no answer on the screen. An empty day that looks identical to "loading" looks broken, not restful. Worse — the header says "Апрель 2026" but offers no anchor for **today**; the only time-reference is the small `ПН 20` inside the column header. The eye looks for "Сегодня 09:00 — следующий: X" and finds nothing.

**[02-create-menu.png] — FAB menu.** Clean, well-ranked modal. "Запись / Расход / Событие / Лид из чата" is good information architecture. But "Лид из чата" is the 4th item even though it's rare, and its sub-copy "перенести обращение в запись" reads like a TODO note. Tap targets are big (good for gloves). One complaint: no visual emphasis on the primary action (Запись) — all four rows weigh the same.

**[03-create-appt.png] — After tapping "Запись".** Identical to [01]. Confirmed the bug — URL changed, sheet never rendered. From Dima's POV: "я уже нажал, почему ничего не произошло?" He will tap again, double-book, then panic. **This is the P0 bug of the whole audit.**

**[04-city-picker.png] — City picker as bottom sheet.** Violates the "all popups centered" rule in `CLAUDE.md`/memory. Content is fine ("Куда едет бригада?" is a great, human header), but a bottom sheet on a calendar screen looks like the calendar is disappearing, not that a picker opened. Also — why ask "куда едет бригада" on tapping a day header? That pattern is non-obvious.

**[05-clients.png / 05b-clients-full.png] — Clients list.** Clear, scannable, avatars color-coded. Filter chips (VIP/B2B/Постоянный/Новый/Проблем...) overflow the viewport — the last chip is cut in half, signaling "scroll" but adding noise. Phone-handle icon green. "Недавние" sort pill top-right is small relative to its importance. Header count "(12)" is honest; will feel dishonest at 903.

**[06-client-profile.png] — Client profile.** Reads like a CRM template, not a scooter tool. Tabs: Профиль / Записи(0) / История(0) / Центр напоминаний — four tabs, three of them empty on this mock. The "+Добавить номер" card, empty Telegram/Instagram placeholders, Чёрный список toggle — all visually loud for a card Dima opens to **dial or message**. Call/WhatsApp icons are there but swallowed by form chrome.

**[07-chats.png] — Chats.** Best screen in the app. Status badges (🔥2ч, ⌛, "Без ответа") carry real urgency. Channels color-coded. "Вы:" prefix works. Only nit: no "today's unread at top" grouping — Maria K. at "5ч" and Козлов "вчера" look equally urgent to a tired eye.

**[08-finances.png] — Finances.** Four top cards (Доход / Расход / Прибыль / Долги), then a big "ИТОГО" block, then "СЧЁТ ЗАПИСЕЙ", then "СВЕРКА КАССЫ". Rich, but for a scooter open, it's a wall of numbers. The €3550 / €0 / +€3550 triad is clean. The "Долги €0" card reads like an error — no context on what "долги" means on this screen. "Зарплата · €1065" pill is underweighted given it's actionable. 100% margin looks like a bug to any human (see section 2).

**[09-reports.png] — Reports.** Good. VAT card is a star — "VAT · 19% (ВКЛЮЧЁН) Нетто €2983 · €567 к уплате". This is the one screen that tells a real CFO story. Day-by-day table below is clean. Tab for each brigade is correct.

**[10-expenses.png] — Расходы.** Empty state reads fine but doesn't suggest what to add ("залил бензин? купил провода?"). "+" top-right is the only path.

**[11-payroll.png] — Зарплата.** Clear. Предварительный расчёт ("Юра 10%, Даня 7%") communicates the finance-brigade model well. "Закрыть неделю и создать период" is a scary button — what does "создать период" mean to a dispatcher? Language is accountant-speak.

**[12-recurring.png] — Напоминания / повторные.** Empty state copy is overly long ("После выполненной записи ... → «Повторить через...»"). Dima won't read a paragraph at a red light.

**[13-waitlist.png] — Лист ожидания.** Empty state is the best in the app — icon, headline, one-line body, `+Добавить` button right there. Template for others.

**[14-route.png] — Маршрут дня.** Empty. "Все бригады / Y&D / D&K" filter sits above an empty card. But this is the **most valuable screen for a dispatcher on a scooter** — where am I going, in what order, with ETA. Currently it's a placeholder.

**[15-settings.png] — Settings hub.** Clean card-list. Seven entries that each lead to a real tool. Good.

**[16-settings-company.png] — Реквизиты.** Form. Fine for a one-time setup, never re-opened. Correct to hide in Settings.

**[17-services.png] — Услуги.** Category color stripes + price/duration + "-3€/шт расход" on cleaning is elegant. Second-best screen after Chats.

**[18-brigades.png] — Финансовые бригады.** Internal vs "Аутсорс" badges are perfect. The warning banner at top ("Финансовые бригады управляют выплатами и расходами. Для управления расписанием в календаре используйте «Расписание команд»...") is proof the model is confusing — you need a banner because the name collides with "бригады" elsewhere. Rename one or the other.

**[19-teams.png] — Бригады и мастера.** Overlaps 90% with [18] and [24]. Three doors to the same closet.

**[20-schedule.png] — Расписание.** Just the text "Сначала создайте бригаду" on a white void. But [19] clearly shows two existing brigades. So this screen is either broken or uses a different "бригада" definition. Either way — reads as a dead end.

**[21-sms-templates.png] — SMS шаблоны.** Correct depth for Settings. `[Name] [Date] [Time] [Master]` placeholders are good. Checkbox "Отправлять автоматически" is right UX.

**[22-settings-calendar.png] — Calendar settings.** Clean.

**[23-settings-cities.png] — Cities.** Clean. Toggle + pencil + trash is correct for an admin screen.

**[24-masters.png] — Masters.** Overlaps with [19]. Merge.

**[25-day-with-apt.png] — Day-with-apt.** Visually IDENTICAL to [01]. The injected appointment is not rendered. Either the rendering failed or the mock inserted into the wrong date. Dispatcher sees empty day, goes home. Silent failure — worst class of bug.

---

## 2. Psychology / cognitive load on main flows

**Flow 1 — Book appointment.** Optimum path: `FAB → Запись → prefilled sheet`. Current reality: FAB → menu works [02], but **"Запись" changes the URL and renders nothing** [03]. A dispatcher who experiences this ONCE on a scooter loses trust in the whole app. Fix priority = P0. Once fixed, the menu itself is fine — 2 taps to "new appointment sheet" is acceptable. But make "Запись" visually dominant in the menu (2x height, tinted row) since 90% of FAB opens want it.

**Flow 2 — "Сколько я сегодня заработал?".** Today a dispatcher must: tap Финансы → read "За последние 30 дней" dropdown → mentally discount 29 days → infer today from €3550/30. **Unacceptable.** Scooter question = scooter answer. The home screen should show "Сегодня: касса €240 · 3 визита · 1 долг" in one line. If we don't add this, Dima opens Финансы 20x/day, scrolls, gets frustrated, and starts keeping numbers in a Notes app. Then the CRM has lost.

**Flow 3 — Find client.** 12 mock clients → fine. 903 real → search box at top [05] is the only path. No visible autocomplete, no phone-number match demoed, no "recent 5" above the list. At 903 records the dispatcher needs to type 4 chars without a predictive hit = failure on a scooter. Make recency sort the **default** when opening from a chat or call. Phone icon should be single-tap-dial (no confirmation).

**Flow 4 — "Что требует моего внимания сейчас?"** The home screen [01] cannot answer this. No next-visit banner, no unread count on-screen (chat count is in the bottom-nav, good, but tiny), no ETA-to-next-job, no overdue-payment pill. Opening the app and seeing an empty grid is the single biggest UX loss. **Cost if unshipped:** Dima opens Chats and Финансы as a substitute for a home dashboard, 3-4 extra nav hops/open, 8-10 seconds wasted at each scooter stop.

**Flow 5 — Audit a number.** On [08] every number is display-only. Tapping "€3550" should filter Отчёты [09] to source rows. Right now: back-button → guess → pick a different screen. Margin 100% on [08] is true-but-misleading: €0 expenses during prototype. Label: "Маржа 100% (нет расходов в периоде)" or grey-out the % until at least one expense exists.

**Flow 6 — "Расход" button.** Discoverable via FAB [02] (good) and via Финансы → Расходы [10] (also good). Third path: tap "РАСХОД €0" card on [08] — currently does nothing visible; it **should** deep-link to add-expense. The dispatcher will try that card first because it literally says "РАСХОД". If dead, we lose the intuitive path.

---

## 3. Screen-by-screen verdict

### Keep & polish (high value, mostly right)
- [07-chats] — add "today at top" grouping.
- [08-finances] — keep architecture but add "Сегодня" summary card ABOVE the 30-day cards. Cut "СЧЁТ ЗАПИСЕЙ" block (it belongs in Reports).
- [09-reports] — VAT card is the sales demo.
- [11-payroll] — rename "Закрыть неделю и создать период" → "Выплатить за неделю".
- [13-waitlist] — best empty state in the app; copy it for others.
- [17-services] — keep.
- [21-sms-templates] — keep.

### Vital but cluttered (cut)
- [01-dashboard-week] — **add** a top pinned row: "Сегодня · 14:30 Анастасия · Пафос · €50 · 18 мин до выезда". Move the `Y&D / D&K` tabs to a segmented filter that only appears on user-toggle. Empty days should say "Сегодня пусто — взять лида?" with a button to Waitlist or Chats.
- [06-client-profile] — collapse empty Telegram/Instagram placeholders into one "+Соц-сети" button. Hide "Центр напоминаний" tab when empty. Surface **Call / WhatsApp / Новая запись** as a sticky action bar at the bottom.
- [18-brigades] + [19-teams] + [24-masters] — **merge into one screen** with segmented tabs Финансы / Календарь / Мастера. Three screens for the same mental model ⇒ dispatcher certainty that "I'm in the wrong place".
- [20-schedule] — the "Сначала создайте бригаду" dead end is a code bug (data exists in [19]). Fix.

### Dead weight (hide or merge)
- [04-city-picker] as bottom-sheet — replace with **centered modal** per the global rule. Also question the trigger: tapping a day header should show date info, not city selection. Move city filter to the top-bar chip area.
- [12-recurring] empty copy — shorten to "Тут появятся напоминания позвонить повторно".
- [16-settings-company] — keep but hide behind "Реквизиты и VAT" (already done). No changes.

### Missing screens (add or lose users)
1. **Home "Сегодня" card at top of [01]** — next visit, cash today, unread chats. **If not added:** Dima uses Chats as substitute homepage, loses money visibility.
2. **[14-route] as an actual map with pins and ETA** — currently a placeholder. **If not added:** Dima keeps using Google Maps + WhatsApp as shadow CRM.
3. **"Утренний брифинг" push** at 08:00 — summary of day ahead. **If not added:** Dima opens app blind, discovers the 09:00 visit at 08:55 while already on the wrong road.
4. **Today's cash ticker** — live `касса €X` in top-bar on every screen. **If not added:** Финансы page opened 20x/day for one number.

---

## Top 5 concrete fixes (prioritized)

1. **[03] — fix FAB→Запись opening the sheet.** P0, trust-breaker.
2. **[01] — pin "Сегодня" summary card above the grid** with next visit + cash + unreads.
3. **[04] — center the city picker modal** per rule; move city filter out of day-header tap.
4. **[18/19/24] — merge into one Brigades screen** with tabs. Kill the banner warning that exists only because the names collide.
5. **[25] — investigate why injected appointment didn't render** on day view. Silent rendering failures are worse than a 500 page.
