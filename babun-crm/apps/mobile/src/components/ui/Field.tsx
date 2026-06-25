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
      <Text className="mb-1 text-sm font-medium text-neutral-700">{label}</Text>
      <TextInput
        placeholderTextColor="#a3a3a3"
        className="rounded-xl border border-neutral-300 px-4 py-3 text-base text-neutral-900"
        {...inputProps}
      />
      {error ? <Text className="mt-1 text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
