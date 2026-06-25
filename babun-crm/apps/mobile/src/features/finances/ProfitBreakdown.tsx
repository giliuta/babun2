import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { formatEUR } from "@babun/shared/common/utils/money";
import type { FinanceTransaction } from "@babun/shared/local/finance/transaction";
import type { FinanceCategory } from "@babun/shared/db/repositories/finance-categories";
import { EmptyState } from "@/components/ui/EmptyState";
import { COLORS } from "@/components/ui/tokens";

type Row = { id: string; amt: number };

// Income / expense broken down by category, with a profit hero and per-row
// proportion bars. Read-only view over the period's transactions.
export function ProfitBreakdown({
  transactions,
  categories,
}: {
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
}) {
  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const { incomeRows, expenseRows, income, expense } = useMemo(() => {
    const inc = new Map<string, number>();
    const exp = new Map<string, number>();
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      const key = t.category_id ?? "—";
      if (t.type === "income") {
        inc.set(key, (inc.get(key) ?? 0) + t.amount);
        income += t.amount;
      } else if (t.type === "expense") {
        exp.set(key, (exp.get(key) ?? 0) + t.amount);
        expense += t.amount;
      }
    }
    const toRows = (m: Map<string, number>): Row[] =>
      [...m.entries()]
        .map(([id, amt]) => ({ id, amt }))
        .sort((a, b) => b.amt - a.amt);
    return {
      incomeRows: toRows(inc),
      expenseRows: toRows(exp),
      income,
      expense,
    };
  }, [transactions]);

  const renderRow = (r: Row, total: number, color: string) => {
    const c = r.id === "—" ? null : catById.get(r.id);
    const pct = total > 0 ? (r.amt / total) * 100 : 0;
    return (
      <View key={`${color}-${r.id}`} className="px-4 py-2.5">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            {c?.color ? (
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: c.color }}
              />
            ) : null}
            <Text className="text-base text-neutral-900">
              {c?.name ?? "Без категории"}
            </Text>
          </View>
          <Text className="text-base font-semibold tabular-nums" style={{ color }}>
            {formatEUR(r.amt)}
          </Text>
        </View>
        <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <View
            className="h-1.5 rounded-full"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </View>
      </View>
    );
  };

  if (income === 0 && expense === 0) {
    return <EmptyState fill title="Нет данных за период" />;
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 96 }}>
      <View className="mx-3 mt-2 rounded-2xl bg-white p-4 shadow-sm">
        <Text className="text-xs text-neutral-500">Прибыль за период</Text>
        <Text
          className="text-3xl font-bold"
          style={{ color: COLORS.brandAccent }}
        >
          {formatEUR(income - expense)}
        </Text>
      </View>

      {expenseRows.length > 0 ? (
        <View className="mt-1">
          <Text className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Расходы · {formatEUR(expense)}
          </Text>
          {expenseRows.map((r) => renderRow(r, expense, COLORS.danger))}
        </View>
      ) : null}

      {incomeRows.length > 0 ? (
        <View className="mt-1">
          <Text className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Доходы · {formatEUR(income)}
          </Text>
          {incomeRows.map((r) => renderRow(r, income, COLORS.success))}
        </View>
      ) : null}
    </ScrollView>
  );
}
