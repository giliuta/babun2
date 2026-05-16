/**
 * E2E — Onboarding no-reprompt (v515 P0 #2.3)
 *
 * Verifies that once a tenant has completed onboarding (onboarded_at is set),
 * navigating away from /dashboard and back does NOT show the
 * <FirstRunCalendarChoice> screen («Как будешь пользоваться календарём?»).
 *
 * The shared test account (anubis0027.traf@gmail.com) is a fully onboarded
 * AirFix tenant, so it exercises the post-onboarding guard.
 *
 * For the fresh-tenant path (onboarded_at IS null) we would need a
 * test-only tenant factory. That spec is marked .skip with a TODO.
 */

import { test, expect } from "@playwright/test";

const BASE_CREDS = {
  email: "anubis0027.traf@gmail.com",
  password: "Emergent",
};

const FIRST_RUN_HEADING = "Как будешь пользоваться календарём?";

async function loginAndGoToDashboard(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(BASE_CREDS.email);
  await page.getByTestId("login-password").fill(BASE_CREDS.password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

test.describe("Onboarding no-reprompt", () => {
  test("already-onboarded tenant: no first-run screen on /dashboard after navigation", async ({
    page,
  }) => {
    await loginAndGoToDashboard(page);

    // Navigate away to clients list.
    await page.goto("/dashboard/clients");
    await page.waitForURL(/\/dashboard\/clients/, { timeout: 10_000 });

    // Navigate back to /dashboard.
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });

    // The first-run choice H1 must NOT appear.
    await expect(page.getByRole("heading", { name: FIRST_RUN_HEADING })).not
      .toBeVisible();
  });

  // TODO: Enable once a test-only sign-up + tenant factory endpoint exists
  // so we can create a freshly-registered tenant (onboarded_at = null),
  // walk through the onboarding wizard selecting «Календарь для команды»,
  // and then verify no re-prompt on second /dashboard visit.
  test.skip(
    "fresh tenant: first-run screen shows once then never again",
    async ({ page }) => {
      // 1. Register a brand-new account via /register.
      // 2. Walk through OnboardingWizard, pick «Календарь для команды».
      // 3. Land on /dashboard — no first-run screen (onboarded_at now set).
      // 4. Navigate to /dashboard/clients and back.
      // 5. Assert first-run heading is still absent.
      void page; // suppress unused-var lint until implemented
      throw new Error("Not implemented — needs tenant factory");
    },
  );
});
