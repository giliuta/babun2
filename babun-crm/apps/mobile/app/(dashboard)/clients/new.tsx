import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useCreateClient } from "@/features/clients/queries";

export default function NewClientScreen() {
  const router = useRouter();
  const create = useCreateClient();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Save-gate: phone is the primary required field (add-client design).
  const canSave = phone.trim().length > 0 && !create.isPending;

  async function handleCreate() {
    setError(null);
    try {
      const c = await create.mutateAsync({
        phone: phone.trim(),
        full_name: name.trim(),
      });
      router.replace(`/clients/${c.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen edges={["top"]}>
      <View className="flex-row items-center border-b border-neutral-100 px-2 py-2">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-neutral-100"
        >
          <ChevronLeft color="#404040" size={22} />
        </Pressable>
        <Text className="flex-1 text-base font-semibold text-neutral-900">
          Новый клиент
        </Text>
      </View>

      <View className="px-6 pt-6">
        <Field
          label="Телефон"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+357 99 123456"
          autoFocus
        />
        <Field
          label="Имя"
          value={name}
          onChangeText={setName}
          placeholder="Имя клиента"
        />
        {error ? (
          <Text className="mb-3 text-sm text-danger">{error}</Text>
        ) : null}
        <Button
          label="Создать"
          onPress={handleCreate}
          disabled={!canSave}
          loading={create.isPending}
        />
      </View>
    </Screen>
  );
}
