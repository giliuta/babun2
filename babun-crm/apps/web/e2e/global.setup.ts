import { test as setup } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Plan §3.3 — provision two distinct tenants via service-role and persist
 * authenticated storage state for both. Required env:
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   E2E_TEST_PASSWORD
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "global.setup.ts: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
  );
}
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function provisionTenant(slug: string, email: string) {
  const {
    data: { users },
  } = await admin.auth.admin.listUsers();
  let user = users.find((u) => u.email === email);
  if (!user) {
    const { data } = await admin.auth.admin.createUser({
      email,
      password: process.env.E2E_TEST_PASSWORD!,
      email_confirm: true,
      app_metadata: { tenant_id: slug },
    });
    user = data.user!;
  } else {
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { tenant_id: slug },
    });
  }
  return user;
}

setup("seed and login both tenants", async ({ browser }) => {
  await provisionTenant("airfix", "airfix-e2e@babun.app");
  await provisionTenant("tenant-b", "tenant-b-e2e@babun.app");

  const tenants = [
    ["airfix", "airfix-e2e@babun.app"],
    ["tenant-b", "tenant-b-e2e@babun.app"],
  ] as const;

  for (const [name, email] of tenants) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/пароль/i).fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole("button", { name: /войти/i }).click();
    await page.waitForURL("/dashboard");
    await ctx.storageState({ path: `e2e/.auth/${name}.json` });
    await ctx.close();
  }
});
