# STORY-061 — Clients page: simplify end-to-end (add → list → profile)

**Status:** in progress
**Approved:** direction approved by user via Claude Preview mockup (`mockups/index.html`), 2026-06-01.
**Goal (user's words):** «максимально всё упростить» — от добавления до конечного результата.
**Deploy rule:** every slice ships to `master` so the user sees it live immediately.

## Diagnosis (current state)

- `app/dashboard/clients/page.tsx` — **2 358 lines** (limit is 400). Holds list + dead draft path + dead `selectedId` path + many local components.
- **Three** profile implementations coexist:
  - `ClientCardPage.tsx` (401) — current, mounted by `/clients/[id]`.
  - `ClientPanel.tsx` (2 196) — legacy, still mounted on desktop inline-modal.
  - `ClientProfileView.tsx` (865) — legacy, `/chats` side-panel, **writes via localStorage `upsertClient` → bypasses Supabase sync** (data-loss risk).
- List card renders up to **11** elements → visual noise.
- Create form showed messengers (×3) + VIP/ЧС status always; folded now.
- Dead model fields: `referred_by_client_id`, `first_contact_date`, `language`, client-level `equipment` (real data on `Location.equipment`), client-level `property_type`/`address`.

## Approved design

**List** — calm 4-element card (avatar · name · one context line · debt-if-any · green call button). Search always visible (kill hidden pull-down). Filters 7→4 (Все · Должники · Давно не были · ДР + tags). Keep swipe + long-press + multi-select.

**Add** — name + phone first-class; messengers/birthday/city/source/note/status all under one «Ещё»; objects one optional dashed button. Keep dedup guard + createBlankClient.

**Profile** — one implementation. Blocks 8→4: **Объект + кондиционеры** (equipment with «чистка через N» due chips), **История** (visits + finance merged), **Заметки**, **Инфо** (Contacts + Personal + Meta merged). Header = statuses + object switcher + key stats.

## Slices (one deploy each)

1. **Add screen** ✅ (this commit, v807) — `clients/new/page.tsx` rebuilt: name+phone first, «Ещё» fold, optional object. Logic untouched.
2. **List** — calm card, visible search, 4 filters. Touches `clients/page.tsx` (only the local `ClientCard` + chip row); plan to extract `SegmentChip`/`ReminderPicker`/`BulkSmsSheet` to files.
3. **Profile consolidation** — route everything to one view, merge 8→4 blocks, then delete `ClientPanel` + `ClientProfileView`, remove dead `clients/page.tsx` branches, drop dead model fields (separate migration commit if DB columns are dropped).

## Verification note

Worktree has no `node_modules` → junction from main checkout to run `tsc`. Chrome MCP is not logged into babun.app, so prod auth-flow can't be walked here — user verifies live after each deploy.
