import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: "Не найдено" }} />
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="mb-4 text-lg text-neutral-900">Экран не найден</Text>
        <Link href="/" className="text-brand">
          На главную
        </Link>
      </View>
    </>
  );
}
