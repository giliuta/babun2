import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";
import { formatYMD } from "@/features/appointments/helpers";
import { useThemeColors } from "@/theme/colors";
import { RAIL_W } from "@/features/calendar/DayView";

// Thin money strip pinned under the day/week grid — per-day Доход (green) over
// Расход (red), aligned to the day columns (gutter width = the hour rail).
export function DayFinanceFooter({
  days,
  appointments,
  onTapDay,
}: {
  days: Date[];
  appointments: Appointment[];
  onTapDay?: (d: Date) => void;
}) {
  const t = useThemeColors();

  const income = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of appointments) {
      if (a.status !== "completed") continue;
      m.set(a.date, (m.get(a.date) ?? 0) + (a.total_amount || 0));
    }
    return m;
  }, [appointments]);

  return (
    <View
      style={{
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: t.separator,
        backgroundColor: t.surface,
        paddingVertical: 4,
      }}
    >
      <View style={{ width: RAIL_W, paddingRight: 5, alignItems: "flex-end", justifyContent: "center" }}>
        <Text style={{ fontSize: 9, fontWeight: "600", color: t.success }}>Доход</Text>
        <Text style={{ fontSize: 9, fontWeight: "600", color: t.danger }}>Расход</Text>
      </View>
      {days.map((d, i) => {
        const ymd = formatYMD(d);
        return (
          <Pressable
            key={ymd}
            onPress={() => onTapDay?.(d)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 1,
              borderLeftWidth: i === 0 ? 0 : 1,
              borderLeftColor: t.separator,
            }}
          >
            <Text
              style={{ fontSize: days.length > 3 ? 10 : 12, fontWeight: "600", color: t.success }}
              className="tabular-nums"
              numberOfLines={1}
            >
              {formatEUR(income.get(ymd) ?? 0)}
            </Text>
            <Text
              style={{ fontSize: days.length > 3 ? 10 : 12, fontWeight: "600", color: t.danger }}
              className="tabular-nums"
              numberOfLines={1}
            >
              {formatEUR(0)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
