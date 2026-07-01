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
import { useToast } from "@/components/ui/Toast";
import { useThemeColors } from "@/theme/colors";
import { formatYMD } from "@/features/appointments/helpers";
import { useAppointments } from "@/features/calendar/queries";
import { useClients } from "@/features/clients/queries";
import { useUpdateAppointment } from "@/features/calendar/mutations";

const CLOSED_PREFIX = "babun:closed-day:";

// Persisted closure snapshot — so the «День закрыт» summary survives a reload
// (the old code stored a bare "1" and lost the cash figures).
type ClosedRecord = {
  closedAt: string;
  expectedCash: number;
  actualCash: number;
  delta: number;
};

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  const t = useThemeColors();
  return (
    <View className="flex-row items-center justify-between px-4 py-2">
      <Text className="text-[15px]" style={{ color: t.sub }}>
        {label}
      </Text>
      <Text
        className={`text-[15px] tabular-nums ${tone ? "font-bold" : "font-semibold"}`}
        style={{
          color:
            tone === "green" ? t.success : tone === "red" ? t.danger : t.ink,
        }}
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
  const t = useThemeColors();

  const todayKey = useMemo(() => formatYMD(new Date()), []);
  const [actualCashStr, setActualCashStr] = useState("");
  const [closedRec, setClosedRec] = useState<ClosedRecord | null>(() => {
    const raw = getStorage().getRaw(`${CLOSED_PREFIX}${todayKey}`);
    if (!raw) return null;
    if (raw === "1") {
      // legacy bare flag — closed, but the cash figures weren't saved
      return { closedAt: "", expectedCash: 0, actualCash: 0, delta: 0 };
    }
    try {
      return JSON.parse(raw) as ClosedRecord;
    } catch {
      return null;
    }
  });
  const closed = closedRec !== null;

  const nameById = useMemo(
    () => new Map(clients.map((c) => [c.id, c.full_name])),
    [clients],
  );
  const clientName = (a: Appointment) =>
    (a.client_id && nameById.get(a.client_id)) || a.comment || "Запись";

  const { completed, inProgress, stillScheduled, unpaid, income, cash } =
    useMemo(() => {
      const day = appts.filter((a) => a.date === todayKey);
      const completed = day.filter((a) => a.status === "completed");
      const inProgress = day.filter((a) => a.status === "in_progress");
      const stillScheduled = day.filter(
        (a) => a.status === "scheduled" && a.kind === "work",
      );
      const unpaid = completed.filter((a) => getDebtAmount(a) > 0);
      const income = completed.reduce((s, a) => s + (a.total_amount || 0), 0);
      // Expected TILL cash = cash-method payments received on the day's
      // appointments. Card/transfer/unpaid jobs never hit the till, so the old
      // `income` (total invoiced) made the касса delta meaningless.
      const cash = day.reduce(
        (s, a) =>
          s +
          (a.payments ?? [])
            .filter((p) => p.method === "cash")
            .reduce((ps, p) => ps + (p.amount || 0), 0),
        0,
      );
      return { completed, inProgress, stillScheduled, unpaid, income, cash };
    }, [appts, todayKey]);

  const expectedCash = cash;
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
    const rec: ClosedRecord = {
      closedAt: new Date().toISOString(),
      expectedCash,
      actualCash,
      delta,
    };
    getStorage().setRaw(`${CLOSED_PREFIX}${todayKey}`, JSON.stringify(rec));
    setClosedRec(rec);
    toast("День закрыт");
  };
  const reopen = () => {
    getStorage().remove(`${CLOSED_PREFIX}${todayKey}`);
    setClosedRec(null);
  };

  return (
    <Screen edges={["top"]}>
      <ScreenHeader title="Закрыть день" />
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        {closedRec ? (
          <View
            className="mx-3 mt-2 flex-row items-start gap-3 rounded-2xl p-4"
            style={{ backgroundColor: t.success + "1a" }}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: t.success }}
            >
              <Check color="#fff" size={22} strokeWidth={2.5} />
            </View>
            <View className="flex-1">
              <Text
                className="text-[17px] font-semibold"
                style={{ color: t.ink }}
              >
                День закрыт
              </Text>
              <Text className="mt-0.5 text-[13px]" style={{ color: t.sub }}>
                Касса {formatEUR(closedRec.actualCash)} ·{" "}
                {closedRec.delta === 0
                  ? "без расхождений"
                  : closedRec.delta > 0
                    ? `+${formatEUR(closedRec.delta)}`
                    : `${formatEUR(closedRec.delta)}`}
              </Text>
              <Pressable onPress={reopen} className="mt-2 active:opacity-70">
                <Text
                  className="text-[13px] font-semibold underline"
                  style={{ color: t.success }}
                >
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
                className="mx-3 my-1 flex-row items-center gap-3 rounded-xl p-2"
                style={{ backgroundColor: t.danger + "0d" }}
              >
                <View className="flex-1">
                  <Text
                    className="text-[15px] font-semibold"
                    style={{ color: t.ink }}
                    numberOfLines={1}
                  >
                    {clientName(apt)}
                  </Text>
                  <Text
                    className="text-xs tabular-nums"
                    style={{ color: t.sub }}
                  >
                    {apt.time_start} · долг {formatEUR(getDebtAmount(apt))}
                  </Text>
                </View>
                <Pressable
                  onPress={() => markPaidCash(apt)}
                  className="h-9 items-center justify-center rounded-lg px-3 active:opacity-80"
                  style={{ backgroundColor: t.success }}
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: "#fff" }}
                  >
                    Оплачено
                  </Text>
                </Pressable>
              </View>
            ))}
            {stillScheduled.map((apt) => (
              <View
                key={apt.id}
                className="mx-3 my-1 flex-row items-center gap-3 rounded-xl p-2"
                style={{ backgroundColor: t.warning + "1a" }}
              >
                <View className="flex-1">
                  <Text
                    className="text-[15px] font-semibold"
                    style={{ color: t.ink }}
                    numberOfLines={1}
                  >
                    {clientName(apt)}
                  </Text>
                  <Text
                    className="text-xs tabular-nums"
                    style={{ color: t.sub }}
                  >
                    {apt.time_start}–{apt.time_end} · ещё в плане
                  </Text>
                </View>
                <Pressable
                  onPress={() => moveToTomorrow(apt)}
                  className="h-9 items-center justify-center rounded-lg px-3 active:opacity-80"
                  style={{
                    backgroundColor: t.dark
                      ? "rgba(255,255,255,0.07)"
                      : "#eef1f5",
                  }}
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{ color: t.sub }}
                  >
                    На завтра
                  </Text>
                </Pressable>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {!closed ? (
          <SectionCard title="Касса" padded>
            <View className="flex-row items-baseline justify-between">
              <Text className="text-[15px]" style={{ color: t.sub }}>
                Должно быть
              </Text>
              <Text
                className="text-[15px] font-semibold tabular-nums"
                style={{ color: t.ink }}
              >
                {formatEUR(expectedCash)}
              </Text>
            </View>
            <Text
              className="mb-1.5 mt-3 text-[12px] font-semibold uppercase tracking-wider"
              style={{ color: t.sub }}
            >
              Сколько в кассе фактически (€)
            </Text>
            <TextInput
              value={actualCashStr}
              onChangeText={setActualCashStr}
              keyboardType="decimal-pad"
              placeholder={String(expectedCash)}
              placeholderTextColor={t.placeholder}
              selectionColor={t.accent}
              keyboardAppearance={t.dark ? "dark" : "light"}
              className="h-12 rounded-[10px] px-3.5 text-[17px] tabular-nums"
              style={{
                backgroundColor: t.dark ? "rgba(255,255,255,0.07)" : "#eef1f5",
                color: t.ink,
              }}
            />
            {actualCashStr ? (
              <Text
                className="mt-2 text-[13px] font-medium tabular-nums"
                style={{ color: delta >= 0 ? t.success : t.danger }}
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
