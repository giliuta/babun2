import { type ComponentType, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { COLORS, ICON } from "./tokens";

// Standard list row: optional leading (avatar/icon) + title/subtitle +
// optional trailing + optional chevron. 44px+ tap height.
export function ListItem({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  chevron,
  titleClassName = "text-base text-neutral-900",
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  titleClassName?: string;
}) {
  const Comp = (onPress ? Pressable : View) as ComponentType<{
    onPress?: () => void;
    className?: string;
    children?: ReactNode;
  }>;
  return (
    <Comp
      onPress={onPress}
      className={`min-h-[52px] flex-row items-center px-4 py-2.5 ${
        onPress ? "active:bg-neutral-50" : ""
      }`}
    >
      {leading ? <View className="mr-3">{leading}</View> : null}
      <View className="flex-1 pr-2">
        <Text className={titleClassName} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-sm text-neutral-500" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? (
        <ChevronRight color={COLORS.chevron} size={ICON.sm} />
      ) : null}
    </Comp>
  );
}
