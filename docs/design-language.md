# Babun CRM — Design Language

Sprint 028 (2026-04-21) — CEO direction: "iPhone + Telegram style, никаких эмодзи в UI".

This doc captures the rules that every new surface in the app must follow. When in doubt, look at iOS System Settings or Telegram's settings screen for reference.

---

## 1. Visual identity

| Token | Value |
|---|---|
| Primary accent | `violet-600` (#7C3AED) |
| Success toggle | `emerald-500` (iOS green switch) |
| Danger | `rose-600` / `rose-500` |
| Warning / pending | `amber-500` |
| Canvas background (screens) | `slate-50` |
| Card background | `white` |
| Divider | `slate-100` (hairline, 1 px) |
| Soft separator | `border-slate-200` only when a border is needed for structure |

Never use `slate-700` or below for backgrounds. The app stays bright; dark mode is out-of-scope for now.

## 2. Typography

System font stack via `Inter` with cyrillic subset (already configured in `app/layout.tsx`). Sizes:

| Role | px |
|---|---|
| Row label (iOS settings) | 15 |
| Section header (uppercase) | 11, tracking-wider |
| Row caption / subtitle | 12–13 |
| Footnote below a group | 11 |
| Title inside sheets | 17, semibold, tracking-tight |
| Numeric / monospace amounts | 14–17, `tabular-nums` |

Never mix more than two font sizes in a single row.

## 3. Icons

- **Library**: `lucide-react`. No emoji in chrome (data can still carry them — category icons, user-entered tags).
- **Stroke**: 2 (default) or 2.5 for emphasis.
- **Size**: 14 in inline chips, 16 in row accessories, 18 in card icons, 20 in buttons.
- **Colour**: monochrome, follows text colour. For iOS-settings-style lists, icons sit inside a **coloured rounded-square tile** (`rounded-lg`, 32×32, white icon on a tinted bg).
- **Never animate** icon fills. Fade opacity or swap icon components only.

Emojis that survive: inside user-generated data (client names, category labels the admin entered, tag names), and in notification push titles where OS rendering adds pizzazz for free. Nowhere else.

## 4. Surfaces

### 4.1 Grouped list (the default layout)

```
┌─ РАЗДЕЛ ─────────────────┐  ← 11px uppercase caption, slate-500
│┌────────────────────────┐│
││ [icon] Row label     › ││  ← white card, rounded-2xl (16 px)
││────────────────────────││  ← slate-100 hairline divider
││ [icon] Row label     › ││
│└────────────────────────┘│
│  11px footnote text…     │  ← explanatory line under the card
└──────────────────────────┘
```

- Card: `bg-white rounded-2xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]`
- Row: `px-4 py-3 min-h-[48px]`
- Divider: `divide-y divide-slate-100`
- Chevron at the end of a nav row: `<ChevronRight size={16} className="text-slate-300" />`
- Accessory (toggle, badge, amount): right-aligned with 12 px gap from label.

### 4.2 Modal sheet (full-screen on phone, centered on desktop)

- Wrapper: `fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px] p-2 items-center justify-center`
- Shell: `w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col`, `height: 92vh`
- Never bottom-sheet unless the content is specifically a picker (date / time / city). Bottom sheets collide with BottomTabBar; centred sheets sit cleanly above it.
- Header: 17 px title + round `X` close button on the right.
- Footer: sticky, 11-px height action bar with left-aligned destructive action and right-aligned primary pair.

### 4.3 Form inputs

iOS-style inset fields — no visible border in resting state:

```tsx
"w-full px-3.5 py-2.5 bg-slate-100 border border-transparent rounded-xl text-[15px] focus:outline-none focus:bg-white focus:border-violet-500 transition"
```

Never use `<select>` styling beyond the default; Safari renders it natively.

### 4.4 Buttons

| Variant | Class sketch |
|---|---|
| Primary | `h-11 px-5 bg-violet-600 text-white rounded-xl text-[15px] font-semibold active:scale-[0.98]` |
| Secondary | `h-11 px-5 text-slate-700 text-[15px] font-medium active:bg-slate-100` (no border) |
| Ghost destructive | `w-11 h-11 rounded-xl text-rose-600 active:bg-rose-50` (icon-only) |
| Chip filter | `h-8 px-3.5 rounded-full text-[12px] font-semibold` — active: `bg-violet-600 text-white`; idle: `bg-white border border-slate-200` |

Never render a `border-2` hard border on a primary button. iOS buttons are fills + radius, nothing else.

### 4.5 iOS switch

```tsx
<button
  className={`relative w-[46px] h-[28px] rounded-full ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
>
  <span className={`absolute top-[2px] left-[2px] w-6 h-6 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-transform ${checked ? "translate-x-[18px]" : ""}`} />
</button>
```

Emerald-500 when on (matches native iOS). Never violet — violet is reserved for primary fills and selected nav state.

## 5. Spacing

- Outer page padding: `px-4 py-4` on mobile, `px-6 py-6` on desktop.
- Between groups on a screen: `space-y-5` (20 px) — larger than iOS default because our screens are denser.
- Between rows in a card: hairline only (no vertical padding beyond the row's own `py-3`).

## 6. Motion

- `active:scale-[0.98]` on primary buttons.
- `active:bg-slate-50` / `active:bg-slate-100` on tappable rows.
- Modal entry: no bespoke animation — the default React conditional render is fine. Sheets from BottomTabBar flow use a 200 ms slide.
- Never use `animate-spin` for loading states over 400 ms. If it's slow, show a skeleton instead.

## 7. What we removed in Sprint 028

- **Cartoon emojis in chrome**: ☕💼🧭🌙✈️ (event presets), 📷 (photo button), 💵✅🔄📅📋♻️❌🗑 (action menu), 🗓📍👥🧑‍🔧💬🔧🏢 (settings nav), 🙈👁 (password toggle), ⏳⭐📋↩📌 (chats menu icons).
- **Account status chip** at the top of MasterSheet. `is_active` toggle in "Работа" covers the only distinction that matters for payroll.
- **TodayChip strip** above the calendar header.
- **Center FAB** in BottomTabBar.
- **Hard borders** on primary buttons (`border-2 border-slate-200`).

## 8. What to do when adding a new surface

1. Read [AGENTS.md](../babun-crm/apps/web/AGENTS.md) for Next 16 deprecation notes.
2. Look at an existing redesigned screen for the pattern — [/dashboard/settings/page.tsx](../babun-crm/apps/web/src/app/dashboard/settings/page.tsx) is the canonical grouped-list example; [MasterSheet.tsx](../babun-crm/apps/web/src/app/dashboard/masters/MasterSheet.tsx) is the canonical modal sheet.
3. Pick a lucide icon for every decorative glyph — no emoji shortcuts.
4. Spacing: 48-px min row height for tappable rows; 20-px gap between groups; 16-px inside rows.
5. Copy this doc's tokens verbatim — do not improvise a new accent colour without adding it here first.

## 9. Pages still on the old look (backlog)

Ship order — tight pass-by-pass, no parallel agents after the Sprint 028 wave:

- `/dashboard/clients` + `/dashboard/clients/[id]` — client list + profile
- `/dashboard/finances` — tab bar, period picker, row styling
- `/dashboard` (calendar) — header chrome, TimeColumn ticks, CitySpecialSchedule
- `/dashboard/chats` — remaining inline glyphs (📌⭐📋↩ on messages already cleaned; waitingBadge ⏱ still there)
- `/dashboard/close-day` — action footer spacing
- Client/appointment sheets — tighten to new tokens
- Login / signup — Telegram-style big-card layout

One page per sprint keeps the diff readable and reviewable. Leave a breadcrumb comment (`// Sprint 028-visual-pass`) in the PR.
