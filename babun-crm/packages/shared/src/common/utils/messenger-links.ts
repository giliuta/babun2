// Helpers for building WhatsApp / Telegram / Instagram deep links from a
// contact's phone and handles. All functions return `null` when there is
// not enough data to build a working link, so callers can hide the
// corresponding button.

function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? "").replace(/[^0-9]/g, "");
}

function stripAt(handle: string | null | undefined): string {
  return (handle ?? "").replace(/^@+/, "").trim();
}

export function whatsappUrl(phone: string | null | undefined): string | null {
  const digits = phoneDigits(phone);
  if (digits.length < 6) return null;
  return `https://wa.me/${digits}`;
}

// Telegram: prefer @username, fall back to tg://resolve by phone.
// t.me links for a phone number only work if the user has a public
// username — the phone fallback uses the mobile deep-link scheme which
// Safari on iOS honours when Telegram is installed.
export function telegramUrl(
  username: string | null | undefined,
  phone: string | null | undefined
): string | null {
  const uname = stripAt(username);
  if (uname) return `https://t.me/${uname}`;
  const digits = phoneDigits(phone);
  if (digits.length < 6) return null;
  return `https://t.me/+${digits}`;
}

export function instagramUrl(username: string | null | undefined): string | null {
  const uname = stripAt(username);
  if (!uname) return null;
  return `https://instagram.com/${uname}`;
}

export function telUrl(phone: string | null | undefined): string | null {
  const digits = phoneDigits(phone);
  if (digits.length < 3) return null;
  return `tel:${digits}`;
}
