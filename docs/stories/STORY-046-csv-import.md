# STORY-046 — CSV import for clients

**Status:** `todo` — planning, awaiting `ok` on decisions before code.
**Estimate:** 2.
**Dependencies:** STORY-036 (clients in Supabase ✅), STORY-039 (RBAC permissions ✅).
**Blocks:** none.

## Why

Any incoming SaaS user wants to bring their data with them. AirFix has 903 legacy Bumpix clients in CSV — they'll want to migrate when they decide to switch fully. Future tenants exporting from HubSpot / Excel / generic CRM will want the same. Without import, "blank slate" is a deal-breaker.

This story ships a CSV-only import flow for the `clients` table. XLSX is parked as a follow-up if asked.

## G0 — Inventory (read-only, completed)

### `clients` table — wide row

After STORY-036, `clients` has 28+ columns. CSV import targets the subset that's commonly present in exports:

| Column | Type | Importable v1? | Notes |
|---|---|---|---|
| `full_name` | text not null | **required** | Must map. |
| `phone` | text | yes | Primary phone — normalised on import. |
| `email` | text | yes | |
| `comment` | text | yes | Free notes. |
| `address` | text | yes | |
| `tags` (single, applied to all imports) | via `client_tag_assignments` | yes | One tag picker in mapping step (not per-row). |

Wide jsonb fields (`phones`, `locations`, `notes`, `equipment`) and rich metadata (`whatsapp_phone`, `birthday`, `discount`, `balance`, `acquisition_source`, `pinned_at`, `reminder_at`, `referred_by_client_id`, `first_contact_date`, `city`, `language`, `property_type`) are NOT mappable in v1 — too schema-specific. Defaults handle them (empty arrays / null / empty strings).

### Permissions (per STORY-039)

- `Owner` and `Dispatcher` can INSERT into `clients` (see `clients_insert_owner_or_dispatcher` policy).
- `Master` cannot. Import button must be hidden for Master role and any direct REST attempt is blocked by RLS (`42501`).

### UI entry point

`/dashboard/clients/page.tsx:551-579` has the "Править" / "Добавить клиента" header buttons. Import sits as a "⋯" menu item on that header (or "Импорт CSV" tile in `+ Добавить клиента` flow). One entry point, on the page where users naturally look.

### Dependencies

- **`papaparse`** (~12 KB gz) — robust CSV parser with stream support. Not currently installed.
- **No XLSX in v1.** Excel users save as CSV.

## Decisions locked (D1-D7)

- **D1.** Entry point: `/dashboard/clients` toolbar (Import CSV in the ⋯ menu next to "Добавить клиента"). One place. Settings is for migration-from-localStorage only (different flow).
- **D2.** CSV only. XLSX deferred to a follow-up STORY-046b.
- **D3.** Hard cap **5000 rows** per file. Files larger → "split your file" message. AirFix's 903 fits. 50K async-via-Edge-Function deferred.
- **D4.** **Single tag picker for all imported rows** (per your G6 brief). Mapping step has `Тег для всех импортированных: [VIP / Новый / Постоянный / Проблемный / —нет—]`. No per-row tag column in v1. Simpler, fewer edge cases. Per-row tags via CSV column → STORY-046c.
- **D5.** **3-way duplicate handling** by normalised phone. Preview step shows count of:
  - "Дубликаты в CSV" (rows in this file that share a phone) — warning chip, user decides; default first-row-wins.
  - "Дубликаты в БД" (CSV row whose phone matches an existing client in this tenant) — choice radio: `Пропустить` / `Перезаписать` / `Импортировать дубликатом`. Default: **Пропустить**. Never default to destructive `Перезаписать`.
- **D6.** Encoding — detect UTF-8 BOM; fallback to `TextDecoder('windows-1251')` if mojibake heuristic fires (>10% of rows have control chars or `?` in the name column). Plus banner: "Если кириллица отображается как ◇◇◇ — пересохраните файл как UTF-8".
- **D7.** Phone normalisation:
  - Strip spaces, dashes, parentheses, and any non-digit char EXCEPT a leading `+`.
  - If 9-10 digits without leading `+` → prepend tenant default country code. Default = Cyprus `+357` because that's our flagship tenant; we ALSO ask the user in the mapping step (radio: `+357 (Cyprus)` / `+7 (Russia/Kazakhstan)` / `+30 (Greece)` / другой) so non-Cyprus tenants can override.
  - After normalisation must be E.164-shaped (`^\+\d{8,15}$`); rows that fail → row skipped with reason "битый телефон".
