# STORY-058 — PersonalEvent form: quick-apply chips + settings mirror

**Status:** Sprint A done (v465). Sprints B-D pending.
**Priority:** P1 — UX uplift for the personal calendar's most-used surface.

## Why

User wants the personal-event creation form to feel «sharp and fast»:

1. **Quick chips** above the title block — one-tap fill name + color +
   duration + (if all-day) toggle. NOT a category for filtering — they
   are shortcuts for «what I create often» (Обед, Встреча, Йога, …).
2. **Settings «mirror»** — `/dashboard/settings/calendar/event-types`
   page renders a visual reflection of the form. User edits chips,
   reorders blocks, toggles which fields are visible.

## Sprint A — quick chips MVP (v465 — DONE)

- ✅ `EventPresetChips` component renders horizontally between
  TimeBlock and Hero card in [PersonalEventSheet](../../babun-crm/apps/web/src/components/calendar/PersonalEventSheet.tsx).
- ✅ Reuses existing `PersonalEventType` schema +
  `usePersonalEventTypes` hook (no duplicate storage layer).
- ✅ Tap → fills `title`, `color`, recalculates `timeEnd` from
  `defaultDuration`, flips `allDay` if preset is all-day.
- ✅ Settings page renamed «Типы событий» → «Шаблоны быстрого
  применения» (link in calendar settings + page header).
- ✅ 5 seeds remain unchanged (Обед, Встреча, Выезд в офис,
  Выходной, Отпуск).

## Sprint B — Settings «mirror» editor (planned)

Goal: turn `/dashboard/settings/calendar/event-types` from a flat list
into a true visual editor of the event form.

- [ ] Top of page: live preview of `PersonalEventSheet` (read-only mini
      version) so the user sees what their form looks like.
- [ ] Each block in the preview is tappable → opens an inline drawer
      to toggle visibility / edit defaults.
- [ ] Drag-handles on each preview block → reorder via
      `@dnd-kit/sortable` (already in deps).
- [ ] New «Layout» entry in `personal-event-types`-adjacent storage:
      `{ blockOrder: BlockId[], hiddenBlocks: BlockId[] }`.
- [ ] PersonalEventSheet reads layout config + renders blocks in
      configured order, skipping hidden ones.
- [ ] Block ids: `time | chips | title | location | url | push | repeat`.
- [ ] Sensible guard: title + time can't be hidden (form needs them).

## Sprint C — Multi-reminder push (planned)

- [ ] Push block becomes a list with «+ Ещё напоминание» button.
- [ ] Up to N=4 reminders per event (stored in `event_push_offsets[]`,
      already an array in schema).
- [ ] UI: each row has its own time picker + delete-X.
- [ ] Visual cap at 4 to keep the form short.

## Sprint D — Place enhancements (planned)

- [ ] 📍 «Сейчас здесь» button in the address input — `navigator.geolocation`
      + reverse-geocode (Google Maps Geocoding API or OpenStreetMap Nominatim).
- [ ] Recent places dropdown — last 5 distinct addresses used in events,
      stored in localStorage per master.
- [ ] 🗺 «Открыть в Maps» button next to address — reuses `buildMapsUrl`
      helper from PersonalEventBlocks.

## Out of scope

- AI parse from free-text («обед с Сергеем завтра в 13») — separate
  STORY, requires Claude API hit per paste.
- Smart defaults by tap time — explicitly rejected by user.
- Disabled-button explanation — explicitly deferred by user.
- Conflict warning when slot is busy — separate STORY.
- Sharing event via WhatsApp/Telegram — separate STORY (also
  Cyprus-specific WhatsApp inbox is its own track).

## Architecture notes

- **No new storage schema added.** Reusing `personal-event-types`
  avoids the v447→v456 «add tiles → drop tiles» cycle. The chips ARE
  the same data, just rendered as horizontal scroll instead of tile
  grid.
- **CRUD already exists** at /dashboard/settings/calendar/event-types
  with full icon picker (21 lucide options), color picker
  (PRESET_COLORS), label, default duration, all-day toggle, delete.
  Sprint B builds the «mirror» preview ON TOP of that page.
- **Bridge to STORY-057:** when masters/teams move to Supabase,
  `personal-event-types` should follow (same migration pattern). For
  now it stays in localStorage; chips work per-device.
