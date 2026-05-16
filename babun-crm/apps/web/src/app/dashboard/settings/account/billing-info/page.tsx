// Brief 2 #9 («Мой календарь + Настройки»): merged into /settings/company.
//
// The old placeholder at this URL was a marketing card pointing the
// user manually at /dashboard/settings/company — one click of busywork.
// «Счёт компании» and «Реквизиты компании» are the same form for the
// same data; collapsing the two pages removes the dead-end. Server-side
// redirect preserves bookmarks and the settings-menu link below has been
// updated to point at /settings/company directly.

import { redirect } from "next/navigation";

export default function BillingInfoPage() {
  redirect("/dashboard/settings/company");
}
