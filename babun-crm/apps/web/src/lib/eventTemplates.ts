// STORY-056 — apps/web wrapper for event_templates CRUD.
//
// Re-exports the canonical repository from @babun/shared. Components
// in apps/web import from this module so the dashboard's preset chip
// row and the Settings → Шаблоны событий page share one entry point.
// If we ever swap the underlying transport (Edge Function, RPC) only
// this file (and the shared repo) needs to change.

export {
  listEventTemplates,
  createEventTemplate,
  updateEventTemplate,
  deleteEventTemplate,
} from "@babun/shared/db/repositories/event-templates";

export type {
  EventTemplate,
  CreateEventTemplateInput,
  UpdateEventTemplateInput,
} from "@babun/shared/db/repositories/event-templates";

import type { EventTemplate } from "@babun/shared/db/repositories/event-templates";
import type { EventPreset } from "./eventPresets";

// Map a server EventTemplate row to the EventPreset shape the chip
// row consumes. Custom templates always have `isSystem: false`.
export function templateToPreset(t: EventTemplate): EventPreset {
  return {
    id: t.id,
    name: t.name,
    emoji: t.emoji,
    color: t.color,
    durationMin: t.durationMin,
    pushOffsetMin: t.pushOffsetMin,
    isSystem: false,
  };
}
