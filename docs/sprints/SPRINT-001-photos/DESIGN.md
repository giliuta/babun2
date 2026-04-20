# Sprint 001 — Photos block · Design Spec

> Lives inside `AppointmentSheet`, replaces the disabled `📷 Фото · скоро` placeholder at `components/appointment/AppointmentSheet.tsx:498-508`. Light theme only (MVP). All copy in RU; code/identifiers in EN.

---

## 1. Tokens used
- Primary: `violet-600` (add-button focus ring, active states)
- Destructive: `rose-500` / `rose-600` (Delete in viewer, Before badge background)
- Success: `emerald-600` (After badge background)
- Neutral: `slate-50..700` (card surfaces, dashed borders, captions)
- Body floor: **13 px**; tabular captions 11-12 px allowed
- Card padding inside the sheet row: `px-4 pt-2` (matches sibling blocks)
- Thumb grid gap: `gap-2` (8 px) · corners `rounded-xl` (12 px) for thumbs, `rounded-2xl` for popups

---

## 2. Collapsed state — empty (photos.length === 0)

```
┌──────────────────────────────────────────────┐
│ ┌────────────────────────────────────────┐   │
│ │  📷  Добавить фото                     │   │  ← h-11, dashed, violet-600 text
│ └────────────────────────────────────────┘   │     border-violet-300/60, bg-violet-50/40
└──────────────────────────────────────────────┘
```
- Full-width dashed button, **44 px min-height** (h-11), `rounded-xl`.
- Icon + label centered, `text-[13px] font-medium text-violet-600`.
- Tap → opens category popup (section 4).
- Empty state has no heading (saves vertical space — sheet is already tall).

---

## 3. With photos (N ≥ 1)

```
┌──────────────────────────────────────────────┐
│ Фото · 3                               Ред. ▾│  ← section label 12 px slate-500
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌ ─ ─ ─┐          │
│ │ [До] │ │[После]│ │  ·   │ │  +  │  →       │  ← horizontal scroll
│ │      │ │      │ │      │ │     │          │     64×64 thumbs
│ └──────┘ └──────┘ └──────┘ └ ─ ─ ─┘          │
└──────────────────────────────────────────────┘
```

- **Header row** (`flex justify-between items-center mb-2`):
  - Left: `Фото · {count}` — 12 px `text-slate-500 font-medium tabular-nums`
  - Right (N ≥ 2): `Ред. ▾` chevron — opens sort/reorder later; hidden at N ≤ 1.
- **Strip**: `flex gap-2 overflow-x-auto snap-x scroll-pl-4 -mx-4 px-4 pb-1`. Negative margin lets thumbs bleed to sheet edge; scroll-padding keeps first thumb snapped to 16 px inset.
- **Thumb**: 64×64 `rounded-xl bg-slate-100 overflow-hidden relative snap-start`. `object-cover`. Tap ripple via `active:opacity-80`.
- **Badge** (top-left of thumb, 16 px inset tag):
  - `До` — `bg-rose-500/95 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md`
  - `После` — same shape, `bg-emerald-600/95`
  - `·` neutral — `bg-slate-600/80` (for `kind === "other"`), single middle-dot glyph
- **Add tile** (always last): 64×64 dashed `border-[1.5px] border-dashed border-violet-300 text-violet-600 flex items-center justify-center`, plus glyph 20 px. Same tap behavior as the empty-state button.
- **Tap** on thumb → full-screen viewer (section 5).
- **Long-press** (≥ 500 ms) on thumb → context menu (section 6).

---

## 4. Add-photo flow — category popup (z-80)

```
Backdrop bg-black/40  (z-[70]  same as the sheet backdrop line)
┌────────────────────────────────────┐
│  Что это за фото?                  │  ← 16 px semibold slate-900
│  Категория поможет собрать отчёт.  │  ← 12 px slate-500
│                                    │
│  ┌───────┐ ┌────────┐ ┌─────────┐  │
│  │  До   │ │ После  │ │ Прочее  │  │  ← 3 pills, h-11, gap-2
│  └───────┘ └────────┘ └─────────┘  │
│                                    │
│  [Отмена]                          │  ← ghost, slate-500, h-10
└────────────────────────────────────┘
```

- Centered popup: `items-center p-4 rounded-2xl bg-white shadow-2xl max-w-sm w-full`, **z-[80]**.
- Pills: `rounded-full text-[13px] font-medium`.
  - `До` → `bg-rose-50 text-rose-600 border border-rose-200`
  - `После` → `bg-emerald-50 text-emerald-700 border border-emerald-200`
  - `Прочее` → `bg-slate-100 text-slate-600 border border-slate-200`
- Tap on a pill → closes popup AND triggers a hidden `<input type="file" accept="image/*" capture="environment" />` `click()`. Saved `kind` rides in a ref so the onChange handler knows which bucket.
- After camera returns a blob: compress via `canvas.toDataURL("image/jpeg", 0.6)` (target ≤ 100 KB per BRIEF), prepend to `photos[]`, toast `Фото добавлено · До` (rose / emerald / slate tint matches category), 2 sec auto-dismiss, z-[100].
- Backdrop-tap = cancel (no dirty state yet).

---

## 5. Full-screen viewer (z-95)

