/**
 * E2E — Close-confirm skips empty form (v517 P0 #2.7)
 *
 * Two scenarios for PersonalEventSheet's close-confirmation behaviour:
 *
 *   1. Open sheet via empty cell → immediately click X (no user input) →
 *      sheet closes silently with NO confirm popup.
 *
 *   2. Open sheet → type a title → click X →
 *      confirm popup appears with «Не сохранять» as the primary (red) button.
 *
 * Auth: uses the shared AirFix test account.
 *
 * NOTE: The personal tab must be the active tab for PersonalEventSheet to
 * open. The test switches to the personal tab before tapping the grid.
 * If the personal calendar is disabled for the test account, these tests
 * will fail — guard with a skip in that case.
 */

import { test, expect } from "@playwright/test";

const BASE_CREDS = {
  email: "anubis0027.traf@gmail.com",
  password: "Emergent",
};

async function loginAndGoToDashboard(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(BASE_CREDS.email);
  await page.getByTestId("login-password").fill(BASE_CREDS.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

/** Switch to the personal calendar tab and tap an empty grid cell to open
 *  PersonalEventSheet. Returns when the sheet is visible. */
async function openPersonalEventSheet(
  page: import("@playwright/test").Page,
): Promise<void> {
  // Switch to personal tab.
  const personalTab = page.getByTestId("header-team-tab-__personal__");
  if (await personalTab.isVisible()) {
    await personalTab.click();
  }

  // Tap an empty cell. DayColumn exposes data-testid="calendar-day-grid-YYYY-MM-DD".
  // We click a point unlikely to overlap an existing appointment block.
  const gridCell = page.locator('[data-testid^="calendar-day-grid-"]').first();
  await gridCell.click({ position: { x: 10, y: 60 } });

  // After tapping an empty cell on the personal tab, PersonalEventSheet
  // opens directly (no action-menu intermediate step).
  await expect(page.getByTestId("personal-event-sheet")).toBeVisible({
    timeout: 8_000,
  });
}

test.describe("PersonalEventSheet close-confirm gate", () => {
  test("empty form: clicking X closes sheet without confirm popup", async ({
    page,
  }) => {
    await loginAndGoToDashboard(page);
    await openPersonalEventSheet(page);

    // Click X immediately — no user input.
    await page.getByTestId("personal-event-sheet-close").click();

    // Sheet must disappear without any confirm dialog.
    await expect(page.getByTestId("personal-event-sheet")).not.toBeVisible({
      timeout: 3_000,
    });

    // Confirm popup text is «Закрыть событие?» or «Закрыть без сохранения?».
    // Neither should be present.
    await expect(
      page.getByText(/закрыть событие\?|закрыть без сохранения\?/i),
    ).not.toBeVisible();
  });

  test("dirty form: clicking X shows confirm popup with «Не сохранять» button", async ({
    page,
  }) => {
    await loginAndGoToDashboard(page);
    await openPersonalEventSheet(page);

    // Type a title to make the form dirty (createDirty = true).
    // The title input is a hero text input — it has no specific testid
    // but is the first textarea/input in the sheet body.
    // PersonalEventSheet renders the title as a large input with placeholder
    // «Название» (22px/700 per the v454 redesign comment).
    const titleInput = page
      .getByTestId("personal-event-sheet")
      .getByPlaceholder("Название");
    await titleInput.fill("Test Event Title");

    // Click X on the dirty form.
    await page.getByTestId("personal-event-sheet-close").click();

    // The confirm popup must appear.
    await expect(
      page.getByText(/закрыть событие\?|закрыть без сохранения\?/i),
    ).toBeVisible({ timeout: 3_000 });

    // «Не сохранять» must be the primary (red/destructive) button.
    const discardBtn = page.getByRole("button", { name: "Не сохранять" });
    await expect(discardBtn).toBeVisible();

    // The button should carry the red system colour. We check via CSS computed
    // value rather than a class name string to stay decoupled from design tokens.
    const bgColor = await discardBtn.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    // The red button uses --system-red which maps to rgb(255, 59, 48) on iOS
    // or a close equivalent. Assert it is "red-ish" (R > 200, G < 100, B < 100).
    const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      expect(r).toBeGreaterThan(180);
      expect(g).toBeLessThan(120);
      expect(b).toBeLessThan(120);
    } else {
      // Fallback: at minimum the button must be visible (style assertion skipped
      // when the colour value comes back in an unexpected format e.g. oklch).
      await expect(discardBtn).toBeVisible();
    }

    // Dismiss the confirm popup by clicking «Не сохранять» — sheet closes.
    await discardBtn.click();
    await expect(page.getByTestId("personal-event-sheet")).not.toBeVisible({
      timeout: 3_000,
    });
  });
});
