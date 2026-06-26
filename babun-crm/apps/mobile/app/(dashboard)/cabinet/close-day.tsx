import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View, Pressable } from "react-native";
import { Check } from "lucide-react-native";
import {
  getDebtAmount,
  type Appointment,
} from "@babun/shared/local/appointments";
import { formatEUR } from "@babun/shared/common/utils/money";
import { getStorage } from "@babun/shared/storage";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { COLORS } from "@/components/ui/tokens";
import { useToast } from "@/components/ui/Toast";
import { formatYMD } from "@/features/appointments/helpers";
import { useAppointments } from "@/features/calendar/queries";
import { useClients } from "@/features/clients/queries";
import { useUpdateAppointment } from "@/features/calendar/mutations";

const CLOSED_PREFIX = "babun:closed-day:";

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  return (
    <View className="flex-row items-center justify-between px-4 py-2">
      <Text className="text-[15px] text-neutral-500">{label}</Text>
      <Text
        className={`text-[15px] tabular-nums ${tone === "green" ? "font-bold text-success" : tone === "red" ? "font-bold text-danger" : "font-semibold text-neutral-900"}`}
      >
        {value}
      </Text>
    </View>
  );
}

export default function CloseDayScreen() {
  const { data: appts = [] } = useAppointments();
  const { data: clients = [] } = useClients();
  const update = useUpdateAppointment();
  const toast = useToast();

  const todayKey = useMemo(() => formatYMD(new Date()), []);
  const [actualCashStr, setActualCashStr] = useState("");
  const [closed, setClosed] = useState(
    () => getStorage().getRaw(`${CLOSED_PREFIX}${todayKey}`) === "1",
  );

  const nameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.full_name])),
    [clients],
  );
  const clientName = (a: Appointment) =>
    (a.client_id && nameById.get(a.client_id)) || a.comment || "Запись";

  const { completed, inProgress, stillScheduled, unpaid, income } =
    useMemo(() => {
      const day = appts.filter((a) => a.date === todayKey);
      const completed = day.filter((a) => a.status === "completed");
      const inProgress = day.filter((a) => a.status === "in_progress");
      const stillScheduled = day.filter(
        (a) => a.status === "scheduled" && a.kind === "work",
      );
      const unpaid = completed.filter((a) => getDebtAmount(a) > 0);
      const income = completed.reduce((s, a) => s + (a.total_amount || 0), 0);
      return { completed, inProgress, stillScheduled, unpaid, income };
    }, [appts, todayKey]);

  const expectedCash = income;
  const actualCash = Math.round(Number(actualCashStr.replace(",", ".")) || 0);
  const delta = actualCash - expectedCash;

  const markPaidCash = (apt: Appointment) => {
    const debt = getDebtAmount(apt);
    if (debt <= 0) return;
    update.mutate({
      id: apt.id,
      patch: {
        payments: [
          ...(apt.payments ?? []),
          {
            id: `pay_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            method: "cash",
            amount: debt,
            paid_at: new Date().toISOString(),
          },
        ],
      },
    });
    toast("Оплата отмечена");
  };

  const moveToTomorrow = (apt: Appointment) => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    update.mutate({ id: apt.id, patch: { date: formatYMD(next) } });
    toast("Перенесено на завтра");
  };

  const closeDay = () => {
    getStorage().setRaw(`${CLOSED_PREFIX}${todayKey}`, "1");
    setClosed(true);
    toast("День закрыт");
  };
  const reopen = () => {
    getStorage().remove(`${CLOSED_PREFIX}${todayKey}`);
    setClosed(false);
  };

  return (
    <Screen edges={["top"]}>
      <ScreenHeader title="Закрыть день" />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        {closed ? (
          <View className="mx-3 mt-2 flex-row items-start gap-3 rounded-2xl bg-success/10 p-4">
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-success">
              <Check color="#fff" size={22} strokeWidth={2.5} />
            </View>
            <View className="flex-1">
              <Text className="text-[17px] font-semibold text-neutral-900">
                День закрыт
              </Text>
              <Text className="mt-0.5 text-[13px] text-neutral-500">
                Касса {formatEUR(actualCash)} ·{" "}
                {delta === 0
                  ? "без расхождений"
                  : delta > 0
                    ? `+${formatEUR(delta)}`
                    : `${formatEUR(delta)}`}
              </Text>
              <Pressable onPress={reopen} className="mt-2 active:opacity-70">
                <Text className="text-[13px] font-semibold text-success underline">
                  Открыть обратно
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <SectionCard title="Сегодня">
          <Row label="Завершено" value={String(completed.length)} />
          <Row label="В работе" value={String(inProgress.length)} />
          <Row label="Ещё запланировано" value={String(stillScheduled.length)} />
          <Row label="Доход" value={formatEUR(income)} tone="green" />
        </SectionCard>

        {!closed && (unpaid.length > 0 || stillScheduled.length > 0) ? (
          <SectionCard title="Что осталось">
            {unpaid.map((apt) => (
              <View
                key={apt.id}
                className="mx-3 my-1 flex-row items-center gap-3 rounded-xl bg-danger/5 p-2"
              >
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-neutral-900" numberOfLines={1}>
                    {clientName(apt)}
                  </Text>
                  <Text className="text-xs text-neutral-500 tabular-nums">
                    {apt.time_start} · долг {formatEUR(getDebtAmount(apt))}
                  </Text>
                </View>
                <Pressable
                  onPress={() => markPaidCash(apt)}
                  className="h-9 items-center justify-center rounded-lg bg-success px-3 active:opacity-80"
                >
                  <Text className="text-[13px] font-semibold text-white">Оплачено</Text>
                </Pressable>
              </View>
            ))}
            {stillScheduled.map((apt) => (
              <View
                key={apt.id}
                className="mx-3 my-1 flex-row items-center gap-3 rounded-xl bg-warning/10 p-2"
              >
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-neutral-900" numberOfLines={1}>
                    {clientName(apt)}
                  </Text>
                  <Text className="text-xs text-neutral-500 tabular-nums">
                    {apt.time_start}–{apt.time_end} · ещё в плане
                  </Text>
                </View>
                <Pressable
                  onPress={() => moveToTomorrow(apt)}
                  className="h-9 items-center justify-center rounded-lg bg-neutral-100 px-3 active:opacity-80"
                >
                  <Text className="text-[13px] font-semibold text-neutral-700">На завтра</Text>
                </Pressable>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {!closed ? (
          <SectionCard title="Касса" padded>
            <View className="flex-row items-baseline justify-between">
              <Text className="text-[15px] text-neutral-500">Должно быть</Text>
              <Text className="text-[15px] font-semibold text-neutral-900 tabular-nums">
                {formatEUR(expectedCash)}
              </Text>
            </View>
            <Text className="mb-1.5 mt-3 text-[12px] font-semibold uppercase tracking-wider text-neutral-500">
              Сколько в кассе фактически (€)
            </Text>
            <TextInput
              value={actualCashStr}
              onChangeText={setActualCashStr}
              keyboardType="decimal-pad"
              placeholder={String(expectedCash)}
              placeholderTextColor={COLORS.faint}
              className="h-12 rounded-[10px] bg-neutral-100 px-3.5 text-[17px] text-neutral-900 tabular-nums"
            />
            {actualCashStr ? (
              <Text
                className={`mt-2 text-[13px] font-medium tabular-nums ${delta >= 0 ? "text-success" : "text-danger"}`}
              >
                {delta === 0
                  ? "Касса сошлась"
                  : delta > 0
                    ? `+${formatEUR(delta)} больше ожидаемого`
                    : `Не хватает ${formatEUR(Math.abs(delta))}`}
              </Text>
            ) : null}
            <View className="mt-4">
              <Button label="Закрыть день" onPress={closeDay} disabled={!actualCashStr} />
            </View>
          </SectionCard>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
