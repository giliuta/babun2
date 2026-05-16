import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Babun2 E2E tests.
 *
 * Base URL defaults to the production deployment but can be overridden
 * by the BABUN_E2E_BASE_URL environment variable for local dev:
 *
 *   BABUN_E2E_BASE_URL=http://localhost:3001 npx playwright test
 */

export default defineConfig({
  testDir: "./e2e",
  /* Run each spec file in parallel. Individual tests within a file run
     serially by default — important for the state-dependent scenarios. */
  fullyParallel: false,
  /* Fail the build on accidentally-focused tests. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.BABUN_E2E_BASE_URL ?? "https://babun.app",
    /* Headless in CI, headed locally if PWHEADED=1 is set. */
    headless: !process.env.PWHEADED,
    /* Capture on failure only — keeps the test run lean. */
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
    /* Generous timeout — the prod app is server-rendered and may be
       behind Vercel cold-start on the first request. */
    navigationTimeout: 30_000,
    actionTimeout: 10_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* No webServer block: we test against the live prod URL by default.
     For local runs, start `npm run dev` manually and pass the env var. */
});
