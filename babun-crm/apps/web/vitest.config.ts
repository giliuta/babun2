import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    clearMocks: true,
  },
  css: {
    // Bypass postcss.config.mjs to avoid missing enhanced-resolve in worktree
    postcss: {},
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@babun/shared": path.resolve(__dirname, "../../packages/shared"),
    },
  },
});
