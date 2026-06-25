import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

// Grouped-iOS card. Replaces the repeated
// `mx-3 mt-2 rounded-2xl bg-white shadow-sm` pattern. No inner padding by
// default (lists sit flush); pass `padded` for form/content cards.
export function SectionCard({
  title,
  action,
  padded,
  className = "",
  children,
}: {
  title?: string;
  action?: { label: string; onPress: () => void };
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <View
      className={`mx-3 mt-2 overflow-hidden rounded-2xl bg-white shadow-sm ${className}`}
    >
      {title ? (
        <View className="flex-row items-center justify-between px-4 pb-1 pt-3">
          <Text className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {title}
          </Text>
          {action ? (
            <Pressable onPress={action.onPress} hitSlop={8}>
              <Text className="text-sm font-medium text-brand">
                {action.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {padded ? <View className="p-4 pt-2">{children}</View> : children}
    </View>
  );
}
