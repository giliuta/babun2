import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, SectionList, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";
import { Screen } from "@/components/ui/Screen";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useThemeColors } from "@/theme/colors";
import { formatYMD, humanDay, parseYMD } from "@/features/appointments/helpers";
import { AppointmentSheet } from "@/features/appointments/AppointmentSheet";
import { DayView } from "@/features/calendar/DayView";
import { WeekView } from "@/features/calendar/WeekView";
import { type CalMode } from "@/features/calendar/ViewModeDropdown";
import { CalendarHeader } from "@/features/calendar/CalendarHeader";
import { TeamChips } from "@/features/calendar/TeamChips";
import { MonthView } from "@/features/calendar/MonthView";
import { useAppointments } from "@/features/calendar/queries";
import { useUpdateAppointment } from "@/features/calendar/mutations";
import { useToast } from "@/components/ui/Toast";
import { useClients } from "@/features/clients/queries";
import { useTeams } from "@/features/reference/queries";
import { useCalendarSettings } from "@/features/settings/local-settings";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function mondayOf(d: Date) {
  const x = startOfDay(d);
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  return x;
}
function addDays(d: Date, n: number) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameMonth(ymd: string, cursor: Date) {
  const [y, m] = ymd.split("-").map(Number);
  return y === cursor.getFullYear() && m - 1 === cursor.getMonth();
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function AppointmentRow({
  apt,
  clientName,
  onPress,
}: {
  apt: Appointment;
  clientName: string;
  onPress: () => void;
}) {
  const th = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 py-3 active:opacity-60"
      style={{ backgroundColor: th.surface }}
    >
      <View className="w-14">
        <Text className="text-sm font-semibold tabular-nums" style={{ color: th.ink }}>
          {apt.time_start}
        </Text>
        <Text className="text-xs tabular-nums" style={{ color: th.faint }}>{apt.time_end}</Text>
      </View>
      <View className="ml-2 flex-1 border-l pl-3" style={{ borderColor: th.separator }}>
        <Text className="text-base font-semibold" style={{ color: th.ink }} numberOfLines={1}>
          {clientName || apt.comment || "Запись"}
        </Text>
        {apt.comment ? (
          <Text className="text-sm" style={{ color: th.sub }} numberOfLines={1}>
            {apt.comment}
          </Text>
        ) : null}
        <View className="mt-1 flex-row items-center gap-2">
          <StatusBadge status={apt.status} />
          {apt.total_amount ? (
            <Text className="text-xs font-semibold tabular-nums" style={{ color: th.sub }}>
              {formatEUR(apt.total_amount)}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function CalendarTab() {
  const { data: appts = [], isLoading, error } = useAppointments();
  const { data: clients = [] } = useClients();
  const { data: teams = [] } = useTeams();
  const { data: calSettings } = useCalendarSettings();
  const updateAppt = useUpdateAppointment();
  const toast = useToast();

  const reschedule = (apt: Appointment, newStart: string, newEnd: string) => {
    if (apt.time_start === newStart) return;
    updateAppt.mutate(
      { id: apt.id, patch: { time_start: newStart, time_end: newEnd } },
      { onSuccess: () => toast(`Перенесено на ${newStart}`) },
    );
  };

  const router = useRouter();
  const params = useLocalSearchParams<{
    new?: string;
    clientId?: string;
    teamId?: string;
    date?: string;
  }>();

  const [mode, setMode] = useState<CalMode>("week");
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [bookDefaults, setBookDefaults] = useState<
    {
      date?: string;
      time_start?: string;
      client_id?: string | null;
      team_id?: string | null;
    } | undefined
  >(undefined);

  useEffect(() => {
    if (params.new === "1") {
      setEditing(null);
      setBookDefaults({
        client_id: params.clientId ?? null,
        team_id: params.teamId ?? null,
      });
      setSheetOpen(true);
      router.setParams({ new: undefined, clientId: undefined, teamId: undefined });
    } else if (params.date) {
      const d = parseYMD(params.date);
      setCursor(startOfMonth(d));
      setDay(startOfDay(d));
      router.setParams({ date: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.new, params.clientId, params.date]);

  const nameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.full_name])),
    [clients],
  );
  const clientName = (a: Appointment) =>
    a.client_id ? nameById.get(a.client_id) ?? "" : "";

  const teamColor = useMemo(() => {
    const m = new Map<string, string>();
    for (const tm of teams as { id: string; color?: string | null }[]) {
      if (tm.color) m.set(tm.id, tm.color);
    }
    return m;
  }, [teams]);
  const teamColorFor = useCallback(
    (a: Appointment) => (a.team_id ? teamColor.get(a.team_id) ?? null : null),
    [teamColor],
  );

  const hideCancelled = !!calSettings?.hideCancelled;
  const byTeam = (a: Appointment) =>
    (teamFilter ? a.team_id === teamFilter : true) &&
    (!hideCancelled || a.status !== "cancelled");

  const monthAppts = useMemo(
    () => appts.filter((a) => sameMonth(a.date, cursor) && byTeam(a)),
    [appts, cursor, teamFilter, hideCancelled],
  );
  const dayYmd = formatYMD(day);
  const dayAppts = useMemo(
    () => appts.filter((a) => a.date === dayYmd && byTeam(a)),
    [appts, dayYmd, teamFilter, hideCancelled],
  );

  const weekDays = useMemo(() => {
    const mon = mondayOf(day);
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
  }, [day]);
  const weekYmds = useMemo(() => weekDays.map(formatYMD), [weekDays]);
  const weekAppts = useMemo(
    () => appts.filter((a) => weekYmds.includes(a.date) && byTeam(a)),
    [appts, weekYmds, teamFilter, hideCancelled],
  );
  const weekLabel = `${weekDays[0].getDate()}–${weekDays[6].getDate()} ${weekDays[6].toLocaleDateString("ru-RU", { month: "short" })}`;

  const sections = useMemo(() => {
    const byDate = new Map<string, Appointment[]>();
    for (const a of monthAppts) {
      const arr = byDate.get(a.date) ?? [];
      arr.push(a);
      byDate.set(a.date, arr);
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, data]) => ({
        title: d,
        data: data.sort((x, y) => x.time_start.localeCompare(y.time_start)),
      }));
  }, [monthAppts]);

  const today = new Date();
  const monthLabel = cursor.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
  const dayLabel = day.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });

  const openCreate = (defaults?: typeof bookDefaults) => {
    setEditing(null);
    setBookDefaults(defaults);
    setSheetOpen(true);
  };
  const openEdit = (apt: Appointment) => {
    setEditing(apt);
    setBookDefaults(undefined);
    setSheetOpen(true);
  };

  const t = useThemeColors();

  const headerTitle = (mode === "week" ? weekDays[3] : mode === "day" ? day : cursor)
    .toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
    .replace(" г.", "");

  const goToday = () => {
    const now = new Date();
    setDay(startOfDay(now));
    setCursor(startOfMonth(now));
  };
  const prevMonth = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const nextMonth = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const monthSwipe = Gesture.Pan()
    .activeOffsetX([-25, 25])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      if (e.translationX > 55) runOnJS(prevMonth)();
      else if (e.translationX < -55) runOnJS(nextMonth)();
    });

  return (
    <Screen>
      <CalendarHeader
        monthTitle={headerTitle}
        mode={mode}
        onModeChange={setMode}
        onGear={() => router.push("/cabinet")}
        onToday={goToday}
      />
      <TeamChips teams={teams} activeId={teamFilter} onSelect={setTeamFilter} />

      {isLoading ? (
        <EmptyState state="loading" fill />
      ) : error ? (
        <EmptyState state="error" fill subtitle={(error as Error).message} />
      ) : mode === "agenda" ? (
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          contentContainerStyle={{ paddingBottom: 96, flexGrow: 1 }}
          renderSectionHeader={({ section }) => (
            <Text
              className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
              style={{ backgroundColor: t.canvas, color: t.sub }}
            >
              {humanDay(section.title)}
            </Text>
          )}
          renderItem={({ item }) => (
            <AppointmentRow
              apt={item}
              clientName={clientName(item)}
              onPress={() => openEdit(item)}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-px" style={{ backgroundColor: t.separator }} />}
          ListEmptyComponent={
            <EmptyState
              title="Нет записей в этом месяце"
              subtitle="Нажмите + чтобы создать"
              action={{ label: "Новая запись", onPress: () => openCreate() }}
            />
          }
        />
      ) : mode === "week" ? (
        <WeekView
          days={weekDays}
          appointments={weekAppts}
          clientName={clientName}
          teamColorFor={teamColorFor}
          today={today}
          onEdit={openEdit}
          onCreateAt={(d, timeStart) =>
            openCreate({ date: d, time_start: timeStart })
          }
          onReschedule={reschedule}
          onPickDay={(d) => {
            setDay(startOfDay(d));
            setMode("day");
          }}
          onPrev={() => setDay((d) => addDays(d, -7))}
          onNext={() => setDay((d) => addDays(d, 7))}
          startHour={calSettings?.workStartHour}
          endHour={calSettings?.workEndHour}
        />
      ) : mode === "day" ? (
        <DayView
          dateYmd={dayYmd}
          appointments={dayAppts}
          clientName={clientName}
          teamColorFor={teamColorFor}
          isToday={isSameDay(day, today)}
          onEdit={openEdit}
          onCreateAt={(d, timeStart) =>
            openCreate({ date: d, time_start: timeStart })
          }
          onReschedule={reschedule}
          onPrev={() =>
            setDay((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))
          }
          onNext={() =>
            setDay((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
          }
          startHour={calSettings?.workStartHour}
          endHour={calSettings?.workEndHour}
        />
      ) : (
        <GestureDetector gesture={monthSwipe}>
          <View className="flex-1">
            <MonthView
              month={cursor}
              appointments={monthAppts}
              onPickDay={(d) => {
                setDay(startOfDay(d));
                setCursor(startOfMonth(d));
                setMode("day");
              }}
            />
          </View>
        </GestureDetector>
      )}

      <AppointmentSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        appointment={editing}
        defaults={bookDefaults}
      />
    </Screen>
  );
}
