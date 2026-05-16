import { Page, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Plan §3.5 — axe-core scan helper. Use in every page E2E:
 *
 *   import { expectNoA11yViolations } from "../a11y.helpers";
 *   await expectNoA11yViolations(page, "main");
 *
 * Fails on any `critical` or `serious` violation. Use scope to limit to a
 * specific subtree (e.g. an open dialog).
 */
export async function expectNoA11yViolations(page: Page, scope?: string) {
  const builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
  ]);
  if (scope) builder.include(scope);
  const results = await builder.analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
}
