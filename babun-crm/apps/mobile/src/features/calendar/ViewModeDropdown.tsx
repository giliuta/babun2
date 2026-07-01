import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import { useThemeColors } from "@/theme/colors";

export type CalMode = "week" | "day" | "month" | "agenda";

const MODES: { key: CalMode; label: string }[] = [
  { key: "week", label: "Неделя" },
  { key: "day", label: "День" },
  { key: "month", label: "Месяц" },
  { key: "agenda", label: "Список" },
];
const LABEL: Record<CalMode, string> = {
  week: "Неделя",
  day: "День",
  month: "Месяц",
  agenda: "Список",
};

// Web-parity view switcher: a single labeled pill that opens a dropdown menu
// (NOT a segmented control). Current mode is accent + Check.
export function ViewModeDropdown({
  mode,
  onChange,
}: {
  mode: CalMode;
  onChange: (m: CalMode) => void;
}) {
  const t = useThemeColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({
          height: 36,
          paddingHorizontal: 12,
          borderRadius: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: pressed ? t.pressed : "transparent",
        })}
      >
        <Text style={{ fontSize: 15, fontWeight: "600", color: t.ink }}>
          {LABEL[mode]}
        </Text>
        <ChevronDown color={t.faint} size={16} strokeWidth={2.5} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)}>
          <View
            style={{
              position: "absolute",
              top: 100,
              right: 12,
              minWidth: 180,
              backgroundColor: t.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: t.separator,
              paddingVertical: 4,
              boxShadow: t.cardShadow,
            }}
          >
            {MODES.map((m) => {
              const cur = m.key === mode;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => {
                    onChange(m.key);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    paddingHorizontal: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    backgroundColor: pressed ? t.pressed : "transparent",
                  })}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: cur ? "600" : "400",
                      color: cur ? t.accent : t.ink,
                    }}
                  >
                    {m.label}
                  </Text>
                  {cur ? (
                    <Check color={t.accent} size={16} strokeWidth={2.5} />
                  ) : (
                    <View style={{ width: 16 }} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
