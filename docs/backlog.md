# Backlog

Short parked items that don't justify a full STORY file yet. Pick from here when looking for a small win or follow-up.

---

## STORY-045a — Real landing screenshots

**Priority:** low (placeholder works on prod today)
**Origin:** STORY-045 close-out (2026-04-30)
**Owner action:** capture on iPhone PWA, drop PNGs, commit.

Drop 6 screenshots into `babun-crm/apps/web/public/landing/`:

- `hero-iphone.png` — Hero mockup (4:3 or 5:4), referenced by `Hero.tsx`
- `onboarding.png` — HowItWorks step 2, referenced by `HowItWorks.tsx`
- `dashboard.png` — HowItWorks step 3, referenced by `HowItWorks.tsx`
- `calendar.png` — reserved for future Features expansion
- `team.png` — reserved
- `clients.png` — reserved

Until then `LandingImage` falls back to a styled blue block — visible on prod but not broken. No code change required when assets land; the file drop is enough.

---

## STORY-053 — Dashboard contrast cleanup

**Priority:** medium (a11y compliance, no user complaint yet)
**Origin:** STORY-045 G6 audit (2026-04-30) — landing CTAs were darkened to `#1F66D7` to clear Lighthouse contrast; dashboard still uses the lighter `--accent: #3E88F7`.

**Goal:** raise dashboard primary buttons + accent fills to WCAG AA on white.

- Replace `--accent: #3E88F7` with `#1F66D7` in `globals.css` (4.85:1 vs white, passes AA at all sizes).
- Optionally introduce `--accent-hover: #1850A8` to keep the pressed state distinct.
- Audit usage: every `bg-[var(--accent)] text-white` button in dashboard inherits the new tone — primary buttons, FAB, badges, tile chips.
- Smoke test paths: `/dashboard/clients`, calendar week/month views, `/dashboard/finances`, `/dashboard/settings`. Confirm no spots where the new blue clashes with surrounding tints (`--surface-tint-accent` derives from accent and may need recomputing).
- No copy changes; pure CSS token swap.

Out of scope: replacing the brand-blue identity itself. We're tightening the rendering, not redesigning.
