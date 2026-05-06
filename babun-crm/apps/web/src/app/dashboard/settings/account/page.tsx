// Was the "Аккаунт" hub page with a profile card and four nav rows.
// The four rows moved into the root /dashboard/settings page (under
// the «Личный кабинет» group), and the hero card on top of /settings
// already shows the same identity info as a display element. So this
// route is now a thin redirect — kept so any existing bookmarks or
// in-app deep links land somewhere sensible instead of 404.

import { redirect } from "next/navigation";

export default function AccountSettingsRedirect() {
  redirect("/dashboard/settings");
}
