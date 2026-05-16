import { defineConfig, devices } from "@playwright/test";

/**
 * Babun autopilot Playwright config (plan §3.2).
 * Adapted to npm per docs/AUTOPILOT_DEVIATIONS.md D-001.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined, // Supabase connection limits
  reporter: [["html", { open: "never" }], ["github"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: process.env.VERCEL_BYPASS_TOKEN
      ? { "x-vercel-protection-bypass": process.env.VERCEL_BYPASS_TOKEN }
      : {},
  },
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3001",
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"], storageState: "e2e/.auth/airfix.json" },
      dependencies: ["setup"],
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 14"], storageState: "e2e/.auth/airfix.json" },
      dependencies: ["setup"],
    },
    {
      name: "rls-cross-tenant",
      testMatch: /security\/rls\/.*\.spec\.ts/,
      use: { storageState: "e2e/.auth/tenant-b.json" },
      dependencies: ["setup"],
    },
  ],
});
