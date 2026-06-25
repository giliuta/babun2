import { Text, View } from "react-native";
import type { AppointmentStatus } from "@babun/shared/local/appointments";

export type BadgeVariant =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "paid"
  | "partial"
  | "unpaid"
  | "refunded"
  | "neutral"
  | "brand"
  | "success"
  | "danger"
  | "warning";

// Centralized pill styling — one opacity scale, no per-call hardcoding.
const MAP: Record<BadgeVariant, string> = {
  scheduled: "bg-brand/10 text-brand",
  in_progress: "bg-warning/15 text-amber-700",
  completed: "bg-success/15 text-success",
  cancelled: "bg-neutral-100 text-neutral-500",
  paid: "bg-success/15 text-success",
  partial: "bg-warning/15 text-amber-700",
  unpaid: "bg-neutral-100 text-neutral-500",
  refunded: "bg-neutral-100 text-neutral-500",
  neutral: "bg-neutral-100 text-neutral-600",
  brand: "bg-brand/10 text-brand",
  success: "bg-success/15 text-success",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/15 text-amber-700",
};

export function Badge({
  label,
  variant = "neutral",
  color,
}: {
  label: string;
  variant?: BadgeVariant;
  /** Dynamic hue (e.g. tag color) — overrides variant with a tinted pill. */
  color?: string;
}) {
  if (color) {
    return (
      <View
        className="self-start rounded-full px-2 py-0.5"
        style={{ backgroundColor: `${color}22` }}
      >
        <Text className="text-[11px] font-semibold" style={{ color }}>
          {label}
        </Text>
      </View>
    );
  }
  return (
    <Text
      className={`self-start overflow-hidden rounded-full px-2 py-0.5 text-[11px] font-semibold ${MAP[variant]}`}
    >
      {label}
    </Text>
  );
}

// Appointment status → RU label + variant. Single source for the calendar,
// client visits block, and appointment sheet.
export const APPT_STATUS: Record<
  AppointmentStatus,
  { label: string; variant: BadgeVariant }
> = {
  scheduled: { label: "Запланировано", variant: "scheduled" },
  in_progress: { label: "В работе", variant: "in_progress" },
  completed: { label: "Выполнено", variant: "completed" },
  cancelled: { label: "Отменено", variant: "cancelled" },
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const s = APPT_STATUS[status];
  return <Badge label={s.label} variant={s.variant} />;
}
