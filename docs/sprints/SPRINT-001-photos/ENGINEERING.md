# SPRINT-001 — Before / After Photos · Engineering Plan

Inputs: `docs/sprints/SPRINT-001-photos/BRIEF.md`, existing `AppointmentPhoto`
in `babun-crm/apps/web/src/lib/appointments.ts:54-59`, placeholder in
`AppointmentSheet.tsx:497-508`.

Scope = MVP: localStorage-only, 5 photos/appointment cap, Cyrillic UI / English code.

---

## 1. Type changes — `babun-crm/apps/web/src/lib/appointments.ts`

Extend `AppointmentPhoto` (lines 54-59):

```
export type PhotoKind = "before" | "after" | "other";

export interface AppointmentPhoto {
  id: string;
  data_url: string;           // base64, JPEG q=0.6, ≤200 KB
  caption: string;
  uploaded_at: string;        // ISO — when saved to localStorage
  kind: PhotoKind;            // default "other"
  location_id?: string | null;// объект клиента (опционально, MVP: inherit from apt.location_id)
  taken_at?: string;          // ISO — EXIF or file.lastModified; fallback = uploaded_at
}
```

Update `loadAppointments()` migration (lines 152-191) — per-photo normalize:

```
photos: (p.photos ?? []).map((ph) => ({
  ...ph,
  kind: ph.kind ?? "other",
  location_id: ph.location_id ?? null,
  taken_at: ph.taken_at ?? ph.uploaded_at,
})),
```

No schema change to `Appointment` itself (field already present at line 114).
`createBlankAppointment` (line 491) and `duplicateAppointment` (line 535)
already set `photos: []` — no edit needed there.

---

## 2. `lib/photos.ts` (NEW)

```
compressImage(file: File, maxKb = 200): Promise<string>
  // 1. loadImage → HTMLImageElement via URL.createObjectURL + decode()
  // 2. compute target dims: min(1280, orig) preserving aspect
  // 3. draw to OffscreenCanvas (fallback: document.createElement("canvas"))
  // 4. loop q=[0.6, 0.45, 0.3] until toDataURL("image/jpeg", q) ≤ maxKb*1024*1.37 (base64 overhead)
  // 5. return data_url

validatePhotoSize(data_url: string): { ok: boolean; kb: number }
generateCaption(photo: AppointmentPhoto, location?: Location | null): string
  // "До · 14:35 · Спальня" | "После · 14:35" | "Фото · 14:35"

makePhoto(data_url: string, kind: PhotoKind, location_id?: string | null): AppointmentPhoto
  // factory: generateId("ph"), uploaded_at=now, taken_at=now

estimateBudgetKb(photos: AppointmentPhoto[]): number
  // sum of (data_url.length / 1.37 / 1024), used by PhotoBlock soft-cap warning
```

Imports `generateId` from `./masters`. No React — pure TS.

---

## 3. `components/appointment/PhotoBlock.tsx` (NEW)

Props:

```
{ photos: AppointmentPhoto[]; readonly: boolean;
  onChange: (next: AppointmentPhoto[]) => void;
  locationId?: string | null; }
```

Local state: `pickerOpen`, `viewerIndex: number | null`, `menuForPhotoId: string | null`.

Layout:
- **Empty + editable** → dashed `w-full h-11` button "Добавить фото" (replaces old placeholder styling at `AppointmentSheet.tsx:500-506`).
- **Non-empty** → horizontal scroll `flex gap-2 overflow-x-auto snap-x` of `72×72` thumbs + trailing dashed "+" tile. Each thumb has `bg` tinted by `kind` (blue=before / emerald=after / slate=other) and a badge "До"/"После".
- **Readonly** → same carousel, no "+" tile, long-press disabled.

Interactions:
- Tap "+" → `setPickerOpen(true)`.
- Tap thumb → `setViewerIndex(i)`.
- Long-press thumb (500ms via `pointerdown` + `setTimeout`) → `setMenuForPhotoId(p.id)`.

Cap guard: on PhotoPicker `onPick`, if `photos.length >= 5` → show inline
warning "Максимум 5 фото на запись" (reuse `bottomWarning` pattern from
`AppointmentSheet.tsx:115`). Also blocks if `estimateBudgetKb(photos) > 4096`.

---

## 4. `components/appointment/PhotoPicker.tsx` (NEW)

Popup sheet with three big buttons "До · работы", "После · работы", "Другое".
On tap → opens a hidden `<input type="file" accept="image/*" capture="environment">`
(one per button) with assigned `kind`. iOS fallback: each button has
`ref` to its own input so we don't dispatch-click a generic one.

Flow:
1. User picks/snaps → `onChange(e.target.files[0])`
2. Calls `compressImage(file, 200)` (awaited with loading spinner).
3. Calls parent `onPick(makePhoto(data_url, kind, locationId))`.

Props: `{ open, onClose, onPick(photo), locationId }`. No own storage state.

---

## 5. `components/appointment/PhotoViewer.tsx` (NEW)

Full-screen overlay (`fixed inset-0 bg-black z-[60]`). Shows `photos[index]`
full-bleed with `object-contain`. Swipe horizontally → next/prev (reuse
touch math from `SwipeableCalendar` — copy the `touchstart`/`touchend`
delta>50px pattern, do NOT import the component; keep it local so we don't
inherit its calendar-only guards). Top bar: close `×`, caption, counter
"2 / 5". Bottom bar (editable only): "Пересохранить как: До / После / Другое".

Props: `{ photos, index, readonly, onClose, onReclassify(id, kind) }`.

