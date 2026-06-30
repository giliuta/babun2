import { View } from "react-native";
import { useThemeColors } from "@/theme/colors";

// Hairline separator (a color, never a real 1px border — DESIGN-SYSTEM §7).
// `inset` left-margin aligns with list content past a leading avatar/icon.
export function Divider({ inset = 0 }: { inset?: number }) {
  const t = useThemeColors();
  return (
    <View style={{ height: 1, marginLeft: inset || undefined, backgroundColor: t.separator }} />
  );
}
