import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatYMD } from "@/features/appointments/helpers";
import { useThemeColors } from "@/theme/colors";
import { DayColumn, TimeRail, RAIL_W } from "@/features/calendar/DayView";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Week / 3-day grid: a fixed day-header row + a shared hour rail with N day
// columns. Reuses DayColumn so the block/gridline/now-line rendering is
// identical to the day view (now-line is scoped to today's column).
export function WeekView({
  days,
  appointments,
  clientName,
  serviceLabel,
  teamColorFor,
  today,
  onEdit,
  onCreateAt,
  onReschedule,
  onPickDay,
  startHour,
  endHour,
}: {
  days: Date[];
  appointments: Appointment[];
  clientName: (a: Appointment) => string;
  serviceLabel?: (a: Appointment) => string | null;
  teamColorFor?: (a: Appointment) => string | null;
  today: Date;
  onEdit: (a: Appointment) => void;
  onCreateAt: (dateYmd: string, timeStart: string) => void;
  onReschedule: (a: Appointment, s: string, e: string) => void;
  onPickDay: (d: Date) => void;
  startHour?: number;
  endHour?: number;
}) {
  const t = useThemeColors();

  const byDay = useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const arr = m.get(a.date) ?? [];
      arr.push(a);
      m.set(a.date, arr);
    }
    return m;
  }, [appointments]);

  return (
    <View style={{ flex: 1 }}>
      {/* day headers */}
      <View
        style={{
          flexDirection: "row",
          paddingBottom: 4,
          borderBottomWidth: 1,
          borderBottomColor: t.separator,
        }}
      >
        <View style={{ width: RAIL_W }} />
        {days.map((d) => {
          const isToday = sameDay(d, today);
          const weekend = d.getDay() === 0 || d.getDay() === 6;
          const dayAppts = byDay.get(formatYMD(d)) ?? [];
          return (
            <Pressable
              key={formatYMD(d)}
              onPress={() => onPickDay(d)}
              style={{ flex: 1, alignItems: "center", paddingTop: 4 }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: weekend ? t.danger : t.faint,
                  textTransform: "uppercase",
                }}
              >
                {WEEKDAYS[(d.getDay() + 6) % 7]}
              </Text>
              <View
                style={{
                  marginTop: 2,
                  height: 26,
                  width: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isToday ? t.accent : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: isToday ? "#fff" : weekend ? t.danger : t.ink,
                  }}
                  className="tabular-nums"
                >
                  {d.getDate()}
                </Text>
              </View>
              <Text style={{ fontSize: 10, fontWeight: "600", color: t.faint }} className="tabular-nums">
                {dayAppts.length > 0 ? dayAppts.length : ""}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* grid */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 6 }}
      >
        <View style={{ flexDirection: "row" }}>
          <TimeRail startHour={startHour} endHour={endHour} />
          {days.map((d) => (
            <DayColumn
              key={formatYMD(d)}
              dateYmd={formatYMD(d)}
              appointments={byDay.get(formatYMD(d)) ?? []}
              clientName={clientName}
              serviceLabel={serviceLabel}
              teamColorFor={teamColorFor}
              isToday={sameDay(d, today)}
              compact={days.length > 3}
              onEdit={onEdit}
              onCreateAt={onCreateAt}
              onReschedule={onReschedule}
              startHour={startHour}
              endHour={endHour}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
