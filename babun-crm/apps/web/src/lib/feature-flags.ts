// Feature flags — flip to re-enable parked features. We keep the code
// paths intact behind a flag instead of deleting them, so turning a
// feature back on is a one-line edit, not a re-implementation.

// Personal calendar («Мой календарь»). Parked in v792 at the owner's
// request — hidden from the calendar tab strip and the Settings →
// Календарь toggle until it's fully designed. All personal-mode code
// paths are preserved (just unreached while this is false). Re-enable
// by flipping to `true`; no other change needed.
export const PERSONAL_CALENDAR_ENABLED = false;
