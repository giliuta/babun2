import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import type { Appointment } from "@babun/shared/local/appointments";

const WD = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

// Month overview: 6×7 grid (Monday-first), each cell shows the day number and
// an appointment-count chip. Tapping a day opens it in the Day view.
export function MonthView({
  month,
  appointments,
  onPickDay,
}: {
  month: Date; // first of the displayed month
  appointments: Appointment[];
  onPickDay: (d: Date) => void;
}) {
  const cells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const startDow = (new Date(y, m, 1).getDay() + 6) % 7; // Monday = 0
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) out.push(new Date(y, m, 1 - startDow + i));
    return out;
  }, [month]);

  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments) map.set(a.date, (map.get(a.date) ?? 0) + 1);
    return map;
  }, [appointments]);

  const todayStr = ymd(new Date());

  return (
    <View className="flex-1 px-1.5 pt-1">
      <View className="flex-row">
        {WD.map((w) => (
          <Text
            key={w}
            className="flex-1 py-1 text-center text-xs font-medium text-neutral-400"
          >
            {w}
          </Text>
        ))}
      </View>
      <View className="flex-1">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <View key={row} className="flex-1 flex-row">
            {cells.slice(row * 7, row * 7 + 7).map((d) => {
              const key = ymd(d);
              const inMonth = d.getMonth() === month.getMonth();
              const isToday = key === todayStr;
              const count = countByDay.get(key) ?? 0;
              return (
                <Pressable
                  key={key}
                  onPress={() => onPickDay(d)}
                  className="flex-1 items-center border-t border-neutral-100 pt-1.5 active:bg-neutral-50"
                >
                  <View
                    className={`h-7 w-7 items-center justify-center rounded-full ${isToday ? "bg-brand" : ""}`}
                  >
                    <Text
                      className={`text-sm ${
                        isToday
                          ? "font-bold text-white"
                          : inMonth
                            ? "text-neutral-900"
                            : "text-neutral-300"
                      }`}
                    >
                      {d.getDate()}
                    </Text>
                  </View>
                  {count > 0 ? (
                    <View className="mt-0.5 rounded-full bg-brand/15 px-1.5">
                      <Text className="text-[10px] font-semibold text-brand">
                        {count}
                      </Text>
                    </View>
                  ) : (
                    <View className="mt-0.5 h-3.5" />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
