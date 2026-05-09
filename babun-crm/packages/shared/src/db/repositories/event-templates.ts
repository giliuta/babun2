// Event templates repository — STORY-056.
//
// Custom event presets that show up after the 6 hard-coded
// SYSTEM_PRESETS in the unified EventSheet. Per-user privacy via
// the BEFORE INSERT trigger that fills `created_by` from auth.uid()
// + RLS policies that gate every operation on `created_by =
// auth.uid()`. The TS layer never sends `created_by` explicitly.
//
// System presets are NOT persisted here — they live as constants in
// `apps/web/src/lib/eventPresets.ts`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

type DbSupabase = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["event_templates"]["Row"];
type Insert = Database["public"]["Tables"]["event_templates"]["Insert"];
type Update = Database["public"]["Tables"]["event_templates"]["Update"];

export interface EventTemplate {
  id: string;
  name: string;
  emoji: string | null;
  color: string;
  durationMin: number;
  pushOffsetMin: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventTemplateInput {
  name: string;
  emoji: string | null;
  color: string;
  durationMin: number;
  pushOffsetMin: number | null;
  sortOrder?: number;
}

export type UpdateEventTemplateInput = Partial<CreateEventTemplateInput>;

function rowToTemplate(r: Row): EventTemplate {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    durationMin: r.duration_min,
    pushOffsetMin: r.push_offset_min,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function inputToInsert(tenantId: string, input: CreateEventTemplateInput): Insert {
  return {
    tenant_id: tenantId,
    name: input.name,
    emoji: input.emoji,
    color: input.color,
    duration_min: input.durationMin,
    push_offset_min: input.pushOffsetMin,
    sort_order: input.sortOrder ?? 0,
  };
}

function inputToUpdate(input: UpdateEventTemplateInput): Update {
  const out: Update = {};
  if (input.name !== undefined) out.name = input.name;
  if (input.emoji !== undefined) out.emoji = input.emoji;
  if (input.color !== undefined) out.color = input.color;
  if (input.durationMin !== undefined) out.duration_min = input.durationMin;
  if (input.pushOffsetMin !== undefined) out.push_offset_min = input.pushOffsetMin;
  if (input.sortOrder !== undefined) out.sort_order = input.sortOrder;
  return out;
}

/** All custom presets visible to the current user, sorted by
 *  sort_order ascending then created_at ascending. RLS filters to
 *  `created_by = auth.uid()` so the explicit tenant filter below is
 *  belt-and-braces — also pins the query to the index. */
export async function listEventTemplates(
  supabase: DbSupabase,
  tenantId: string,
): Promise<EventTemplate[]> {
  const { data, error } = await supabase
    .from("event_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`listEventTemplates: ${error.message}`);
  return (data ?? []).map(rowToTemplate);
}

export async function createEventTemplate(
  supabase: DbSupabase,
  tenantId: string,
  input: CreateEventTemplateInput,
): Promise<EventTemplate> {
  const { data, error } = await supabase
    .from("event_templates")
    .insert(inputToInsert(tenantId, input))
    .select("*")
    .single();
  if (error) throw new Error(`createEventTemplate: ${error.message}`);
  return rowToTemplate(data);
}

export async function updateEventTemplate(
  supabase: DbSupabase,
  id: string,
  input: UpdateEventTemplateInput,
): Promise<EventTemplate> {
  const { data, error } = await supabase
    .from("event_templates")
    .update(inputToUpdate(input))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`updateEventTemplate: ${error.message}`);
  return rowToTemplate(data);
}

export async function deleteEventTemplate(
  supabase: DbSupabase,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("event_templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(`deleteEventTemplate: ${error.message}`);
}
