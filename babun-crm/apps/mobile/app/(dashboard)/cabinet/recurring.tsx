import { useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Check, Phone, Plus, Search, X } from "lucide-react-native";
import type { RecurringReminder } from "@babun/shared/local/recurring";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Divider } from "@/components/ui/Divider";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { COLORS, ICON } from "@/components/ui/tokens";
import { useToast } from "@/components/ui/Toast";
import { formatYMD, humanDay } from "@/features/appointments/helpers";
import { useClients } from "@/features/clients/queries";
import {
  useCreateReminder,
  useDeleteReminder,
  useRecurringReminders,
  useUpdateReminderStatus,
} from "@/features/recurring/queries";

function dueTone(next: string): { label: string; cls: string } {
  const today = formatYMD(new Date());
  if (next <= today) return { label: "Пора", cls: "bg-danger/10 text-danger" };
  const d = new Date(next).getTime() - Date.now();
  if (d <= 14 * 86400000)
    return { label: "Скоро", cls: "bg-warning/15 text-amber-700" };
  return { label: humanDay(next), cls: "bg-neutral-100 text-neutral-500" };
}

export default function RecurringScreen() {
  const { data: reminders = [], isLoading } = useRecurringReminders();
  const { data: clients = [] } = useClients();
  const create = useCreateReminder();
  const setStatus = useUpdateReminderStatus();
  const del = useDeleteReminder();
  const toast = useToast();

  const pending = useMemo(
    () => reminders.filter((r) => r.status === "pending"),
    [reminders],
  );

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [months, setMonths] = useState(6);
  const [q, setQ] = useState("");

  const client = clients.find((c) => c.id === clientId) ?? null;
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (
      t
        ? clients.filter(
            (c) =>
              c.full_name.toLowerCase().includes(t) ||
              (c.phone ?? "").includes(t),
          )
        : clients
    ).slice(0, 50);
  }, [clients, q]);

  const reset = () => {
    setClientId(null);
    setSummary("");
    setMonths(6);
    setQ("");
  };

  const submit = async () => {
    if (!client) return;
    await create.mutateAsync({
      client_id: client.id,
      client_name: client.full_name,
      phone: client.phone ?? "",
      team_id: null,
      service_ids: [],
      service_summary: summary.trim() || "Повторное ТО",
      last_date: formatYMD(new Date()),
      interval_months: months,
      note: "",
      manual: true,
    });
    setOpen(false);
    reset();
    toast("Напоминание создано");
  };

  return (
    <Screen edges={["top"]}>
      <ScreenHeader
        title="Повторяющиеся ТО"
        subtitle={pending.length ? `${pending.length} в работе` : undefined}
        right={
          <Pressable
            onPress={() => setOpen(true)}
            hitSlop={8}
            className="h-10 w-10 items-center justify-center rounded-full active:bg-neutral-100"
          >
            <Plus color={COLORS.brand} size={ICON.md} />
          </Pressable>
        }
      />
      {isLoading ? (
        <EmptyState state="loading" fill />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={pending}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ flexGrow: 1, paddingTop: 8 }}
          renderItem={({ item }) => {
            const tone = dueTone(item.next_due_date);
            return (
              <View className="flex-row items-center px-4 py-3">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-semibold text-neutral-900" numberOfLines={1}>
                    {item.client_name}
                  </Text>
                  <Text className="text-sm text-neutral-500" numberOfLines={1}>
                    {item.service_summary}
                  </Text>
                  <Text className={`mt-1 self-start overflow-hidden rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone.cls}`}>
                    {tone.label}
                  </Text>
                </View>
                {item.phone ? (
                  <Pressable
                    onPress={() => Linking.openURL(`tel:${item.phone}`)}
                    className="mr-1 h-9 w-9 items-center justify-center rounded-full bg-success/10"
                  >
                    <Phone color={COLORS.success} size={ICON.sm} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => {
                    setStatus.mutate({ id: item.id, status: "booked" });
                    toast("Отмечено записанным");
                  }}
                  className="mr-1 h-9 w-9 items-center justify-center rounded-full bg-brand/10"
                >
                  <Check color={COLORS.brand} size={ICON.sm} />
                </Pressable>
                <Pressable
                  onPress={() => del.mutate(item.id)}
                  className="h-9 w-9 items-center justify-center rounded-full active:bg-neutral-100"
                >
                  <X color={COLORS.faint} size={ICON.sm} />
                </Pressable>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <Divider inset={16} />}
          ListEmptyComponent={
            <EmptyState
              fill
              title="Нет напоминаний"
              subtitle="«Через 6 мес — чистка» и т.п. Добавьте через +"
            />
          }
        />
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/30" onPress={() => setOpen(false)} />
        <View className="absolute bottom-0 left-0 right-0 h-[80%] rounded-t-3xl bg-white p-5 pb-8">
          <Text className="mb-3 text-lg font-bold text-neutral-900">Напоминание</Text>
          {!client ? (
            <>
              <View className="mb-2 flex-row items-center gap-2 rounded-xl bg-neutral-100 px-3">
                <Search color={COLORS.faint} size={ICON.sm} />
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Клиент"
                  placeholderTextColor={COLORS.faint}
                  className="flex-1 py-2.5 text-base text-neutral-900"
                />
              </View>
              <FlatList
                data={filtered}
                keyExtractor={(c) => c.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => setClientId(item.id)}
                    className="px-1 py-3 active:opacity-70"
                  >
                    <Text className="text-base text-neutral-900">{item.full_name}</Text>
                    {item.phone ? (
                      <Text className="text-sm text-neutral-500">{item.phone}</Text>
                    ) : null}
                  </Pressable>
                )}
                ItemSeparatorComponent={() => <Divider />}
              />
            </>
          ) : (
            <>
              <Pressable
                onPress={() => setClientId(null)}
                className="mb-2 flex-row items-center justify-between rounded-xl bg-neutral-50 px-3 py-2.5"
              >
                <Text className="text-base font-semibold text-neutral-900">
                  {client.full_name}
                </Text>
                <Text className="text-sm text-brand">Изменить</Text>
              </Pressable>
              <Field label="Что напомнить" value={summary} onChangeText={setSummary} placeholder="Чистка 2 шт" />
              <Text className="mb-2 text-xs font-medium text-neutral-500">Через</Text>
              <View className="mb-4 flex-row gap-2">
                {[3, 6, 12].map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMonths(m)}
                    className={`flex-1 items-center rounded-xl py-2.5 ${months === m ? "bg-brand" : "bg-neutral-100"}`}
                  >
                    <Text className={`text-sm font-semibold ${months === m ? "text-white" : "text-neutral-700"}`}>
                      {m} мес
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Button label="Создать" onPress={submit} disabled={create.isPending} loading={create.isPending} />
            </>
          )}
        </View>
      </Modal>
    </Screen>
  );
}
