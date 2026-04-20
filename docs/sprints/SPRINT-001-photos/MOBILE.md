# SPRINT-001 — Mobile UX Pre-Flight Findings

**Persona context:** HVAC brigadier on-site, +35°C, one-handed iPhone 14 PWA, LTE flaky, wet palms.
**Severity:** P0 = blocker, P1 = ship-risk, P2 = polish.

---

## 1. Camera access in iOS PWA — P0

- `<input type="file" accept="image/*" capture="environment">` **works** in iOS 17+ standalone PWA, but only if the manifest is served over HTTPS and the PWA has been reinstalled after the web-app-capable meta tag last changed. Existing users must re-add to home screen — document in release note.
- Known quirk: on iOS 17.0–17.2 `capture="environment"` is silently ignored ~5% of the time and the user lands in Photos picker. Not a bug we can fix.
- **Mandatory fallback:** expose two separate buttons `[ Camera ]` and `[ Gallery ]` (brief already says this — confirmed required). Do NOT collapse into one button. Camera button: `capture="environment"`. Gallery button: same input without `capture`.
- On iOS 16 and below in PWA mode, file input is blocked inside service-worker scope after ~30s idle. Force a re-mount of the `<input>` node on each open (use `key={Date.now()}`).

## 2. Thumbnail touch target — P0

- 64×64 thumb satisfies WCAG 2.5.5 (44×44 min) on its own. Problem is spacing: if thumbs sit 8px apart, hit-slop overlaps. Wet fingers miss by 6–10px in field testing.
- **Fix:** keep thumb visual 64×64, wrap in `<button>` with `padding: 6px` so the tap area becomes 76×76. Use `margin: -6px` on the outer container to keep visual gap unchanged. Net result: no visual change, tap area grows 40%.
- Delete/confirm buttons inside thumb overlay must be ≥ 44×44 each, not 32×32 — the overlay pattern is the single biggest miss-tap source on iOS photo grids.

## 3. Long-press vs iOS context menu — P1

- Confirmed conflict: iOS Safari fires native `contextmenu` on `<img>` after ~600ms long-press, offering "Save to Photos / Copy / Share." That pre-empts any custom long-press handler and leaks user data outside the PWA.
- **Fix:** on every `<img>` in the gallery set `onContextMenu={(e) => e.preventDefault()}` **and** CSS `-webkit-touch-callout: none; user-select: none;`. Both are required — preventDefault alone fails on iOS 16.
- For custom long-press menu, use `pointerdown` + 500ms timer + `pointercancel` guard. Do NOT rely on `touchstart` alone (breaks in PWA on iPad).

## 4. Full-screen viewer swipe vs iOS back-swipe — P0

- iPhone Safari + PWA reserves the leftmost ~20px edge for back-swipe. A `pan-x` gallery that starts at `x=0` will either (a) eat the back gesture (users feel trapped) or (b) fight it (janky half-transitions).
- **Fix A (recommended):** inset the swipeable area by 24px from the left edge. Left 24px strip is reserved for back-swipe. Show a thin visual gutter so users understand.
- **Fix B:** if full-bleed is mandatory, detect `touchstart.clientX < 20` and `return` early from the swipe handler, letting the browser handle it.
- Additionally set `overscroll-behavior-x: contain` on the swiper container so rubber-band from adjacent pages doesn't trigger navigation.

## 5. Keyboard occlusion on caption edit — P1

- iOS keyboard is 291px tall on iPhone 14 (portrait). A bottom-docked "Удалить" button at `bottom: 0` will be buried.
- **Fix:** subscribe to `window.visualViewport.resize` and set the action bar's `bottom` to `window.innerHeight - visualViewport.height + safeAreaBottom`. Update on `scroll` too — iOS fires viewport events 2 frames late.
- Do NOT use `position: fixed` alone — iOS ignores it under keyboard. Use `position: absolute` inside a `100dvh` parent with the visualViewport offset.
- Focus trap: when caption input is focused, scroll it into view with `scrollIntoView({ block: "center" })` after a 150ms delay (wait for keyboard animation).

## 6. Compression on 12 MP photo — P0

