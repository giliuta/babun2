import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  ScrollView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { Appointment } from "@babun/shared/local/appointments";
import { pad2 } from "@/features/appointments/helpers";
import { useThemeColors } from "@/theme/colors";

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
const minToHM = (min: number) =>
  `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

function DraggableBlock({
  apt,
  top,
  height,
  label,
  comment,
  startHour,
  endHour,
  onEdit,
  onReschedule,
}: {
  apt: Appointment;
  top: number;
  height: number;
  label: string;
  comment: string | null;
  startHour: number;
  endHour: number;
  onEdit: (a: Appointment) => void;
  onReschedule: (a: Appointment, newStart: string, newEnd: string) => void;
}) {
  const t = useThemeColors();
  const ty = useSharedValue(0);
  const active = useSharedValue(0);
  const color = (apt.color_override as string) || STATUS_COLOR[apt.status];

  const commit = (translationY: number) => {
    const duration = Math.max(15, toMin(apt.time_end) - toMin(apt.time_start));
    const dayStart = startHour * 60;
    const dayEnd = endHour * 60;
    let newStart =
      dayStart + Math.round(((top + translationY) / HOUR_H) * 60);
    newStart = Math.round(newStart / 15) * 15; // snap to 15 min
    newStart = Math.max(dayStart, Math.min(dayEnd - duration, newStart));
    onReschedule(apt, minToHM(newStart), minToHM(newStart + duration));
  };

  const pan = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      active.value = withSpring(1);
    })
    .onUpdate((e) => {
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(commit)(e.translationY);
      ty.value = withSpring(0);
      active.value = withSpring(0);
    });

  const tap = Gesture.Tap().maxDuration(250).onEnd(() => {
    runOnJS(onEdit)(apt);
  });

  const gesture = Gesture.Exclusive(pan, tap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { scale: 1 + active.value * 0.03 }],
    zIndex: active.value > 0 ? 20 : 1,
    elevation: active.value > 0 ? 6 : 0,
    shadowColor: "#000",
    shadowOpacity: active.value * 0.25,
    shadowRadius: active.value * 6,
    shadowOffset: { width: 0, height: 2 },
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            top,
            left: 4,
            right: 8,
            height,
            backgroundColor: `${color}1f`,
            borderLeftColor: color,
            borderLeftWidth: 3,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            overflow: "hidden",
          },
          style,
        ]}
      >
        <Text style={{ color, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
          {apt.time_start} · {label}
        </Text>
        {height > 40 && comment ? (
          <Text style={{ color: t.faint, fontSize: 11 }} numberOfLines={1}>
            {comment}
          </Text>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

export function DayView({
  appointments,
  clientName,
  isToday,
  onEdit,
  onCreateAt,
  onReschedule,
  startHour = DEFAULT_START,
  endHour = DEFAULT_END,
}: {
  appointments: Appointment[];
  clientName: (a: Appointment) => string;
  isToday: boolean;
  onEdit: (a: Appointment) => void;
  onCreateAt: (timeStart: string) => void;
  onReschedule: (a: Appointment, newStart: string, newEnd: string) => void;
  startHour?: number;
  endHour?: number;
}) {
  const t = useThemeColors();
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
              style={{ position: "absolute", left: -52, top: -7, width: 46, textAlign: "right", color: t.faint, fontSize: 12 }}
              className="tabular-nums"
            >
              {`${pad2(h)}:00`}
            </Text>
            <View style={{ height: 1, backgroundColor: t.separator }} />
          </View>
        ))}

        {/* empty-slot tap layer (beneath the blocks) */}
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

        {/* appointment blocks (draggable) */}
        {appointments.map((a) => {
          const startMin = toMin(a.time_start) - startHour * 60;
          const dur = Math.max(30, toMin(a.time_end) - toMin(a.time_start));
          return (
            <DraggableBlock
              key={a.id}
              apt={a}
              top={(startMin / 60) * HOUR_H}
              height={Math.max(26, (dur / 60) * HOUR_H - 2)}
              label={clientName(a) || a.comment || "Запись"}
              comment={a.comment || null}
              startHour={startHour}
              endHour={endHour}
              onEdit={onEdit}
              onReschedule={onReschedule}
            />
          );
        })}

        {/* now line */}
        {nowTop != null ? (
          <View style={{ position: "absolute", top: nowTop, left: -6, right: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ height: 10, width: 10, borderRadius: 5, backgroundColor: t.danger }} />
              <View style={{ height: 1.5, flex: 1, backgroundColor: t.danger }} />
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
