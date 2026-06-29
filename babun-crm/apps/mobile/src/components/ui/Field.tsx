import { Text, TextInput, View, type TextInputProps } from "react-native";

// Labeled text input. Works standalone (value/onChangeText) and pairs cleanly
// with TanStack Form fields (pass value + onChangeText + error from the field).
export function Field({
  label,
  error,
  ...inputProps
}: { label: string; error?: string | null } & TextInputProps) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-sm font-medium text-sub">{label}</Text>
      <TextInput
        placeholderTextColor="#97a0ae"
        className="rounded-[14px] border border-separator px-4 py-3 text-base text-ink"
        {...inputProps}
      />
      {error ? <Text className="mt-1 text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