- `canvas.toDataURL("image/jpeg", 0.6)` on a 4032×3024 iPhone photo blocks the main thread 3–9 seconds on iPhone 12, up to 14s on iPhone XR. Safari kills long tasks at 10s — inconsistent crashes.
- **Fix:** two-step pipeline.
  1. Downscale first via `createImageBitmap(file, { resizeWidth: 1600, resizeQuality: "medium" })` — offloaded to GPU, ~80ms.
  2. Then `OffscreenCanvas` + `convertToBlob({ type: "image/jpeg", quality: 0.6 })` — runs off the main thread.
- For devices without `OffscreenCanvas` (iOS 16.3 and below), fall back to regular canvas but wrap in `requestIdleCallback` with a 200ms budget per frame.
- **UI:** show a blocking spinner with "Сжимаю фото…" and disable the shutter button while processing. Never silently queue — users will re-tap and create duplicates.

## 7. Offline camera + local-only save — P1

- iOS camera works fully offline (no network needed) — no risk there. Risk is perception: users don't know if a photo is synced.
- **MVP is acceptable as local-only**, but the UI must not imply cloud sync. Show a persistent badge on each thumb: `[ На телефоне ]` with a small phone icon. Grey, not green — green reads as "saved to cloud."
- When online sync ships (next sprint), swap the badge to `[ Синхронизировано ]` green. Having the badge slot from day one avoids later UI shift.
- Also: surface a single-line warning on the gallery header when localStorage usage > 70%: `Память почти заполнена — 7 / 10 MB`. Query via `navigator.storage.estimate()`.

## 8. Horizontal thumb scroll — flick vs tap — P1

- Default behavior mixes scroll-start with tap-interpretation — users get "ghost taps" when trying to flick.
- **Fix:** set `touch-action: pan-x` on the scroll container. On each thumb button use `touch-action: manipulation` so iOS doesn't add the 300ms tap-delay.
- Use a 8px movement threshold before converting `pointerdown → pointerup` into a tap. If pointer moves > 8px between down and up, treat as scroll, cancel the tap.
- `scroll-snap-type: x mandatory` plus `scroll-snap-align: start` on each thumb makes one-handed flicking predictable.

## 9. Sun readability of "До" / "После" badges — P1

- At 25 000 lux (direct Mediterranean sun), contrast ratio needs to be ≥ 4.5:1 just to be readable, ≥ 7:1 to be scannable at arm's length.
- Current plan (unconfirmed) likely white text on semi-transparent dark overlay — risk of failing in sun if overlay is < 70% opacity.
- **Spec:**
  - Text: 12px weight 700 (bolder than the "11px bold" you proposed — 11px is below iOS Dynamic Type floor).
  - Background: solid `rgba(0, 0, 0, 0.85)` — no gradient, no blur (blur is expensive and unreadable in sun).
  - Text color: pure white `#FFFFFF` for "До", warm yellow `#FFD700` for "После" (extra differentiation).
  - Position: top-left, 6px inset. Top-right is reserved for the delete/overflow button.
  - Add a 1px `rgba(0,0,0,0.4)` text-shadow — bridges the case when overlay itself is over a white cloud.

## 10. Heat / battery throttle — P2

- Sustained `canvas.toDataURL` plus camera use on a scooter in +35°C will trigger iOS thermal throttling within ~6 shots. Throttled state cuts JS execution ~40%.
- **Fix:** soft-rate-limit compression — after 2 successful compressions, require a 3-second cooldown before the next shot button becomes active. Show a countdown: `Охлаждаюсь… 2с`. Users on scooters tolerate this; they won't tolerate random 2x slowdowns that feel like bugs.
- Monitor `navigator.deviceMemory` — on devices with ≤ 3 GB, cap max stored photos per appointment at 10 instead of 20 (brief says 20; reduce on low-end).

---

## Summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | PWA camera fallback + input remount | P0 |
| 2 | 76×76 tap area via negative margin | P0 |
| 4 | Back-swipe conflict — 24px gutter | P0 |
| 6 | OffscreenCanvas compression | P0 |
| 3 | Suppress native contextmenu | P1 |
| 5 | visualViewport for keyboard | P1 |
| 7 | Local-only sync badge | P1 |
| 8 | touch-action: pan-x + 8px threshold | P1 |
| 9 | 12px bold + solid dark badge | P1 |
| 10 | Thermal cooldown after 2 shots | P2 |

**P0 items must be resolved before code freeze.** P1 items are ship-blockers for AirFix production. P2 is polish for next iteration.