- **D8.** Backend — **client-side batch INSERT**, no new server endpoint:
  - Repository uses RLS via JWT; tenant_id forgery impossible.
  - No new code surface to maintain.
  - 5000 rows × 50-batch = 100 round-trips × ~120 ms ≈ 12 s. Progress bar covers the wait.
  - For >5000 rows (out of scope) Edge Function would be the right path; deferred.

## G1 — Dependencies

```bash
cd babun-crm/apps/web && npm install papaparse @types/papaparse
```

(no SQL migration; uses existing `clients` repo + `client_tags` repo).

## G2 — UI flow (4-step wizard, modal)

`<ImportClientsModal />` mounted in `/dashboard/clients/page.tsx`. Open from "⋯ → Импортировать CSV". Steps split into separate components to honour the 400-line cap:

1. **`UploadStep.tsx`** — drag-and-drop or file picker. Validates extension (`.csv` / `.txt`) and size (< 10 MB; row limit checked after parse). Reads first ~50 rows into preview state. Shows the encoding banner if needed.
2. **`MappingStep.tsx`** — column-mapping table + the global tag picker + the country-code picker:
   - One row per CSV column with a dropdown: `— не импортировать —` / `ФИО *` / `Телефон` / `Email` / `Заметки` / `Адрес`.
   - Auto-mapping fires on entry (G3).
   - **Тег для всех импортированных**: dropdown of existing tags + "— нет —". Default "— нет —".
   - **Код страны для телефонов без + **: radio (default `+357`).
3. **`PreviewStep.tsx`** — first 10 rows with mapped values + per-row warning chips (bad phone, empty name, etc.). Aggregate counts at top: "Будет импортировано: N. Пропущено: K (M пустое имя, J дубликаты, …)". Duplicate-handling radio (D5).
4. **`ResultStep.tsx`** — progress bar during import, then success card with counts + `[Скачать список ошибок CSV]` if any rows failed + `Открыть клиентов` / `Импорт ещё одного файла`.

## G3 — Auto-mapping heuristics

Header → field guess (case-insensitive, accent-insensitive, trimmed):
- `name|имя|фио|client name|full name|клиент` → `full_name`
- `phone|телефон|тел|mobile|моб` → `phone`
- `email|e-mail|почта` → `email`
- `notes?|заметки?|comment|примечан` → `comment`
- `address|адрес` → `address`

Unmatched columns default to `— не импортировать —`. Power user can override.

## G4 — Phone normalisation

```ts
function normalisePhone(raw: string, defaultCountry: '+357' | '+7' | '+30' | string): string {
  const trimmed = raw.trim();
  // Keep leading + if present, then digits only.
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (hasPlus) return '+' + digits;
  if (digits.length >= 11 && digits.startsWith('7')) return '+' + digits;     // RU 11-digit
  if (digits.length === 10 && digits.startsWith('8')) return '+7' + digits.slice(1); // RU 8XXX legacy
  if (digits.length === 8) return defaultCountry + digits;                    // CY 8-digit
  if (digits.length === 9 || digits.length === 10) return defaultCountry + digits;
  return ''; // unparseable
}

function isE164(s: string): boolean {
  return /^\+\d{8,15}$/.test(s);
}
```

Rows whose normalised phone fails `isE164` → skipped with reason "битый телефон". Empty phone is allowed (clients without phone are fine — only `full_name` is required).

## G5 — Duplicate detection (D5)

