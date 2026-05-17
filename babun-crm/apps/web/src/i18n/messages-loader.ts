// Dynamic message loader — imports only the JSON for the active locale.
// Keeps the other locale's bundle out of the initial JS chunk.

import type { Locale } from "./locale";

/** Load translation messages for the given locale. */
export async function loadMessages(
  locale: Locale
): Promise<Record<string, unknown>> {
  if (locale === "en") {
    return (await import("../../messages/en.json")).default as Record<
      string,
      unknown
    >;
  }
  return (await import("../../messages/ru.json")).default as Record<
    string,
    unknown
  >;
}
