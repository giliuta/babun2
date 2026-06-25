import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, SectionList, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronDown, ChevronRight, Plus } from "lucide-react-native";
import {
  formatEUR,
  formatEURSigned,
} from "@babun/shared/common/utils/money";
import {
  signedAmount,
  type FinanceTransaction,
} from "@babun/shared/local/finance/transaction";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { COLORS } from "@/components/ui/tokens";
import { humanDay } from "@/features/appointments/helpers";
import { useTeams } from "@/features/reference/queries";
import {
  useDeleteTransaction,
  useTransactions,
} from "@/features/finances/queries";
import { OperationSheet } from "@/features/finances/OperationSheet";
import { PeriodModal } from "@/features/finances/PeriodModal";
import { useAccountsWithBalances } from "@/features/finances/accounts";
import {
  defaultPeriod,
  periodLabel,
  type Period,
} from "@/features/finances/period";

const TYPE_LABEL: Record<FinanceTransaction["type"], string> = {
  income: "Доход",
  expense: "Расход",
  transfer: "Перевод",
  refund: "Возврат",
};

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View className="flex-1">
      <Text className="text-xs text-neutral-500">{label}</Text>
      <Text className={`mt-0.5 text-lg font-bold ${tone}`}>{value}</Text>
    </View>
  );
}

function TxRow({ tx, onPress }: { tx: FinanceTransaction; onPress: () => void }) {
  const signed = signedAmount(tx);
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center bg-white px-4 py-3 active:bg-neutral-50"
    >
      <View className="flex-1 pr-3">
        <Text className="text-base text-neutral-900" numberOfLines={1}>
          {tx.notes || TYPE_LABEL[tx.type]}
        </Text>
        <Text className="text-xs text-neutral-400">{TYPE_LABEL[tx.type]}</Text>
      </View>
      <Text
        className={`text-base font-semibold tabular-nums ${
          signed >= 0 ? "text-success" : "text-danger"
        }`}
      >
        {formatEURSigned(signed)}
      </Text>
    </Pressable>
  );
}

export default function FinancesTab() {
  const [period, setPeriod] = useState<Period>(defaultPeriod());
  const [scope, setScope] = useState<string | null>(null);
  const [opOpen, setOpOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinanceTransaction | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);

  const router = useRouter();
  const { data: teams = [] } = useTeams();
  const { data: accounts = [] } = useAccountsWithBalances();
  const accountsTotal = useMemo(
    () => accounts.reduce((s, a) => s + a.balance, 0),
    [accounts],
  );
  const {
    data: txs = [],
    isLoading,
    error,
  } = useTransactions(period.from, period.to, scope ? [scope] : undefined);

  const { income, expense, profit } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txs) {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
    }
    return { income, expense, profit: income - expense };
  }, [txs]);

  const sections = useMemo(() => {
    const byDate = new Map<string, FinanceTransaction[]>();
    for (const t of txs) {
      const arr = byDate.get(t.occurred_on) ?? [];
      arr.push(t);
      byDate.set(t.occurred_on, arr);
    }
    return [...byDate.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, data]) => ({
        title: date,
        net: data.reduce((s, t) => s + signedAmount(t), 0),
        data,
      }));
  }, [txs]);


  const header = (
    <View>
      {/* period selector */}
      <Pressable
        onPress={() => setPeriodOpen(true)}
        className="mx-4 mb-1 mt-1 flex-row items-center self-start rounded-full bg-neutral-100 px-3 py-1.5 active:opacity-80"
      >
        <Text className="text-sm font-semibold text-neutral-800">
          {periodLabel(period)}
        </Text>
        <ChevronDown color={COLORS.sub} size={16} />
      </Pressable>

      {/* team scope */}
      {teams.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
        >
          {[{ id: null as string | null, name: "Все" }, ...teams].map((t) => {
            const active = scope === t.id;
            return (
              <Pressable
                key={t.id ?? "all"}
                onPress={() => setScope(t.id)}
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

      {/* overview */}
      <View className="mx-4 mb-2 mt-1 rounded-2xl bg-white p-4 shadow-sm">
        <View className="flex-row">
          <Metric label="Доход" value={formatEUR(income)} tone="text-success" />
          <Metric label="Расход" value={formatEUR(expense)} tone="text-danger" />
        </View>
        <View className="my-3 h-px bg-neutral-100" />
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-neutral-500">Прибыль</Text>
          <Text className="text-xl font-bold" style={{ color: COLORS.brandAccent }}>
            {formatEUR(profit)}
          </Text>
        </View>
        {accounts.length > 0 ? (
          <>
            <View className="my-3 h-px bg-neutral-100" />
            <Pressable
              onPress={() => router.push("/cabinet/accounts")}
              className="flex-row items-center justify-between active:opacity-70"
            >
              <Text className="text-sm text-neutral-500">Счета</Text>
              <View className="flex-row items-center gap-1">
                <Text className="text-base font-semibold text-neutral-900 tabular-nums">
                  {formatEUR(accountsTotal)}
                </Text>
                <ChevronRight color={COLORS.chevron} size={16} />
              </View>
            </Pressable>
          </>
        ) : null}
      </View>

      <Text className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Операции · {txs.length}
      </Text>
    </View>
  );

  return (
    <Screen>
      <ScreenHeader large title="Финансы" />

      {isLoading ? (
        <EmptyState state="loading" fill />
      ) : error ? (
        <EmptyState state="error" fill subtitle={(error as Error).message} />
      ) : (
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          keyExtractor={(t) => t.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 96 }}
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-center justify-between bg-neutral-50 px-4 py-1.5">
              <Text className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {humanDay(section.title)}
              </Text>
              <Text className="text-xs font-semibold text-neutral-500 tabular-nums">
                {formatEURSigned(section.net)}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <TxRow
              tx={item}
              onPress={() => {
                setEditingTx(item);
                setOpOpen(true);
              }}
            />
          )}
          ItemSeparatorComponent={() => <View className="ml-4 h-px bg-neutral-100" />}
          ListEmptyComponent={
            <EmptyState
              title="Нет операций за период"
              subtitle="Нажмите + чтобы добавить"
            />
          }
        />
      )}

      <Pressable
        onPress={() => {
          setEditingTx(null);
          setOpOpen(true);
        }}
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

      <OperationSheet
        visible={opOpen}
        onClose={() => {
          setOpOpen(false);
          setEditingTx(null);
        }}
        defaultTeamId={scope}
        transaction={editingTx}
      />
      <PeriodModal
        visible={periodOpen}
        current={period}
        onClose={() => setPeriodOpen(false)}
        onApply={setPeriod}
      />
    </Screen>
  );
}
