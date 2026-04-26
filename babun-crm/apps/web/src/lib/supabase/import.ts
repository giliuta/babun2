"use client";

// localStorage → Supabase one-way import.
//
// When AirFix (or any tenant) first signs in to the Supabase-backed
// build, their data is still on the device's localStorage. This module
// drains it into the authenticated tenant's Supabase rows.
//
// Order matters because of foreign keys:
//
//   tenants  ← already created by the signup trigger
//   masters  → teams  (masters.team_id FK, teams.lead_id FK — chicken/egg,
//              so we insert masters first with team_id=null, teams
//              second, then patch masters.team_id)
//   client_tags → clients
//   service_categories → services
//   appointments (FKs on clients, teams, service_categories, services)
//   sms_templates, expense_categories (independent)
//   ledger_entries (depends on teams)
//
// Each entity gets a fresh uuid on insert; a per-entity `Map<oldId,newId>`
// translates foreign-key references on subsequent batches.
//
// The import is idempotent *per run* (fails fast on any Supabase error;
// if half a run succeeded, the caller must truncate and retry). A
// nicer "upsert on legacy_id" version is deferred to the next sprint.

import type { Supabase } from "./client";
import { loadAppointments } from "@babun/shared/local/appointments";
import { loadClients, loadClientTags } from "@babun/shared/local/clients";
import { loadMasters, loadTeams } from "@babun/shared/local/masters";
import { loadServices, loadCategories as loadServiceCategories } from "@babun/shared/local/services";
import { loadTemplates as loadSmsTemplates } from "@babun/shared/local/sms-templates";

export interface ImportProgress {
  stage: string;
  done: number;
  total: number;
}

export interface ImportResult {
  ok: boolean;
  imported: Record<string, number>;
  error?: string;
}

type IdMap = Map<string, string>;

