import { useCallback } from "react";
import type { Appointment } from "@babun/shared/local/appointments";
import { useThemeColors, type ThemeColors } from "@/theme/colors";

// Colors for a calendar appointment block, resolved from the «Halo Cobalt»
// theme so they flip light↔dark. Mirrors the web calendar's intent: the FILL
// is status-tinted, the left STRIPE carries identity (override → team → status).
export type BlockColors = { stripe: string; fill: string; base: string };

function statusColor(t: ThemeColors, status: Appointment["status"]): string {
  switch (status) {
    case "completed":
      return t.success;
    case "in_progress":
      return t.warning;
    case "cancelled":
      return t.faint;
    default:
      return t.accent; // scheduled
  }
}

// Returns a resolver so callers can also pass a team-color lookup (the stripe
// prefers the team/override hue, matching «this one's brigade Y, this one's X»).
export function useBlockColors(
  teamColorFor?: (a: Appointment) => string | null,
) {
  const t = useThemeColors();
  return useCallback(
    (apt: Appointment): BlockColors => {
      const base = statusColor(t, apt.status);
      const stripe =
        (apt.color_override as string | null | undefined) ||
        (teamColorFor ? teamColorFor(apt) : null) ||
        base;
      // ~12% (light) / ~18% (dark) tint over the surface.
      const fill = `${base}${t.dark ? "2e" : "1f"}`;
      return { stripe, fill, base };
    },
    [t, teamColorFor],
  );
}
