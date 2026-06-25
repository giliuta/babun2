import { useMemo } from "react";
import { ActivityIndicator, SectionList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Appointment } from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";
import { Screen } from "@/components/ui/Screen";
import { useAppointments } from "@/features/calendar/queries";
import { useClients } from "@/features/clients/queries";

// Phase 4 first pass: an agenda view (appointments grouped by day). The full
// drag/pinch/swipe day-grid calendar is a later iteration.

const STATUS: Record<
  Appointment["status"],
  { label: string; cls: string }
> = {
  scheduled: { label: "Запланировано", cls: "bg-brand/10 text-brand" },
  in_progress: { label: "В работе", cls: "bg-warning/15 text-amber-700" },
  completed: { label: "Выполнено", cls: "bg-success/15 text-success" },
  cancelled: { label: "Отменено", cls: "bg-neutral-100 text-neutral-500" },
};

function formatDayHeader(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (Number.isNaN(date.getTime())) return ymd;
  return date.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
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
  const s = STATUS[apt.status];
  return (
    <View className="flex-row items-center bg-white px-4 py-3">
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
          <Text className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
            {s.label}
          </Text>
          {apt.total_amount ? (
            <Text className="text-xs font-semibold text-neutral-700 tabular-nums">
              {formatEUR(apt.total_amount)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function CalendarTab() {
  const router = useRouter();
  const { data: appts = [], isLoading, error } = useAppointments();
  const { data: clients = [] } = useClients();

  const nameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.full_name])),
    [clients],
  );

  const sections = useMemo(() => {
    const byDate = new Map<string, Appointment[]>();
    for (const a of appts) {
      const arr = byDate.get(a.date) ?? [];
      arr.push(a);
      byDate.set(a.date, arr);
    }
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({
        title: date,
        data: data.sort((x, y) => x.time_start.localeCompare(y.time_start)),
      }));
  }, [appts]);

  return (
    <Screen>
      <View className="px-4 pb-2 pt-4">
        <Text className="text-2xl font-bold text-neutral-900">Календарь</Text>
        <Text className="text-sm text-neutral-500">{appts.length} записей</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center text-sm text-danger">
            {(error as Error).message}
          </Text>
        </View>
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled
          renderSectionHeader={({ section }) => (
            <Text className="bg-neutral-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {formatDayHeader(section.title)}
            </Text>
          )}
          renderItem={({ item }) => (
            <AppointmentRow
              apt={item}
              clientName={item.client_id ? nameById.get(item.client_id) ?? "" : ""}
              onPress={() =>
                item.client_id && router.push(`/clients/${item.client_id}`)
              }
            />
          )}
          ItemSeparatorComponent={() => (
            <View className="h-px bg-neutral-100" />
          )}
          ListEmptyComponent={
            <View className="items-center pt-20">
              <Text className="text-sm text-neutral-400">Записей пока нет</Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}
