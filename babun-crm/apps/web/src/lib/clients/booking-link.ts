// v813 — pre-aimed booking deep-link builder for the client card.
//
// Every «Записать» entry point on the card (NEXT-JOB hero, per-unit
// «Записать ТО», per-object «Записать сюда», the quick-action) routes to
// /dashboard?new=1 carrying the client, the chosen object, and the
// brigade so the AppointmentSheet opens pre-filled. The dashboard's
// ?new= handler (app/dashboard/page.tsx) reads location_id + team_id.
//
// Keep this in sync with that handler's param names.

export interface BookingLinkOptions {
  clientId: string;
  /** Object to pre-select; omitted → AppointmentSheet picks the default. */
  locationId?: string | null;
  /** Brigade to pre-select; omitted → handler falls back to activeTeamId. */
  teamId?: string | null;
  /** Service ids to seed (e.g. «Повторить»); empty → none. */
  serviceIds?: string[];
  /** YYYY-MM-DD to pre-fill; omitted → today. */
  date?: string | null;
}

export function buildBookingHref(opts: BookingLinkOptions): string {
  const p = new URLSearchParams();
  p.set("new", "1");
  p.set("kind", "work");
  p.set("client_id", opts.clientId);
  if (opts.locationId) p.set("location_id", opts.locationId);
  if (opts.teamId) p.set("team_id", opts.teamId);
  if (opts.serviceIds && opts.serviceIds.length > 0) {
    p.set("services", opts.serviceIds.join(","));
  }
  if (opts.date) p.set("date", opts.date);
  return `/dashboard?${p.toString()}`;
}
