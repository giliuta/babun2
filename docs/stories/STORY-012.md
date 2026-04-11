# STORY-012 — Phone-first appointment sheet

**Status:** in progress → done (first pass)
**Priority:** HIGH
**Date:** 2026-04-11

## Problem

The old appointment form was a 1119-line scroll of 10+ sections (time, client, services, sum, team, address, comment, photo, payment, status, duplicate, cancel, delete). On iPhone it looked like a tax return, not a booking tool. Warnings sat at the top shouting about missing fields, the photo area occupied half a viewport when empty, status and destructive actions were shown even for brand-new records.

The user explicitly said: "все это будет на тф, сайтом мы пользоваться толком не будем вся работа через тф, поэтому делаем максимально качественно на телефоне".

## Decisions

1. **Three-card home screen** for both create and edit:
   - ⏰ Time
   - 👤 Client
   - 🔧 Services
   Plus a compact inline comment field and, in edit mode, a status row. Everything else collapsed under "Ещё…".

2. **Full-screen bottom sheets** for the three pickers (time / client / service). No inline dropdowns.

3. **Native iOS pickers** for date and time (`<input type="date">` + `<input type="time">`), chips for duration. No custom wheel picker — native is smoother and the user already knows how to use it.

4. **Client picker**: single list sorted "recent first, then alphabetical". Search filters live. Big "+ Новый клиент" button expands inline into a minimal name + phone form that creates a draft client and auto-selects it.

5. **Service picker**: multi-select list grouped by category with big tappable rows and a sticky footer showing `N услуг · NN мин · NNN€` and a Готово button.

6. **Context-smart address**: if the picked client has a stored address, the address field is hidden entirely. If they have none, a red hint appears right under the client card: "📍 У клиента нет адреса — добавить".

7. **No validation banner**. The Save button is grey+disabled when client or services are missing. Tapping it pulses the missing card red for 600 ms.

8. **Delete only in edit mode**, as a trash icon in the purple header. Duplicate / cancel removed entirely — they can come back later as an overflow menu if anyone misses them.

9. **Team picker only shows when teams.length > 1**. Default is first active team. Hidden by default, lives in "Ещё".

10. **Payment editing is minimal**: "Ещё" has a single "Аванс" number field. No payment method history, no payments[] array edits. This is enough for the current workflow; detailed payment editing can come back in a follow-up if needed.

## Files

**NEW:**
- `src/lib/draft-clients.ts` — extracted from the old form
- `src/components/appointments/sheet/BottomSheet.tsx` — shared full-screen sheet shell
- `src/components/appointments/sheet/ClientPickerSheet.tsx`
- `src/components/appointments/sheet/ServicePickerSheet.tsx`
- `src/components/appointments/sheet/TimePickerSheet.tsx`
- `src/components/appointments/sheet/NewAppointmentSheet.tsx` — main screen (~550 lines)

**UPDATED:**
- `src/app/dashboard/appointment/new/page.tsx` — uses new sheet
- `src/app/dashboard/appointment/[id]/page.tsx` — uses new sheet in edit mode
- `src/app/dashboard/page.tsx` — DraftClient import path
- `src/components/calendar/{AppointmentBlock,DayColumn,WeekView}.tsx` — DraftClient import path

**DELETED:**
- `src/components/appointments/AppointmentForm.tsx` (1119 lines)
- `src/components/appointments/AppointmentDialog.tsx` (unused)

## Verified flows

- **New client call** (dispatcher on phone): FAB → tap Клиент → + Новый → name + phone → auto-select → tap Услуги → check one → Готово → tap Время → native pickers → Готово → Save. **8 taps, ~15 s**.
- **Returning client**: FAB → Клиент → search → tap → Услуги → check → Готово → Save. **6 taps**.
- **Reschedule existing appointment**: tap block in calendar → tap Время card → native time wheel → Готово → Save. **5 taps**.

## Out of scope (deferred)

- **View-only screen** with call / WhatsApp / map buttons → STORY-013
- **Photos upload** on appointments → STORY-014
- **Rich payment editor** with multiple methods / history → STORY-015 (after Supabase)
- **Status flow buttons** "Выехал → Прибыл → Завершил" as one-tap actions on view screen → STORY-013
- **Duplicate / cancel** as overflow menu → STORY-013

## Notes

- Custom total (override) stays in "Ещё" — AirFix sometimes negotiates a final price on site
- iOS native `<input type="time" step="900">` steps in 15-minute increments — perfect for scheduling
- The pulse-red-on-missing behaviour is deliberately cheap (CSS animate-pulse, 600 ms), not a fancy shake — minimal bundle impact