// Browser crypto.randomUUID is Node 19+ / all evergreen browsers. We
// guard it so SSR prerender never trips over an absent impl.
function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // Deterministic-ish fallback — only used in tests on old runtimes.
  return `imp-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

// Generic TypeScript doesn't buy us anything across the Supabase client
// boundary here — the typed `.insert()` overloads expect the exact Row
// shape for each table and each entity's row is assembled with a
// different field set. We cast the client to `any` for the write, keep
// the legacy-id-to-new-uuid translation map typed, and accept that
// field correctness is verified at runtime (the migration is a one-
// shot, low-volume operation).

async function insertAndMap(
  sb: Supabase,
  table: string,
  rows: { legacyId: string; row: Record<string, unknown> }[]
): Promise<IdMap> {
  const map: IdMap = new Map();
  if (rows.length === 0) return map;
  const payload = rows.map(({ legacyId, row }) => {
    const id = newUuid();
    map.set(legacyId, id);
    return { ...row, id };
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).from(table).insert(payload);
  if (error) throw new Error(`${table}: ${error.message}`);
  return map;
}

export async function importLocalStorageIntoTenant(
  sb: Supabase,
  tenantId: string,
  onProgress?: (p: ImportProgress) => void
): Promise<ImportResult> {
  const imported: Record<string, number> = {};

  try {
    // Snapshots from localStorage.
    const lsMasters = loadMasters();
    const lsTeams = loadTeams();
    const lsClientTags = loadClientTags();
    const lsClients = loadClients();
    const lsServiceCategories = loadServiceCategories();
    const lsServices = loadServices();
    const lsAppointments = loadAppointments();
    const lsSmsTemplates = loadSmsTemplates();

    onProgress?.({ stage: "masters", done: 0, total: lsMasters.length });

    const masterMap = await insertAndMap(
      sb,
      "masters",
      lsMasters.map((m) => ({
        legacyId: m.id,
        row: {
          tenant_id: tenantId,
          full_name: m.full_name,
          phone: m.phone ?? null,
          avatar_url: m.avatar_url ?? null,
          team_id: null, // patched after teams land
          role: m.role,
          is_active: m.is_active,
          permissions: m.permissions as unknown as Record<string, unknown>,
          created_at: m.created_at,
        },
      }))
    );
    imported.masters = masterMap.size;

    onProgress?.({ stage: "teams", done: 0, total: lsTeams.length });

    const teamMap = await insertAndMap(
      sb,
      "teams",
      lsTeams.map((t) => ({
        legacyId: t.id,
        row: {
          tenant_id: tenantId,
          name: t.name,
          region: t.region ?? null,
          color: t.color,
          default_city: t.default_city ?? null,
          lead_id: t.lead_id ? masterMap.get(t.lead_id) ?? null : null,
          helper_ids: t.helper_ids
            .map((id) => masterMap.get(id))
            .filter((v): v is string => Boolean(v)),
          payout_percentage: t.payout_percentage,
          active: t.active,
          created_at: t.created_at,
        },
      }))
    );
    imported.teams = teamMap.size;

    // Patch masters.team_id now that teams exist. Cast via `any` —
    // same reason as insertAndMap: the migration tool is a trusted
    // one-shot script and the typed update signature rejects our
    // cross-entity assembly.
    for (const m of lsMasters) {
      if (!m.team_id) continue;
      const newMasterId = masterMap.get(m.id);
      const newTeamId = teamMap.get(m.team_id);
      if (!newMasterId || !newTeamId) continue;
      const { error } = await (sb as unknown as {
        from: (t: string) => {
          update: (v: Record<string, unknown>) => {
            eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      })
        .from("masters")
        .update({ team_id: newTeamId })
        .eq("id", newMasterId);
      if (error) throw new Error(`masters.team_id: ${error.message}`);
    }

    onProgress?.({
      stage: "client_tags",
      done: 0,
      total: lsClientTags.length,
    });

    const tagMap = await insertAndMap(
      sb,
      "client_tags",
      lsClientTags.map((t) => ({
        legacyId: t.id,
        row: {
          tenant_id: tenantId,
          name: t.name,
          color: t.color,
        },
      }))
    );
    imported.client_tags = tagMap.size;

    onProgress?.({ stage: "clients", done: 0, total: lsClients.length });

    const clientMap = await insertAndMap(
      sb,
      "clients",
      lsClients.map((c) => ({
        legacyId: c.id,
        row: {
          tenant_id: tenantId,
          full_name: c.full_name,
          phone: c.phone || null,
          phones: c.phones as unknown as Record<string, unknown>[],
          whatsapp_phone: c.whatsapp_phone || null,
          email: c.email || null,
          sms_name: c.sms_name || null,
          telegram_username: c.telegram_username || null,
          instagram_username: c.instagram_username || null,
          balance: c.balance,
          discount: c.discount,
          comment: c.comment || null,
          tag_ids: c.tag_ids
            .map((id) => tagMap.get(id))
            .filter((v): v is string => Boolean(v)),
          acquisition_source: c.acquisition_source,
          referred_by_client_id: null, // patched later via second pass if needed
          first_contact_date: c.first_contact_date || null,
          address: c.address || null,
          city: c.city || null,
          property_type: c.property_type || null,
          equipment: c.equipment as unknown as Record<string, unknown>[],
          locations: c.locations as unknown as Record<string, unknown>[],
          notes: c.notes as unknown as Record<string, unknown>[],
          birthday: c.birthday || null,
          blacklisted: c.blacklisted,
          created_at: c.created_at,
        },
      }))
    );
    imported.clients = clientMap.size;

    onProgress?.({
      stage: "service_categories",
      done: 0,
      total: lsServiceCategories.length,
    });

    const catMap = await insertAndMap(
      sb,
      "service_categories",
      lsServiceCategories.map((c) => ({
        legacyId: c.id,
        row: {
          tenant_id: tenantId,
          name: c.name,
          color: c.color ?? null,
          sort: 0,
        },
      }))
    );
    imported.service_categories = catMap.size;

    onProgress?.({ stage: "services", done: 0, total: lsServices.length });

    const svcMap = await insertAndMap(
      sb,
      "services",
      lsServices.map((s) => ({
        legacyId: s.id,
        row: {
          tenant_id: tenantId,
          category_id: s.category_id ? catMap.get(s.category_id) ?? null : null,
          name: s.name,
          duration_minutes: s.duration_minutes,
          price: s.price,
          color: s.color ?? null,
          available_weekdays: s.available_weekdays ?? [],
          online_enabled: s.online_enabled ?? true,
          material_costs: (s.material_costs ?? []) as unknown as Record<string, unknown>[],
          is_active: s.is_active ?? true,
          bulk_threshold: s.bulk_threshold ?? 0,
          bulk_price: s.bulk_price ?? 0,
          cost_per_unit: s.cost_per_unit ?? 0,
          is_countable: s.is_countable ?? true,
          brigade_ids: [], // brigade_ids were legacy text ids; reset on import
        },
      }))
    );
    imported.services = svcMap.size;

    onProgress?.({
      stage: "appointments",
      done: 0,
      total: lsAppointments.length,
    });

    const aptMap = await insertAndMap(
      sb,
      "appointments",
      lsAppointments.map((a) => ({
        legacyId: a.id,
        row: {
          tenant_id: tenantId,
          client_id: a.client_id ? clientMap.get(a.client_id) ?? null : null,
          location_id: a.location_id ?? null,
          team_id: a.team_id ? teamMap.get(a.team_id) ?? null : null,
          service_ids: a.service_ids
            .map((id) => svcMap.get(id))
            .filter((v): v is string => Boolean(v)),
          date: a.date,
          time_start: a.time_start,
          time_end: a.time_end,
          total_amount: a.total_amount,
          custom_total: a.custom_total,
          discount_amount: a.discount_amount ?? 0,
          prepaid_amount: a.prepaid_amount ?? 0,
          services: (a.services ?? []) as unknown as Record<string, unknown>[],
          global_discount: (a.global_discount ?? null) as unknown as Record<string, unknown> | null,
          service_price_overrides: (a.service_price_overrides ??
            {}) as unknown as Record<string, unknown>,
          expenses: (a.expenses ?? []) as unknown as Record<string, unknown>[],
          payments: (a.payments ?? []) as unknown as Record<string, unknown>[],
          payment: (a.payment ?? null) as unknown as Record<string, unknown> | null,
          total_duration: a.total_duration ?? 0,
          color_override: a.color_override ?? null,
          comment: a.comment ?? null,
          address: a.address ?? null,
          address_note: a.address_note ?? null,
          address_lat: a.address_lat,
          address_lng: a.address_lng,
          source: a.source ?? null,
          is_online_booking: a.is_online_booking ?? false,
          kind: a.kind,
          status: a.status,
          photos: (a.photos ?? []) as unknown as Record<string, unknown>[],
          consent_given: a.consent_given ?? true,
          reminder_enabled: a.reminder_enabled ?? false,
          reminder_offsets: a.reminder_offsets ?? [1440, 60],
          reminder_template: a.reminder_template ?? null,
        },
      }))
    );
    imported.appointments = aptMap.size;

    onProgress?.({
      stage: "sms_templates",
      done: 0,
      total: lsSmsTemplates.length,
    });

    const smsMap = await insertAndMap(
      sb,
      "sms_templates",
      lsSmsTemplates.map((t) => ({
        legacyId: t.id,
        row: {
          tenant_id: tenantId,
          kind: t.kind,
          name: t.name,
          body: t.body,
          enabled: t.enabled ?? true,
        },
      }))
    );
    imported.sms_templates = smsMap.size;

    onProgress?.({ stage: "done", done: 1, total: 1 });

    return { ok: true, imported };
  } catch (err) {
    return {
      ok: false,
      imported,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
