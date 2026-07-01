import { useMemo, useState } from "react";
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
import { Check } from "lucide-react-native";
import type { Appointment } from "@babun/shared/local/appointments";
import { pad2 } from "@/features/appointments/helpers";
import { useThemeColors } from "@/theme/colors";
import { layoutDay, type PlacedAppt } from "@/features/calendar/layout";
import { useBlockColors, type BlockColors } from "@/features/calendar/status-colors";

export const HOUR_H = 64;
export const RAIL_W = 48;
const GAP = 3;
const DEFAULT_START = 7;
const DEFAULT_END = 23;

const minToHM = (min: number) => `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;

function Block({
  placed,
  laneW,
  startHour,
  endHour,
  colors,
  label,
  service,
  compact,
  onEdit,
  onReschedule,
}: {
  placed: PlacedAppt;
  laneW: number;
  startHour: number;
  endHour: number;
  colors: BlockColors;
  label: string;
  service: string | null;
  compact: boolean;
  onEdit: (a: Appointment) => void;
  onReschedule: (a: Appointment, s: string, e: string) => void;
}) {
  const t = useThemeColors();
  const { apt, startMin, endMin, colIndex, colCount } = placed;
  const ty = useSharedValue(0);
  const active = useSharedValue(0);

  const colW = laneW / colCount;
  const top = ((startMin - startHour * 60) / 60) * HOUR_H;
  const height = Math.max(((endMin - startMin) / 60) * HOUR_H - 2, 22);
  const left = colIndex * colW + 1;
  const width = colW - GAP;
  const cancelled = apt.status === "cancelled";
  const completed = apt.status === "completed";

  const commit = (translationY: number) => {
    const duration = Math.max(15, endMin - startMin);
    const dayStart = startHour * 60;
    const dayEnd = endHour * 60;
    let newStart = dayStart + Math.round(((top + translationY) / HOUR_H) * 60);
    newStart = Math.round(newStart / 15) * 15;
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
  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd(() => runOnJS(onEdit)(apt));
  const gesture = Gesture.Exclusive(pan, tap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }, { scale: 1 + active.value * 0.03 }],
    zIndex: active.value > 0 ? 20 : 1,
    shadowColor: "#000",
    shadowOpacity: active.value * 0.25,
    shadowRadius: active.value * 8,
    shadowOffset: { width: 0, height: 3 },
  }));

  const tall = height > 34;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          {
            position: "absolute",
            top,
            left,
            width,
            height,
            backgroundColor: colors.fill,
            borderLeftColor: colors.stripe,
            borderLeftWidth: 3,
            borderRadius: 6,
            paddingHorizontal: compact ? 3 : 6,
            paddingVertical: 2,
            overflow: "hidden",
            opacity: cancelled ? 0.55 : 1,
          },
          style,
        ]}
      >
        <View
          style={{ position: "absolute", top: 0, left: 3, right: 0, height: 1, backgroundColor: "rgba(255,255,255,0.45)" }}
        />
        <Text
          style={{ color: colors.base, fontSize: compact ? 9 : 11, fontWeight: "700", opacity: 0.9 }}
          className="tabular-nums"
          numberOfLines={1}
        >
          {apt.time_start}
        </Text>
        <Text
          style={{
            color: t.ink,
            fontSize: compact ? 9 : 11,
            fontWeight: "700",
            textDecorationLine: cancelled ? "line-through" : "none",
          }}
          numberOfLines={tall ? 2 : 1}
        >
          {label}
        </Text>
        {tall && !compact && service ? (
          <Text style={{ color: t.sub, fontSize: 11 }} numberOfLines={1}>
            {service}
          </Text>
        ) : null}
        {completed && !compact ? (
          <View
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              height: 15,
              width: 15,
              borderRadius: 8,
              backgroundColor: t.success,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check color="#fff" size={10} strokeWidth={3} />
          </View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}

// The fixed hour-label rail on the left of the grid.
export function TimeRail({
  startHour = DEFAULT_START,
  endHour = DEFAULT_END,
}: {
  startHour?: number;
  endHour?: number;
}) {
  const t = useThemeColors();
  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = startHour; h <= endHour; h++) out.push(h);
    return out;
  }, [startHour, endHour]);
  return (
    <View style={{ width: RAIL_W, height: (endHour - startHour) * HOUR_H }}>
      {hours.map((h) => (
        <Text
          key={h}
          style={{
            position: "absolute",
            top: (h - startHour) * HOUR_H - (h === startHour ? 0 : 7),
            right: 6,
            width: RAIL_W - 8,
            textAlign: "right",
            color: t.faint,
            fontSize: 12,
            fontWeight: "600",
          }}
          className="tabular-nums"
        >
          {`${pad2(h)}:00`}
        </Text>
      ))}
    </View>
  );
}

// One day lane: gridlines, past-wash, empty-slot tap, positioned blocks, now-line.
// Reused by both DayView (1 column) and WeekView (N columns).
export function DayColumn({
  dateYmd,
  appointments,
  clientName,
  serviceLabel,
  teamColorFor,
  isToday,
  compact = false,
  onEdit,
  onCreateAt,
  onReschedule,
  startHour = DEFAULT_START,
  endHour = DEFAULT_END,
}: {
  dateYmd: string;
  appointments: Appointment[];
  clientName: (a: Appointment) => string;
  serviceLabel?: (a: Appointment) => string | null;
  teamColorFor?: (a: Appointment) => string | null;
  isToday: boolean;
  compact?: boolean;
  onEdit: (a: Appointment) => void;
  onCreateAt: (dateYmd: string, timeStart: string) => void;
  onReschedule: (a: Appointment, newStart: string, newEnd: string) => void;
  startHour?: number;
  endHour?: number;
}) {
  const t = useThemeColors();
  const blockColors = useBlockColors(teamColorFor);
  const [laneW, setLaneW] = useState(0);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = startHour; h <= endHour; h++) out.push(h);
    return out;
  }, [startHour, endHour]);
  const totalH = (endHour - startHour) * HOUR_H;
  const placements = useMemo(() => layoutDay(appointments), [appointments]);

  const nowMin = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    const min = now.getHours() * 60 + now.getMinutes() - startHour * 60;
    if (min < 0 || min > (endHour - startHour) * 60) return null;
    return min;
  }, [isToday, startHour, endHour]);
  const nowTop = nowMin != null ? (nowMin / 60) * HOUR_H : null;
  const halfLine = t.dark ? "rgba(255,255,255,0.05)" : "rgba(60,60,67,0.07)";

  return (
    <View
      onLayout={(e) => setLaneW(e.nativeEvent.layout.width)}
      style={{
        flex: 1,
        height: totalH,
        position: "relative",
        borderLeftWidth: 1,
        borderLeftColor: t.separator,
      }}
    >
      {nowTop != null ? (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: nowTop,
            backgroundColor: t.dark ? "rgba(255,255,255,0.02)" : "rgba(11,18,32,0.02)",
          }}
        />
      ) : null}

      {hours.map((h) => (
        <View key={h}>
          <View
            style={{
              position: "absolute",
              top: (h - startHour) * HOUR_H,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: t.separator,
            }}
          />
          {h < endHour ? (
            <View
              style={{
                position: "absolute",
                top: (h - startHour) * HOUR_H + HOUR_H / 2,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: halfLine,
              }}
            />
          ) : null}
        </View>
      ))}

      {hours.slice(0, -1).map((h) => (
        <Pressable
          key={`slot-${h}`}
          onPress={() => onCreateAt(dateYmd, `${pad2(h)}:00`)}
          style={{
            position: "absolute",
            top: (h - startHour) * HOUR_H,
            left: 0,
            right: 0,
            height: HOUR_H,
          }}
        />
      ))}

      {laneW > 0
        ? placements.map((p) => (
            <Block
              key={p.apt.id}
              placed={p}
              laneW={laneW}
              startHour={startHour}
              endHour={endHour}
              colors={blockColors(p.apt)}
              label={clientName(p.apt) || p.apt.comment || "Запись"}
              service={serviceLabel ? serviceLabel(p.apt) : p.apt.comment || null}
              compact={compact}
              onEdit={onEdit}
              onReschedule={onReschedule}
            />
          ))
        : null}

      {nowTop != null ? (
        <View
          style={{
            position: "absolute",
            top: nowTop,
            left: -4,
            right: 0,
            flexDirection: "row",
            alignItems: "center",
          }}
          pointerEvents="none"
        >
          <View style={{ height: 9, width: 9, borderRadius: 5, backgroundColor: t.danger }} />
          <View style={{ height: 1.5, flex: 1, backgroundColor: t.danger, opacity: 0.85 }} />
        </View>
      ) : null}
    </View>
  );
}

// Single-day grid: hour rail + one day column, vertically scrollable.
export function DayView({
  dateYmd,
  appointments,
  clientName,
  serviceLabel,
  teamColorFor,
  isToday,
  onEdit,
  onCreateAt,
  onReschedule,
  onPrev,
  onNext,
  startHour = DEFAULT_START,
  endHour = DEFAULT_END,
}: {
  dateYmd: string;
  appointments: Appointment[];
  clientName: (a: Appointment) => string;
  serviceLabel?: (a: Appointment) => string | null;
  teamColorFor?: (a: Appointment) => string | null;
  isToday: boolean;
  onEdit: (a: Appointment) => void;
  onCreateAt: (dateYmd: string, timeStart: string) => void;
  onReschedule: (a: Appointment, newStart: string, newEnd: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  startHour?: number;
  endHour?: number;
}) {
  const swipe = Gesture.Pan()
    .activeOffsetX([-25, 25])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      if (e.translationX > 55 && onPrev) runOnJS(onPrev)();
      else if (e.translationX < -55 && onNext) runOnJS(onNext)();
    });
  return (
    <GestureDetector gesture={swipe}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 6 }}
      >
        <View style={{ flexDirection: "row" }}>
          <TimeRail startHour={startHour} endHour={endHour} />
          <DayColumn
            dateYmd={dateYmd}
            appointments={appointments}
            clientName={clientName}
            serviceLabel={serviceLabel}
            teamColorFor={teamColorFor}
            isToday={isToday}
            onEdit={onEdit}
            onCreateAt={onCreateAt}
            onReschedule={onReschedule}
            startHour={startHour}
            endHour={endHour}
          />
        </View>
      </ScrollView>
    </GestureDetector>
  );
}
