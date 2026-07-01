import { Pressable, Text, View } from "react-native";
import { CalendarDays, ChevronDown, Settings } from "lucide-react-native";
import { useThemeColors } from "@/theme/colors";
import { ViewModeDropdown, type CalMode } from "@/features/calendar/ViewModeDropdown";

// Web-parity calendar top bar: gear · «{Month} {Year} ⌄» · today · view dropdown.
export function CalendarHeader({
  monthTitle,
  mode,
  onModeChange,
  onGear,
  onToday,
}: {
  monthTitle: string;
  mode: CalMode;
  onModeChange: (m: CalMode) => void;
  onGear: () => void;
  onToday: () => void;
}) {
  const t = useThemeColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        paddingHorizontal: 6,
        minHeight: 48,
        backgroundColor: t.surface,
        borderBottomWidth: 1,
        borderBottomColor: t.separator,
      }}
    >
      <Pressable
        onPress={onGear}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 22,
          backgroundColor: pressed ? t.pressed : "transparent",
        })}
      >
        <Settings color={t.sub} size={21} strokeWidth={2} />
      </Pressable>

      <Pressable
        onPress={onToday}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          height: 44,
          paddingHorizontal: 6,
          borderRadius: 12,
          backgroundColor: pressed ? t.pressed : "transparent",
        })}
      >
        <Text
          style={{ fontSize: 17, fontWeight: "700", color: t.ink, textTransform: "capitalize" }}
          numberOfLines={1}
        >
          {monthTitle}
        </Text>
        <ChevronDown color={t.faint} size={15} strokeWidth={2.5} />
      </Pressable>

      <Pressable
        onPress={onToday}
        hitSlop={6}
        style={({ pressed }) => ({
          width: 40,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 20,
          backgroundColor: pressed ? t.pressed : "transparent",
        })}
      >
        <CalendarDays color={t.sub} size={20} strokeWidth={2} />
      </Pressable>

      <ViewModeDropdown mode={mode} onChange={onModeChange} />
    </View>
  );
}
