import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Plan §3.4 — cross-tenant RLS probe template. Verifies that an authenticated
 * AirFix user cannot read tenant-b rows directly via PostgREST.
 *
 * Duplicate this file (and edit the table name + the `eq('tenant_id', ...)`
 * value) for every table that has a `tenant_id` column. Recommended tables:
 *   clients, appointments, crews, finances, sms_templates, brigades, masters,
 *   schedules, expenses, payments, tags, locations, equipment.
 */
test.use({ storageState: "e2e/.auth/airfix.json" });

test("AirFix client cannot read tenant-b clients via PostgREST", async ({
  context,
}) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Extract the session access token from the stored cookies / localStorage.
  // The Supabase auth-helpers cookie name is `sb-<project-ref>-auth-token`.
  const { cookies } = await context.storageState();
  const access = cookies.find(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
  );
  expect(access, "Supabase auth cookie missing — global.setup did not run").toBeTruthy();

  const access_token = JSON.parse(access!.value).access_token as string;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${access_token}` } },
  });

  const { data } = await supabase
    .from("clients")
    .select("id, tenant_id")
    .eq("tenant_id", "tenant-b");

  // RLS must strip every row.
  expect(data).toEqual([]);
});
