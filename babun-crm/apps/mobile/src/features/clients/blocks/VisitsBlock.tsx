import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Appointment } from "@babun/shared/local/appointments";
import type { ClientStats } from "@babun/shared/local/selectors/client-stats";
import { formatEUR } from "@babun/shared/common/utils/money";

// VisitsBlock (mobile port of apps/web/.../blocks/VisitsBlock.tsx).
//
// «История визитов» — appointment history newest-first, with status +
// payment pills and the amount. Tapping a row jumps to the calendar
// focused on that visit's date (web pushed /dashboard?date=…; mobile
// routes to the dashboard tab with the same query param).
//
// DEGRADED vs web: the web summary string resolves service NAMES from a
// `services` catalog prop. Mobile doesn't wire the services catalog into
// the client card yet, so the summary falls back to a de-duped service
// COUNT («N услуг») or the appointment comment. The «Повторить» one-tap
// repeat button is also dropped (it built a /dashboard?new= deep link that
// the mobile new-appointment flow doesn't accept yet — see composer TODO).
//
// `stats` is accepted for prop-contract parity with the other blocks; this
// block derives everything it shows straight off `appointments`.

interface VisitsBlockProps {
  appointments: Appointment[];
  stats?: ClientStats;
}

const LIMIT = 50;

export default function VisitsBlock({ appointments }: VisitsBlockProps) {
  const router = useRouter();

  const own = useMemo(
    () =>
      [...appointments].sort((a, b) =>
        `${b.date}${b.time_start}`.localeCompare(`${a.date}${a.time_start}`),
      ),
    [appointments],
  );

  return (
    <View className="mx-3 mt-2 rounded-2xl bg-white p-3 shadow-sm">
      <Text className="px-1 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        История визитов {own.length > 0 ? `· ${own.length}` : ""}
      </Text>

      {own.length === 0 ? (
        <Text className="px-1 py-2 text-sm text-neutral-400">
          Записей пока нет.
        </Text>
      ) : (
        <View>
          {own.slice(0, LIMIT).map((apt) => (
            <VisitRow
              key={apt.id}
              apt={apt}
              onOpen={() =>
                router.push(
                  `/(dashboard)?date=${encodeURIComponent(apt.date)}`,
                )
              }
            />
          ))}
          {own.length > LIMIT ? (
            <Text className="px-1 pt-2 text-center text-xs text-neutral-400">
              + ещё {own.length - LIMIT} визитов
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function VisitRow({
  apt,
  onOpen,
}: {
  apt: Appointment;
  onOpen: () => void;
}) {
  const status = statusPill(apt);
  const payment = paymentPill(apt);
  const summary = visitSummary(apt);

  return (
    <Pressable
      onPress={onOpen}
      className="flex-row items-center gap-2 border-t border-neutral-100 py-2.5 active:bg-neutral-50"
    >
      <View className="min-w-0 flex-1">
        <Text className="text-sm text-neutral-900" numberOfLines={1}>
          {summary}
        </Text>
        <Text className="text-xs text-neutral-500">
          {formatVisitDate(apt.date)} · {apt.time_start}
        </Text>
      </View>

      <View className="shrink-0 items-end gap-1">
        <View className={`rounded-full px-2 py-0.5 ${status.bg}`}>
          <Text className={`text-[10px] font-semibold ${status.text}`}>
            {status.label}
          </Text>
        </View>
        {payment ? (
          <View className={`rounded-full px-2 py-0.5 ${payment.bg}`}>
            <Text className={`text-[10px] font-semibold ${payment.text}`}>
              {payment.label}
            </Text>
          </View>
        ) : null}
      </View>

      <Text className="w-16 shrink-0 text-right text-sm font-bold text-success">
        {formatEUR(apt.total_amount)}
      </Text>
    </Pressable>
  );
}

function statusPill(apt: Appointment): {
  label: string;
  bg: string;
  text: string;
} {
  switch (apt.status) {
    case "completed":
      return { label: "Выполнено", bg: "bg-success/15", text: "text-success" };
    case "cancelled":
      return {
        label: "Отменено",
        bg: "bg-neutral-100",
        text: "text-neutral-500",
      };
    case "in_progress":
      return { label: "В работе", bg: "bg-warning/15", text: "text-amber-700" };
    default:
      return {
        label: "Запланировано",
        bg: "bg-brand/10",
        text: "text-brand",
      };
  }
}

function paymentPill(
  apt: Appointment,
): { label: string; bg: string; text: string } | null {
  if (apt.status !== "completed") return null;
  switch (apt.payment_status) {
    case "paid":
      return { label: "Оплачено", bg: "bg-success/15", text: "text-success" };
    case "partial":
      return { label: "Частично", bg: "bg-warning/15", text: "text-amber-700" };
    case "refunded":
      return { label: "Возврат", bg: "bg-danger/10", text: "text-danger" };
    case "unpaid":
      return { label: "К оплате", bg: "bg-warning/15", text: "text-amber-700" };
    default:
      // Legacy fallback — rows older than the payment_status wiring.
      if (apt.payment) {
        return { label: "Оплачено", bg: "bg-success/15", text: "text-success" };
      }
      return null;
  }
}

// Web resolves service names from a catalog; mobile lacks that wiring, so we
// de-dupe service ids and show a count, falling back to the comment.
function visitSummary(apt: Appointment): string {
  const ids = new Set(
    (apt.services ?? []).map((s) => s.serviceId).filter(Boolean),
  );
  if (ids.size > 0) {
    return `${ids.size} ${pluralService(ids.size)}`;
  }
  return apt.comment?.trim() || "—";
}

function pluralService(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "услуга";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "услуги";
  return "услуг";
}

function formatVisitDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
