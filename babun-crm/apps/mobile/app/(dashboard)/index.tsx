import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, SectionList, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ICON } from "@/components/ui/tokens";
import { useThemeColors } from "@/theme/colors";
import { formatYMD, humanDay, parseYMD } from "@/features/appointments/helpers";
import { AppointmentSheet } from "@/features/appointments/AppointmentSheet";
import { DayView } from "@/features/calendar/DayView";
import { MonthView } from "@/features/calendar/MonthView";
import { useAppointments } from "@/features/calendar/queries";
import { useUpdateAppointment } from "@/features/calendar/mutations";
import { useToast } from "@/components/ui/Toast";
import { useClients } from "@/features/clients/queries";
import { useTeams } from "@/features/reference/queries";
import { useCalendarSettings } from "@/features/settings/local-settings";

type ViewMode = "agenda" | "day" | "month";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

function NavRow({
  label,
  onPrev,
  onNext,
  showToday,
  onToday,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  showToday: boolean;
  onToday: () => void;
}) {
  const th = useThemeColors();
  return (
    <View className="flex-row items-center justify-between px-3 pb-1 pt-1">
      <Pressable
        onPress={onPrev}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full active:opacity-60"
      >
        <ChevronLeft color={th.body} size={ICON.md} />
      </Pressable>
      <View className="flex-row items-center gap-2">
        <Text className="text-base font-semibold capitalize" style={{ color: th.ink }}>
          {label}
        </Text>
        {showToday ? (
          <Pressable
            onPress={onToday}
            className="rounded-full px-2.5 py-1 active:opacity-80"
            style={{ backgroundColor: th.dark ? "rgba(255,255,255,0.07)" : "#eef1f5" }}
          >
            <Text className="text-xs font-medium" style={{ color: th.accent }}>Сегодня</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onNext}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full active:opacity-60"
      >
        <ChevronRight color={th.body} size={ICON.md} />
      </Pressable>
    </View>
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

  const [mode, setMode] = useState<ViewMode>("agenda");
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

  const MODE_LABEL: Record<ViewMode, string> = {
    agenda: "Список",
    day: "День",
    month: "Месяц",
  };
  const toggle = (
    <View
      className="flex-row rounded-lg p-0.5"
      style={{ backgroundColor: t.dark ? "rgba(255,255,255,0.07)" : "#eef1f5" }}
    >
      {(["agenda", "day", "month"] as const).map((m) => (
        <Pressable
          key={m}
          onPress={() => setMode(m)}
          className="rounded-md px-2.5 py-1"
          style={mode === m ? { backgroundColor: t.surface } : undefined}
        >
          <Text
            className="text-xs font-semibold"
            style={{ color: mode === m ? t.ink : t.sub }}
          >
            {MODE_LABEL[m]}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const teamChips =
    teams.length > 0 ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, maxHeight: 52 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 8,
          gap: 8,
          alignItems: "center",
        }}
      >
        {[{ id: null as string | null, name: "Все" }, ...teams].map((tm) => {
          const active = teamFilter === tm.id;
          return (
            <Pressable
              key={tm.id ?? "all"}
              onPress={() => setTeamFilter(tm.id)}
              className="rounded-full px-3.5 py-1.5"
              style={{ backgroundColor: active ? t.accent : (t.dark ? "rgba(255,255,255,0.07)" : "#eef1f5") }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: active ? "#fff" : t.sub }}
              >
                {tm.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    ) : null;

  const count = mode === "agenda" ? monthAppts.length : dayAppts.length;

  return (
    <Screen>
      <ScreenHeader
        large
        title="Календарь"
        subtitle={`${count} записей`}
        right={toggle}
      />

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
          ListHeaderComponent={
            <View>
              <NavRow
                label={monthLabel}
                onPrev={() =>
                  setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
                }
                onNext={() =>
                  setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
                }
                showToday={!sameMonth(formatYMD(today), cursor)}
                onToday={() => setCursor(startOfMonth(new Date()))}
              />
              {teamChips}
            </View>
          }
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
      ) : mode === "day" ? (
        <View className="flex-1">
          <NavRow
            label={dayLabel}
            onPrev={() =>
              setDay((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))
            }
            onNext={() =>
              setDay((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1))
            }
            showToday={!isSameDay(day, today)}
            onToday={() => setDay(startOfDay(new Date()))}
          />
          {teamChips}
          <DayView
            appointments={dayAppts}
            clientName={clientName}
            isToday={isSameDay(day, today)}
            onEdit={openEdit}
            onCreateAt={(timeStart) =>
              openCreate({ date: dayYmd, time_start: timeStart })
            }
            onReschedule={reschedule}
            startHour={calSettings?.workStartHour}
            endHour={calSettings?.workEndHour}
          />
        </View>
      ) : (
        <View className="flex-1">
          <NavRow
            label={monthLabel}
            onPrev={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
            }
            onNext={() =>
              setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
            }
            showToday={!sameMonth(formatYMD(today), cursor)}
            onToday={() => setCursor(startOfMonth(new Date()))}
          />
          {teamChips}
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
      )}

      <Pressable
        onPress={() => openCreate(mode === "day" ? { date: dayYmd } : undefined)}
        className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full active:opacity-90"
        style={{
          backgroundColor: t.accent,
          shadowColor: t.brandShadow,
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Plus color="#fff" size={28} />
      </Pressable>

      <AppointmentSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        appointment={editing}
        defaults={bookDefaults}
      />
    </Screen>
  );
}
