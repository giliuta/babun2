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
import { COLORS, ICON } from "@/components/ui/tokens";
import { formatYMD, humanDay, parseYMD } from "@/features/appointments/helpers";
import { AppointmentSheet } from "@/features/appointments/AppointmentSheet";
import { DayView } from "@/features/calendar/DayView";
import { MonthView } from "@/features/calendar/MonthView";
import { useAppointments } from "@/features/calendar/queries";
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
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-white px-4 py-3 active:bg-neutral-50"
    >
      <View className="w-14">
        <Text className="text-sm font-semibold text-neutral-900 tabular-nums">
          {apt.time_start}
        </Text>
        <Text className="text-xs text-neutral-400 tabular-nums">{apt.time_end}</Text>
      </View>
      <View className="ml-2 flex-1 border-l border-neutral-100 pl-3">
        <Text className="text-base font-semibold text-neutral-900" numberOfLines={1}>
          {clientName || apt.comment || "Запись"}
        </Text>
        {apt.comment ? (
          <Text className="text-sm text-neutral-500" numberOfLines={1}>
            {apt.comment}
          </Text>
        ) : null}
        <View className="mt-1 flex-row items-center gap-2">
          <StatusBadge status={apt.status} />
          {apt.total_amount ? (
            <Text className="text-xs font-semibold text-neutral-700 tabular-nums">
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
  return (
    <View className="flex-row items-center justify-between px-3 pb-1 pt-1">
      <Pressable
        onPress={onPrev}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
      >
        <ChevronLeft color={COLORS.body} size={ICON.md} />
      </Pressable>
      <View className="flex-row items-center gap-2">
        <Text className="text-base font-semibold capitalize text-neutral-900">
          {label}
        </Text>
        {showToday ? (
          <Pressable
            onPress={onToday}
            className="rounded-full bg-neutral-100 px-2.5 py-1 active:opacity-80"
          >
            <Text className="text-xs font-medium text-brand">Сегодня</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onNext}
        hitSlop={8}
        className="h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
      >
        <ChevronRight color={COLORS.body} size={ICON.md} />
      </Pressable>
    </View>
  );
}

export default function CalendarTab() {
  const { data: appts = [], isLoading, error } = useAppointments();
  const { data: clients = [] } = useClients();
  const { data: teams = [] } = useTeams();
  const { data: calSettings } = useCalendarSettings();

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

  const MODE_LABEL: Record<ViewMode, string> = {
    agenda: "Список",
    day: "День",
    month: "Месяц",
  };
  const toggle = (
    <View className="flex-row rounded-lg bg-neutral-200 p-0.5">
      {(["agenda", "day", "month"] as const).map((m) => (
        <Pressable
          key={m}
          onPress={() => setMode(m)}
          className={`rounded-md px-2.5 py-1 ${mode === m ? "bg-white" : ""}`}
        >
          <Text
            className={`text-xs font-semibold ${mode === m ? "text-neutral-900" : "text-neutral-500"}`}
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
        {[{ id: null as string | null, name: "Все" }, ...teams].map((t) => {
          const active = teamFilter === t.id;
          return (
            <Pressable
              key={t.id ?? "all"}
              onPress={() => setTeamFilter(t.id)}
              className={`rounded-full px-3.5 py-1.5 ${active ? "bg-brand" : "bg-neutral-100"}`}
            >
              <Text
                className={`text-sm font-medium ${active ? "text-white" : "text-neutral-700"}`}
              >
                {t.name}
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
            <Text className="bg-neutral-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
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
          ItemSeparatorComponent={() => <View className="h-px bg-neutral-100" />}
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
        className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-brand active:opacity-90"
        style={{
          shadowColor: COLORS.brand,
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
