import { useMemo, useState } from "react";
import { Pressable, ScrollView, SectionList, Text, View } from "react-native";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react-native";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { COLORS, ICON } from "@/components/ui/tokens";
import { humanDay } from "@/features/appointments/helpers";
import { AppointmentSheet } from "@/features/appointments/AppointmentSheet";
import { useAppointments } from "@/features/calendar/queries";
import { useClients } from "@/features/clients/queries";
import { useTeams } from "@/features/reference/queries";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function sameMonth(ymd: string, cursor: Date) {
  const [y, m] = ymd.split("-").map(Number);
  return y === cursor.getFullYear() && m - 1 === cursor.getMonth();
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
        <Text className="text-xs text-neutral-400 tabular-nums">
          {apt.time_end}
        </Text>
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

export default function CalendarTab() {
  const { data: appts = [], isLoading, error } = useAppointments();
  const { data: clients = [] } = useClients();
  const { data: teams = [] } = useTeams();

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [teamFilter, setTeamFilter] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  const nameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.full_name])),
    [clients],
  );

  const filtered = useMemo(
    () =>
      appts.filter(
        (a) =>
          sameMonth(a.date, cursor) &&
          (teamFilter ? a.team_id === teamFilter : true),
      ),
    [appts, cursor, teamFilter],
  );

  const sections = useMemo(() => {
    const byDate = new Map<string, Appointment[]>();
    for (const a of filtered) {
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
  }, [filtered]);

  const monthLabel = cursor.toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
  const shiftMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  const isCurrentMonth =
    cursor.getFullYear() === new Date().getFullYear() &&
    cursor.getMonth() === new Date().getMonth();

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (apt: Appointment) => {
    setEditing(apt);
    setSheetOpen(true);
  };

  const header = (
    <View>
      {/* month nav */}
      <View className="flex-row items-center justify-between px-3 pb-1 pt-1">
        <Pressable
          onPress={() => shiftMonth(-1)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
        >
          <ChevronLeft color={COLORS.body} size={ICON.md} />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Text className="text-base font-semibold capitalize text-neutral-900">
            {monthLabel}
          </Text>
          {!isCurrentMonth ? (
            <Pressable
              onPress={() => setCursor(startOfMonth(new Date()))}
              className="rounded-full bg-neutral-100 px-2.5 py-1 active:opacity-80"
            >
              <Text className="text-xs font-medium text-brand">Сегодня</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => shiftMonth(1)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
        >
          <ChevronRight color={COLORS.body} size={ICON.md} />
        </Pressable>
      </View>

      {/* team filter */}
      {teams.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
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
      ) : null}
    </View>
  );

  return (
    <Screen>
      <ScreenHeader large title="Календарь" subtitle={`${filtered.length} записей`} />

      {isLoading ? (
        <EmptyState state="loading" fill />
      ) : error ? (
        <EmptyState state="error" fill subtitle={(error as Error).message} />
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 96, flexGrow: 1 }}
          renderSectionHeader={({ section }) => (
            <Text className="bg-neutral-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {humanDay(section.title)}
            </Text>
          )}
          renderItem={({ item }) => (
            <AppointmentRow
              apt={item}
              clientName={item.client_id ? nameById.get(item.client_id) ?? "" : ""}
              onPress={() => openEdit(item)}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-px bg-neutral-100" />}
          ListEmptyComponent={
            <EmptyState
              title="Нет записей в этом месяце"
              subtitle="Нажмите + чтобы создать"
              action={{ label: "Новая запись", onPress: openCreate }}
            />
          }
        />
      )}

      <Pressable
        onPress={openCreate}
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
      />
    </Screen>
  );
}
