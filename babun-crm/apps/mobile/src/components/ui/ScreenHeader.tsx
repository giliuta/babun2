import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { COLORS, ICON } from "./tokens";

// Unified screen chrome. Two modes:
//  - default: back chevron + centered-left title + optional right action (44px taps)
//  - large:   big in-flow title for tab roots (no back), optional right action
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  large,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  large?: boolean;
}) {
  const router = useRouter();

  if (large) {
    return (
      <View className="flex-row items-end justify-between px-4 pb-2 pt-4">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-neutral-900">{title}</Text>
          {subtitle ? (
            <Text className="text-sm text-neutral-500">{subtitle}</Text>
          ) : null}
        </View>
        {right ? <View className="pb-1">{right}</View> : null}
      </View>
    );
  }

  return (
    <View className="flex-row items-center border-b border-neutral-100 px-1 py-1.5">
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={8}
        className="h-11 w-11 items-center justify-center rounded-full active:bg-neutral-100"
      >
        <ChevronLeft color={COLORS.body} size={ICON.md} />
      </Pressable>
      <View className="flex-1">
        <Text
          className="text-base font-semibold text-neutral-900"
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-xs text-neutral-500" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="min-w-11 items-end pr-1">{right}</View>
    </View>
  );
}
