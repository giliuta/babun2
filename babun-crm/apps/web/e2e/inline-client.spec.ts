/**
 * E2E — Inline-client create (v514 P0 #2.2)
 *
 * Verifies that a client created through the «+ Новый клиент» flow inside
 * AppointmentSheet persists and immediately appears in /dashboard/clients.
 *
 * Auth: uses the shared AirFix test account (anubis0027.traf@gmail.com).
 *
 * Known limitation: this test taps a calendar cell which requires at least
 * one visible day column. The prod account has existing appointments so the
 * calendar renders. If you run against a pristine tenant the cell click may
 * hit the <CalendarEmptyState> banner instead of opening the sheet — in that
 * case extend the setup fixture to create a team first.
 */

import { test, expect } from "@playwright/test";

const BASE_CREDS = {
  email: "anubis0027.traf@gmail.com",
  password: "Emergent",
};

/** Log in via the /login page and land on /dashboard. */
async function loginAndGoToDashboard(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(BASE_CREDS.email);
  await page.getByTestId("login-password").fill(BASE_CREDS.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

test.describe("Inline-client create from AppointmentSheet", () => {
  test("new client appears in /dashboard/clients after inline creation", async ({
    page,
    context,
  }) => {
    await loginAndGoToDashboard(page);

    // Click the first visible empty calendar cell to open the action menu.
    // DayColumn grid cells have data-testid="calendar-day-grid-YYYY-MM-DD".
    // We grab the first one and click a point in it that should be empty.
    const gridCell = page.locator('[data-testid^="calendar-day-grid-"]').first();
    await gridCell.click({ position: { x: 10, y: 30 } });

    // Wait for the action menu to appear and choose «Создать запись».
    const actionMenu = page.getByTestId("action-menu");
    await expect(actionMenu).toBeVisible({ timeout: 5_000 });

    // Pick the first option — normally "Создать запись" for a team tab.
    await page.getByTestId("action-menu-option-0").click();

    // AppointmentSheet opens. Now click «Выбрать клиента» to open the
    // client picker (ClientBlock renders a dashed button in empty state).
    await page.getByText("Выбрать клиента").click();

    // CreateClientModal opens — click «+ Новый клиент» tab if not already there.
    // The modal already opens on "new" tab by default, but guard anyway.
    const newTabBtn = page.getByRole("button", { name: /новый/i });
    if (await newTabBtn.isVisible()) {
      await newTabBtn.click();
    }

    // Fill name + phone.
    const uniqueName = `E2E Client ${Date.now()}`;
    await page.getByTestId("create-client-name").fill(uniqueName);
    await page.getByTestId("create-client-phone").fill("+35799000000");

    // Submit — button label is «Создать и привязать».
    await page.getByTestId("create-client-save").click();

    // Modal should close (gone from DOM) and control returns to AppointmentSheet.
    await expect(page.getByTestId("create-client-save")).not.toBeVisible({
      timeout: 5_000,
    });

    // Open /dashboard/clients in a new tab and assert the row is present.
    const clientsPage = await context.newPage();
    await clientsPage.goto("/dashboard/clients");
    await expect(clientsPage.getByText(uniqueName)).toBeVisible({
      timeout: 10_000,
    });
    await clientsPage.close();
  });
});
