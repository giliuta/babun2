import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { Appointment } from "@babun/shared/local/appointments";
import { pad2 } from "@/features/appointments/helpers";

const HOUR_H = 64;
const DEFAULT_START = 7;
const DEFAULT_END = 23;

const STATUS_COLOR: Record<Appointment["status"], string> = {
  scheduled: "#4338ca",
  in_progress: "#d97706",
  completed: "#10b981",
  cancelled: "#9ca3af",
};

const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function DayView({
  appointments,
  clientName,
  isToday,
  onEdit,
  onCreateAt,
  startHour = DEFAULT_START,
  endHour = DEFAULT_END,
}: {
  appointments: Appointment[];
  clientName: (a: Appointment) => string;
  isToday: boolean;
  onEdit: (a: Appointment) => void;
  onCreateAt: (timeStart: string) => void;
  startHour?: number;
  endHour?: number;
}) {
  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = startHour; h <= endHour; h++) out.push(h);
    return out;
  }, [startHour, endHour]);
  const totalH = (endHour - startHour) * HOUR_H;

  const nowTop = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    const min = now.getHours() * 60 + now.getMinutes() - startHour * 60;
    if (min < 0 || min > (endHour - startHour) * 60) return null;
    return (min / 60) * HOUR_H;
  }, [isToday, startHour, endHour]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 110, paddingTop: 8 }}
    >
      <View style={{ height: totalH, marginLeft: 56, position: "relative" }}>
        {/* hour gridlines + labels */}
        {hours.map((h) => (
          <View
            key={h}
            style={{ position: "absolute", top: (h - startHour) * HOUR_H, left: 0, right: 0 }}
          >
            <Text
              style={{ position: "absolute", left: -52, top: -7, width: 46, textAlign: "right" }}
              className="text-xs text-neutral-400 tabular-nums"
            >
              {`${pad2(h)}:00`}
            </Text>
            <View className="h-px bg-neutral-100" />
          </View>
        ))}

        {/* empty-slot tap layer (one Pressable per hour, beneath the blocks) */}
        {hours.slice(0, -1).map((h) => (
          <Pressable
            key={`slot-${h}`}
            onPress={() => onCreateAt(`${pad2(h)}:00`)}
            style={{
              position: "absolute",
              top: (h - startHour) * HOUR_H,
              left: 0,
              right: 0,
              height: HOUR_H,
            }}
          />
        ))}

        {/* appointment blocks */}
        {appointments.map((a) => {
          const startMin = toMin(a.time_start) - startHour * 60;
          const dur = Math.max(30, toMin(a.time_end) - toMin(a.time_start));
          const top = (startMin / 60) * HOUR_H;
          const height = Math.max(26, (dur / 60) * HOUR_H - 2);
          const color = STATUS_COLOR[a.status];
          return (
            <Pressable
              key={a.id}
              onPress={() => onEdit(a)}
              style={{
                position: "absolute",
                top,
                left: 4,
                right: 8,
                height,
                backgroundColor: `${color}1f`,
                borderLeftColor: color,
                borderLeftWidth: 3,
              }}
              className="overflow-hidden rounded-lg px-2 py-1 active:opacity-80"
            >
              <Text style={{ color }} className="text-xs font-semibold" numberOfLines={1}>
                {a.time_start} · {clientName(a) || a.comment || "Запись"}
              </Text>
              {height > 40 && a.comment ? (
                <Text className="text-[11px] text-neutral-500" numberOfLines={1}>
                  {a.comment}
                </Text>
              ) : null}
            </Pressable>
          );
        })}

        {/* now line */}
        {nowTop != null ? (
          <View style={{ position: "absolute", top: nowTop, left: -6, right: 0 }}>
            <View className="flex-row items-center">
              <View className="h-2.5 w-2.5 rounded-full bg-danger" />
              <View className="h-[1.5px] flex-1 bg-danger" />
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
