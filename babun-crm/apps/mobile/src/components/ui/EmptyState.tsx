import { type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { COLORS } from "./tokens";

// Consistent empty / loading / error surface. `fill` centers full-screen
// (loading); otherwise it's a padded block usable as a FlatList
// ListEmptyComponent.
export function EmptyState({
  state = "empty",
  title,
  subtitle,
  icon,
  action,
  fill,
}: {
  state?: "empty" | "loading" | "error";
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: { label: string; onPress: () => void };
  fill?: boolean;
}) {
  const wrap = fill
    ? "flex-1 items-center justify-center px-8"
    : "items-center px-8 py-16";

  if (state === "loading") {
    return (
      <View className={wrap}>
        <ActivityIndicator color={COLORS.brand} />
      </View>
    );
  }

  return (
    <View className={wrap}>
      {icon ? <View className="mb-3 opacity-40">{icon}</View> : null}
      <Text
        className={`text-center text-base font-medium ${
          state === "error" ? "text-danger" : "text-neutral-500"
        }`}
      >
        {title ?? (state === "error" ? "Что-то пошло не так" : "Пусто")}
      </Text>
      {subtitle ? (
        <Text className="mt-1 text-center text-sm text-neutral-400">
          {subtitle}
        </Text>
      ) : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          className="mt-4 rounded-full bg-brand px-5 py-2.5 active:opacity-80"
        >
          <Text className="text-sm font-semibold text-white">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
