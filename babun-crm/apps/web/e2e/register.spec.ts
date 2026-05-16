/**
 * E2E — Register flow (v520 §3.1)
 *
 * Covers:
 *   - Happy path: fill form, check terms, submit → redirect to /onboarding
 *     OR check-mail screen (depends on whether Supabase "Confirm email" is on).
 *   - Negative: submit button is disabled until the terms checkbox is checked.
 *
 * NOTE: This spec does NOT use the shared test credentials because it tests
 * the registration flow itself. Each real run creates a new Supabase user.
 * For repeatable CI execution you need either:
 *   a) a Supabase service-role key to clean up after each run, or
 *   b) a dedicated test-only sign-up endpoint that auto-deletes its users.
 * Until that infrastructure exists the happy-path test is marked `.skip`.
 * The negative / UI-state test (checkbox gate) can always run.
 */

import { test, expect } from "@playwright/test";

const REGISTER_URL = "/register";

test.describe("Register page", () => {
  test("submit button is disabled without terms checkbox", async ({ page }) => {
    await page.goto(REGISTER_URL);

    // Fill name + email + password — but do NOT check the terms checkbox.
    await page.getByLabel("Ваше имя").fill("Test User");
    await page.getByLabel("Email").fill("test-e2e@example.com");
    await page.getByLabel("Пароль").fill("Password123");

    // The submit button must remain disabled while the checkbox is unchecked.
    const submitBtn = page.getByRole("button", { name: /создать аккаунт/i });
    await expect(submitBtn).toBeDisabled();

    // Checking the box enables the button.
    await page
      .getByLabel(/согласен.*условиями/i)
      .check();

    await expect(submitBtn).toBeEnabled();
  });

  // TODO: Re-enable when a test-only sign-up endpoint / Supabase factory
  // is available so we don't litter production with throwaway accounts.
  test.skip("happy path: fill form and submit → onboarding or check-mail", async ({
    page,
  }) => {
    await page.goto(REGISTER_URL);

    // Generate a unique email so this test does not conflict with prior runs.
    const uniqueEmail = `e2e-register-${Date.now()}@babun-test.dev`;

    await page.getByLabel("Ваше имя").fill("E2E Test User");
    await page.getByLabel("Email").fill(uniqueEmail);
    await page.getByLabel("Пароль").fill("E2eSecure!99");
    await page.getByLabel(/согласен.*условиями/i).check();

    await page.getByRole("button", { name: /создать аккаунт/i }).click();

    // Two valid post-submit outcomes:
    // 1. Supabase "Confirm email" OFF  → session created → redirect to /dashboard
    // 2. Supabase "Confirm email" ON   → no session   → check-mail card appears
    await expect(page).toHaveURL(
      /\/(dashboard|onboarding)/,
      { timeout: 15_000 },
    );
  });
});
