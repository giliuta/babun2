import { View } from "react-native";

// Hairline separator. `inset` left-margin aligns with list content past a
// leading avatar/icon. Replaces the duplicated <View className="h-px ..." />.
export function Divider({ inset = 0 }: { inset?: number }) {
  return (
    <View
      className="h-px bg-neutral-100"
      style={inset ? { marginLeft: inset } : undefined}
    />
  );
}
