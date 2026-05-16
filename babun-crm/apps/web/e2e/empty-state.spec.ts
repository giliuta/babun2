/**
 * E2E — Empty-state CTA copy (v516 P0 #2.4)
 *
 * Verifies that the <CalendarEmptyState> button label adapts to the active
 * calendar tab:
 *   - Personal tab  (mode="event")       → «Добавить событие»
 *   - Team tab      (mode="appointment") → «Добавить первую запись»
 *
 * The empty-state hint only appears when appointmentsCount === 0 AND the
 * "babun:hint-calendar-empty-dismissed" localStorage key is not set.
 * We clear localStorage before each test to guarantee a clean slate.
 *
 * NOTE: The shared test account (anubis0027.traf@gmail.com) has existing
 * appointments, so the empty-state banner will NOT appear for that account.
 * These tests require a fresh tenant with zero appointments. Until a
 * test-only tenant factory is available they are marked .skip.
 *
 * TODO: Remove .skip and provide factory credentials once the backend
 *       test-helpers endpoint is built (STORY-XXX).
 */

import { test, expect } from "@playwright/test";

const PERSONAL_TAB_CTA = "Добавить событие";
const TEAM_TAB_CTA = "Добавить первую запись";

// Dismiss-key must match the constant in CalendarEmptyState.tsx.
const DISMISS_KEY = "babun:hint-calendar-empty-dismissed";

test.describe("CalendarEmptyState CTA copy", () => {
  test.skip(
    "personal tab shows «Добавить событие»",
    async ({ page }) => {
      // Setup: log in as a fresh-tenant account (zero appointments).
      // Clear dismiss flag so the hint is visible.
      await page.goto("/dashboard");
      await page.evaluate((key) => localStorage.removeItem(key), DISMISS_KEY);
      await page.reload();

      // Click the personal calendar tab (first tab, labelled with the
      // master's personal_calendar_name or «Мой календарь» fallback).
      // The tab has data-testid="header-team-tab-__personal__".
      await page
        .getByTestId("header-team-tab-__personal__")
        .click();

      // Wait for the empty-state banner to appear.
      await expect(page.getByRole("button", { name: PERSONAL_TAB_CTA })).toBeVisible({
        timeout: 5_000,
      });

      // Assert the team-tab copy is NOT present.
      await expect(page.getByRole("button", { name: TEAM_TAB_CTA })).not.toBeVisible();
    },
  );

  test.skip(
    "team tab shows «Добавить первую запись»",
    async ({ page }) => {
      // Setup: log in as a fresh-tenant account that has at least one team
      // configured (so the team tab exists) but zero appointments.
      await page.goto("/dashboard");
      await page.evaluate((key) => localStorage.removeItem(key), DISMISS_KEY);
      await page.reload();

      // Click the first team tab (id differs per tenant — grab any non-personal tab).
      const teamTab = page
        .locator('[data-testid^="header-team-tab-"]')
        .filter({ hasNot: page.locator('[data-testid="header-team-tab-__personal__"]') })
        .first();

      await teamTab.click();

      await expect(page.getByRole("button", { name: TEAM_TAB_CTA })).toBeVisible({
        timeout: 5_000,
      });

      await expect(page.getByRole("button", { name: PERSONAL_TAB_CTA })).not.toBeVisible();
    },
  );
});
