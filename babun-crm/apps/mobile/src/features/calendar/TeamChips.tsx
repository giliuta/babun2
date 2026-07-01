import { Pressable, ScrollView, Text, View } from "react-native";
import { useThemeColors } from "@/theme/colors";

export type ChipTeam = { id: string; name: string; color?: string | null };

// Web-parity brigade tabs: horizontal pills. Active = filled team colour + white
// label; idle+colour = outline in the brigade hue; idle = separator-bordered.
export function TeamChips({
  teams,
  activeId,
  onSelect,
}: {
  teams: ChipTeam[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const t = useThemeColors();
  if (teams.length === 0) return null;
  const all: ChipTeam[] = [{ id: "__all__", name: "Все", color: null }, ...teams];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, backgroundColor: t.surface }}
      contentContainerStyle={{
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 7,
        gap: 8,
        alignItems: "center",
      }}
    >
      {all.map((tm) => {
        const id = tm.id === "__all__" ? null : tm.id;
        const active = activeId === id;
        const color = tm.color || null;
        let bg: string;
        let fg: string;
        let border: string;
        if (active) {
          bg = color || t.accent;
          fg = "#ffffff";
          border = color || t.accent;
        } else if (color) {
          bg = t.surface;
          fg = color;
          border = color;
        } else {
          bg = t.surface;
          fg = t.ink;
          border = t.separator;
        }
        return (
          <Pressable
            key={tm.id}
            onPress={() => onSelect(id)}
            style={({ pressed }) => ({
              height: 32,
              paddingHorizontal: 14,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: bg,
              borderWidth: 1,
              borderColor: border,
              maxWidth: 180,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text style={{ fontSize: 12, fontWeight: "600", color: fg }} numberOfLines={1}>
              {tm.name}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