- **Within CSV**: build a `Map<normalisedPhone, count>`. Flag any phone with count ≥ 2 in the preview. First-row-wins on the actual import; later duplicates skipped + listed as "дубликат внутри файла".
- **Against DB**: chunk-fetch existing clients by phone, normalised — `from('clients').select('id, phone').eq('tenant_id', tenantId)` — build a `Set<normalisedPhone>`. For each preview row, mark "дубликат БД" chip if matches.
- **User choice**: radio in PreviewStep — `Пропустить дубликаты БД` (default) / `Перезаписать существующих` / `Импортировать дубликатом`. The latter creates a second client row sharing the phone (acceptable — phone isn't a UNIQUE constraint).

## G6 — Single-tag assignment

- Mapping step: one tag picker for all imported rows.
- After clients INSERT: build `client_tag_assignments` rows (`tenant_id`, `client_id`, `tag_id`) for every successfully-inserted client + bulk INSERT in one batch (200 max per round-trip).
- "— нет —" → skip the tag step entirely.

## G7 — Smoke (8 steps)

1. Upload valid 5-row CSV with cyrillic UTF-8 → preview shows 5 rows mapped → import → verify in DB via SQL Editor `select count(*) from clients where tenant_id = …` = 5.
2. Upload CSV with 2 rows sharing the same phone → preview chips show "дубликат внутри файла" → user picks "Пропустить" → final count = 4 / 5.
3. Upload CSV where 1 row has empty `name` → preview chip "пустое имя" → row skipped, listed in errors download.
4. Upload non-CSV file (PDF) → upload step rejects with "Только .csv и .txt" before parse.
5. Upload >10 MB or >5000-row file → upload step rejects with explicit message.
6. Phone normalisation matrix: `+357 99 12 34 56` / `99-12-34-56` / `(99)123456` / `+7 905 123 45 67` / `8 905 123 45 67` (RU 8 → +7 expansion) all parse to clean E.164 in the preview.
7. As Master role: import button hidden in UI; direct hit on the import flow's repo `from('clients').insert(...)` → `42501` from RLS.
8. As User2 (different tenant) — `from('clients').insert({ tenant_id: USER1_TENANT, … })` from a Master/Dispatcher session → `42501` (cross-tenant RLS WITH CHECK).

## G8 — Bump + push

`v362-csv-import` / `babun-v362`.

## G9 — Production verify

Repeat G7 against `https://babun.app` using a fresh `*-1949@story046.test` Owner. Tear down via account-delete cascade after.

## Acceptance criteria

1. `papaparse` installed; CSV parsing works with cyrillic UTF-8 (and Windows-1251 fallback).
2. 4-step wizard reachable from `/dashboard/clients` for Owner / Dispatcher only.
3. Auto-mapping heuristics cover ~5 common header variants per field.
4. Phone normalisation correct (D7 matrix in smoke 6).
5. 3-way duplicate handling works (skip / overwrite / import-as-dup).
6. Single tag for all imports works.
7. Master role + cross-tenant blocked server-side (`42501`).
8. Smoke 8/8 passed locally + production.
9. `v362-csv-import` deployed.

## Out of scope

- XLSX support → STORY-046b.
- Per-row tag column from CSV → STORY-046c.
- Bulk **update** existing clients (only INSERT here).
- Custom fields / wide jsonb (`phones`, `locations`, `notes`, `equipment`).
- Export CSV (separate STORY when asked).
- CSV import for `appointments` / `recurring_reminders`.
- OAuth integrations (Bumpix API, HubSpot API).
- Async job queue / Edge Function for >5000 rows.
- Saved mappings / "remember this layout".
- Import undo button.

## Risks

- **Cyrillic encoding (D6)** — biggest UX foot-gun. Bumpix exports are Windows-1251. Banner + fallback decoder mitigates; tested in smoke 1.
- **Phone-format inconsistency** — different legacy CRMs use different shapes. Tenant-default country code (D7) + per-import override picker covers Cyprus / Russia / Greece. Other countries → user picks "другой" + types `+XX`.
- **Tag explosion via case differences** — N/A in v1 because we use a fixed picker (D4); no on-the-fly tag creation.
- **5000-row × 50-batch = 100 round-trips** — ~12 s. Progress bar covers it.
- **User re-uploads same file** — duplicate detection (D5) catches it; "0 новых, 5000 дубликатов" in the summary makes it obvious.
- **Race condition on duplicate detection** — between preview-time DB fetch and import-time INSERT, another user could create a matching client. RLS doesn't prevent insert; we'd end up with two clients sharing a phone (the `Импортировать дубликатом` semantic anyway). Acceptable; surface in error log.

## Future SaaS extensibility

- Generic CSV import framework — same `<UploadStep>` / `<MappingStep>` / `<PreviewStep>` shells reusable for `appointments` / `recurring_reminders` with a different mapping schema.
- Connectors: pull CSV from Google Drive / Dropbox / direct Bumpix-API.
- Saved mappings per source: "remember this mapping for next time".
- XLSX (sheetjs ~85 KB gz) — same UI, swap parser.
- Async import via Edge Function for >5000 rows. Job-status polling endpoint.
- Bulk update / merge existing rows (D5 alt).
