import { useMemo } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { formatEUR } from "@babun/shared/common/utils/money";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import { Screen } from "@/components/ui/Screen";
import { useTransactions } from "@/features/finances/queries";

// Phase 6 first pass: a finances overview (income / expense / profit + the
// operations list). Period picker, per-account scope and PDF are deferred to
// the full finances v5 design.
const FROM = "2026-01-01";
const TO = "2026-12-31";

const TYPE_LABEL: Record<FinanceTransaction["type"], string> = {
  income: "Доход",
  expense: "Расход",
  transfer: "Перевод",
  refund: "Возврат",
};

function SummaryItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View>
      <Text className="text-xs text-neutral-500">{label}</Text>
      <Text className={`mt-0.5 text-lg font-bold ${tone}`}>{value}</Text>
    </View>
  );
}

function TxRow({ tx }: { tx: FinanceTransaction }) {
  const isIncome = tx.type === "income";
  const isExpense = tx.type === "expense";
  return (
    <View className="flex-row items-center px-4 py-3">
      <View className="flex-1 pr-3">
        <Text className="text-base text-neutral-900" numberOfLines={1}>
          {tx.notes || TYPE_LABEL[tx.type]}
        </Text>
        <Text className="text-xs text-neutral-500 tabular-nums">
          {tx.occurred_on}
        </Text>
      </View>
      <Text
        className={`text-base font-semibold tabular-nums ${
          isIncome ? "text-success" : isExpense ? "text-danger" : "text-neutral-700"
        }`}
      >
        {isExpense ? "−" : isIncome ? "+" : ""}
        {formatEUR(tx.amount)}
      </Text>
    </View>
  );
}

export default function FinancesTab() {
  const { data, isLoading, error } = useTransactions(FROM, TO);
  const txs = data ?? [];

  const { income, expense, profit } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of txs) {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expense += t.amount;
    }
    return { income, expense, profit: income - expense };
  }, [txs]);

  return (
    <Screen>
      <View className="px-4 pb-2 pt-4">
        <Text className="text-2xl font-bold text-neutral-900">Финансы</Text>
        <Text className="text-sm text-neutral-500">2026 год</Text>
      </View>

      <View className="mx-4 mb-2 rounded-2xl bg-white p-4 shadow-sm">
        <View className="flex-row justify-between">
          <SummaryItem label="Доход" value={formatEUR(income)} tone="text-success" />
          <SummaryItem label="Расход" value={formatEUR(expense)} tone="text-danger" />
        </View>
        <View className="my-3 h-px bg-neutral-100" />
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-neutral-500">Прибыль</Text>
          <Text className="text-xl font-bold text-brand">{formatEUR(profit)}</Text>
        </View>
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
        <FlatList
          style={{ flex: 1 }}
          data={txs}
          keyExtractor={(t) => t.id}
          ListHeaderComponent={
            <Text className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Операции · {txs.length}
            </Text>
          }
          renderItem={({ item }) => <TxRow tx={item} />}
          ItemSeparatorComponent={() => (
            <View className="ml-4 h-px bg-neutral-100" />
          )}
          ListEmptyComponent={
            <View className="items-center pt-16">
              <Text className="text-sm text-neutral-400">Нет операций</Text>
            </View>
          }
        />
      )}
    </Screen>
  );
}
