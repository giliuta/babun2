import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Plus } from "lucide-react-native";
import { formatEUR } from "@babun/shared/common/utils/money";
import { Screen } from "@/components/ui/Screen";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  useCreateService,
  useServices,
  type Service,
} from "@/features/services/queries";

function ServiceRow({ s }: { s: Service }) {
  return (
    <View className="flex-row items-center px-4 py-3">
      <View className="flex-1 pr-3">
        <Text className="text-base font-semibold text-neutral-900" numberOfLines={1}>
          {s.name}
        </Text>
        <Text className="text-sm text-neutral-500">{s.duration_minutes} мин</Text>
      </View>
      <Text className="text-base font-semibold text-neutral-900 tabular-nums">
        {formatEUR(Number(s.price))}
      </Text>
    </View>
  );
}

export default function ServicesScreen() {
  const router = useRouter();
  const { data: services = [], isLoading } = useServices();
  const create = useCreateService();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("60");

  const submit = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({
      name: name.trim(),
      price: Number(price) || 0,
      duration_minutes: Number(duration) || 60,
    });
    setName("");
    setPrice("");
    setDuration("60");
    setOpen(false);
  };

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
          Услуги
        </Text>
        <Pressable
          onPress={() => setOpen(true)}
          className="h-9 w-9 items-center justify-center rounded-lg active:bg-neutral-100"
        >
          <Plus color="#4338ca" size={22} />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={services}
          keyExtractor={(s) => s.id}
          renderItem={({ item }) => <ServiceRow s={item} />}
          ItemSeparatorComponent={() => (
            <View className="ml-4 h-px bg-neutral-100" />
          )}
          ListEmptyComponent={
            <View className="items-center pt-20">
              <Text className="text-sm text-neutral-400">
                Нет услуг — добавьте первую через +
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable className="flex-1 bg-black/30" onPress={() => setOpen(false)} />
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-5 pb-8">
          <Text className="mb-3 text-lg font-bold text-neutral-900">
            Новая услуга
          </Text>
          <Field
            label="Название"
            value={name}
            onChangeText={setName}
            placeholder="Напр. Чистка кондиционера"
            autoFocus
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="Цена €"
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
            <View className="flex-1">
              <Field
                label="Минут"
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholder="60"
              />
            </View>
          </View>
          <Button
            label="Создать"
            onPress={submit}
            disabled={!name.trim() || create.isPending}
            loading={create.isPending}
          />
        </View>
      </Modal>
    </Screen>
  );
}