---

## 6. `components/appointment/PhotoLongPressMenu.tsx` (NEW)

Small bottom-anchored sheet (~120 px tall) triggered by PhotoBlock's
long-press. Two rows:
- "Пересохранить как …" → opens 3 pills (До / После / Другое).
- "Удалить" → red; confirms inline (second tap within 3 s).

Props: `{ photo, onReclassify(kind), onDelete, onClose }`. Pure
presentational, no persistence.

---

## 7. Integration — `components/appointment/AppointmentSheet.tsx`

1. **Import** `PhotoBlock` and `AppointmentPhoto` type (alongside existing imports at top).
2. **State** after line 111 (`setEventLabel`):
   ```
   const [photos, setPhotos] = useState<AppointmentPhoto[]>(appointment.photos ?? []);
   ```
3. **Reset useEffect** — append at line 150 (after `setAppointmentServices`):
   ```
   setPhotos(appointment.photos ?? []);
   ```
4. **Replace placeholder** at lines 497-508:
   ```
   <PhotoBlock
     photos={photos}
     readonly={!isEditable}
     onChange={setPhotos}
     locationId={locationId}
   />
   ```
   Keep the `px-4 pt-2` wrapper outside for consistency with neighbouring blocks.
5. **`handleCreate`** — both branches: add `photos` to the saved Appointment:
   - Event branch at line 233: add `photos,` above `updated_at`.
   - Work branch at line 286: add `photos,` above `updated_at`.

`isEditable` already exists in-scope (used at line 498). No prop-drilling
required.

---

## 8. Seed / mock data — `app/dashboard/page.tsx:226`

Mock seed at line 226 already uses `photos: []`. No change needed — new
mock appointments stay empty. Only verify the surrounding object keeps
the field at the same position to avoid merge noise.

---

## 9. localStorage budget

- **Per-photo cap:** `validatePhotoSize` re-runs compression if >200 KB
  (handled inside `compressImage` loop, never exposed to UI).
- **Per-appointment cap:** soft 5 photos. Enforced in `PhotoBlock` before
  calling `onPick`. Bypassable only by deleting existing photos.
- **Global cap:** no explicit guard this sprint — rely on per-appointment
  cap ×903 clients ~= ~ <1 GB worst case (out of scope for MVP).

No migration of old records: every pre-sprint appointment has `photos: []`.
New records gain `kind` only because `makePhoto` sets it. Migration hook
in `loadAppointments` covers any stray photo that somehow lacks `kind`.

---

## 10. File checklist

| State | Path |
| --- | --- |
| NEW | `babun-crm/apps/web/src/lib/photos.ts` |
| NEW | `babun-crm/apps/web/src/components/appointment/PhotoBlock.tsx` |
| NEW | `babun-crm/apps/web/src/components/appointment/PhotoPicker.tsx` |
| NEW | `babun-crm/apps/web/src/components/appointment/PhotoViewer.tsx` |
| NEW | `babun-crm/apps/web/src/components/appointment/PhotoLongPressMenu.tsx` |
| MOD | `babun-crm/apps/web/src/lib/appointments.ts` — type (54-59), migration (152-191) |
| MOD | `babun-crm/apps/web/src/components/appointment/AppointmentSheet.tsx` — state (~111), reset (~150), replace placeholder (497-508), `handleCreate` (233, 286) |
| MOD | `babun-crm/apps/web/src/lib/version.ts:6` → `BUILD_VERSION = "v172-photos"` |
| MOD | `babun-crm/apps/web/public/sw.js:3` → `CACHE_VERSION = "babun-v173"` |

Note: `app/dashboard/page.tsx:226` is already `photos: []`; no `BUILD_TAG`
constant exists there — the rule in `CLAUDE.md` maps to `lib/version.ts`
in this repo. `dashboard/page.tsx` reads `BUILD_VERSION`, so a grep
before editing confirms the current import.

---

## 11. Verification

1. `npx tsc --noEmit` from `babun-crm/apps/web` — zero new errors.
2. `npx eslint src` — zero new warnings.
3. Manual QA (iPhone Safari, LAN):
   - Empty appointment → tap "Добавить фото" → До → camera opens → snap →
     thumb appears with blue tint + "До" badge.
   - Repeat with После / Другое.
   - Long-press → "Пересохранить как После" → badge flips.
   - Long-press → "Удалить" → confirm within 3 s → thumb disappears.
   - Reload PWA → photos still present (localStorage).
   - Offline (airplane mode) → add photo → saves fine.
   - Add 6th photo → warning shown, photo not added.

---

## 12. Out of scope (explicitly)

- Cloud upload / Supabase storage → SPRINT-003.
- Share-link to client → SPRINT-002 candidate.
- EXIF rotation fix → add only if QA shows rotated iPhone photos; canvas
  redraw generally flattens orientation on recent iOS.
- Desktop drag-drop → not a design target (phone-first rule).

---

## 13. Estimate

**S** — ~1 day. Code split: `photos.ts` ~120 LOC, `PhotoBlock` ~140 LOC,
`PhotoPicker` ~80 LOC, `PhotoViewer` ~120 LOC, `PhotoLongPressMenu` ~60 LOC,
sheet integration ~10 LOC edits, type + migration ~15 LOC. Total ~545 LOC
new, ~5 LOC modified.

Risk budget: iOS Safari `capture` quirks may need a second QA pass
(+0.5 day if rear-camera doesn't open reliably) — mitigated by keeping
picker copy generic ("Добавить фото") and letting iOS fall back to the
Photos app.
