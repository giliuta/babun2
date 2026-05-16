import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    clearMocks: true,
    // Exclude Playwright E2E specs — they use @playwright/test, not vitest.
    exclude: ["node_modules", "e2e/**"],
  },
  css: {
    // Bypass postcss.config.mjs to avoid missing enhanced-resolve in worktree
    postcss: {},
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // v512 — point at packages/shared/src so subpath imports
      // (@babun/shared/local/X, @babun/shared/common/X, etc) resolve
      // to the actual TS source files. The previous alias targeted
      // the package root, which left vitest looking for files at
      // packages/shared/local/X.ts (no /src/) and failing-on-import
      // for compute/expenses/payroll/reconciliations/notifications.
      "@babun/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