```
████████████████████████████████████  ← bg-black
  До · 14:35 · Спальня          ✕     ← 13 px white, caption tap-to-edit
                                        close glyph top-right, 44×44 hitbox
                                      
            ┌────────────┐
            │            │
            │   PHOTO    │            ← object-contain, max 85 vh
            │            │            swipe ← → switches
            └────────────┘
                                      
                                        
  [🗑 Удалить]             [Закрыть]  ← bottom safe-area row,
   rose-500 ghost           slate-50     h-12, gap-3, px-4
```

- Container: `fixed inset-0 bg-black z-[95] flex flex-col`, respects `env(safe-area-inset-*)` top and bottom.
- Top bar: caption centered-left (`text-white text-[13px]`, category prefix weighs `font-semibold`, color = category tint), close-X top-right, both inside 44 px hit targets.
- Photo area: flex-1, centered, `object-contain`, no zoom in MVP.
- Swipe ← / → (horizontal dx > 50 px) = prev / next; the active index is driven by `photos[]` order. A tiny pager (`2 / 5`) sits in the top-bar if N > 1.
- Bottom bar:
  - `Удалить` — `text-rose-500 bg-white/10 h-12 rounded-xl px-4` → triggers **undo toast** (5 sec) per design system's single destructive pattern. No `window.confirm`.
  - `Закрыть` — `text-slate-50 bg-white/15 h-12 rounded-xl px-4`.
- Tap on caption → inline edit: caption becomes a white input with violet-400 underline, submit on Enter / blur, Esc cancels. Default caption value is auto-generated (section 7).

---

## 6. Long-press menu (z-90)

```
┌────────────────────────┐
│ Пересохранить как…     │  ← 11 px slate-500 heading
├────────────────────────┤
│ До                     │   rose-600 dot
│ После                  │   emerald-600 dot
│ Прочее                 │   slate-500 dot
├────────────────────────┤
│ Удалить                │   rose-600
└────────────────────────┘
```
- Centered (not near-finger — consistent with project rule "all popups centered"), z-[90], `rounded-2xl bg-white shadow-xl w-60 divide-y divide-slate-100`.
- Each row `h-12 px-4 flex items-center gap-3 text-[13px]`.
- Tap outside = close. `Удалить` → same 5-sec undo toast as viewer delete.

---

## 7. Captions (auto-generated, user-editable)

- Default on save: `{Категория} · {HH:MM} · {location.label}` where
  - category label RU: `До` / `После` / `Фото`
  - time = `uploaded_at` formatted `HH:MM` (Europe/Nicosia)
  - location.label from the appointment's selected object (skipped if empty or only one object → falls back to `{Категория} · {HH:MM}`)
- Persisted in `AppointmentPhoto.caption` (already exists on the type).
- Edited inline from the full-screen viewer. 60-char soft cap, single line, no newlines.

---

## 8. Z-index ladder (complies with design-system-keeper)

| Layer                        | z    |
|------------------------------|------|
| AppointmentSheet (existing)  | 70   |
| Photo picker popup           | 80   |
| Long-press context menu      | 90   |
| Full-screen photo viewer     | 95   |
| Toast (`Фото добавлено` etc) | 100  |

No overlap with existing ladder in `babun-design-system-keeper.md`.

---

## 9. Microcopy (RU, locked)

| Surface                     | Text                                         |
|-----------------------------|----------------------------------------------|
| Empty-state CTA             | `📷 Добавить фото`                           |
| Strip label                 | `Фото · {N}`                                 |
| Category popup title        | `Что это за фото?`                           |
| Category popup subtitle     | `Категория поможет собрать отчёт.`           |
| Category pills              | `До` · `После` · `Прочее`                    |
| Cancel in popup             | `Отмена`                                     |
| Add add-tile aria-label     | `Добавить ещё фото`                          |
| Toast — added               | `Фото добавлено · {Категория}`               |
| Toast — deleted + undo      | `Фото удалено` · action `Отменить` (5 сек)   |
| Viewer delete button        | `🗑 Удалить`                                 |
| Viewer close button         | `Закрыть`                                    |
| Long-press header           | `Пересохранить как…`                         |
| Long-press items            | `До` · `После` · `Прочее` · `Удалить`        |
| Inline caption placeholder  | `Подпись…`                                   |

---

## 10. Edge cases to handle in implementation

- **Storage ceiling**: when `JSON.stringify(photos).length` approaches localStorage limit, block Add and show toast `Память заполнена — удалите старые фото` (amber-500 tint).
- **iOS camera-vs-gallery quirk** (from BRIEF): if first-tap opens gallery, a second row `Из галереи` appears in the category popup on subsequent sessions. Out-of-scope for initial ship — stub only.
- **Dark mode**: not in MVP. Viewer already reads well on black bg; rest of sheet follows sheet's existing light palette.
- **Reduced motion**: toast fade instead of slide; swipe-to-next disables spring.

---

## 11. Acceptance checklist

- [ ] Placeholder at `AppointmentSheet.tsx:498-508` fully replaced by `<PhotoBlock>`.
- [ ] All tap targets ≥ 44 px tall.
- [ ] Badges pass WCAG AA (rose-500/emerald-600 on white photo edges — white text on colored chip).
- [ ] All popups centered, no bottom-sheet drift.
- [ ] Destructive actions use undo toast (5 sec), never `window.confirm`.
- [ ] z-index values match ladder above.
- [ ] RU in UI, EN in props/types/file names.
