import { Text, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Divider } from "@/components/ui/Divider";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/providers/SessionProvider";
import { supabase } from "@/lib/supabase";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="px-4 py-3">
      <Text className="text-xs text-neutral-400">{label}</Text>
      <Text className="mt-0.5 text-base text-neutral-900" selectable>
        {value}
      </Text>
    </View>
  );
}

export default function AccountScreen() {
  const { session } = useSession();
  const u = session?.user;
  const registered = u?.created_at
    ? new Date(u.created_at).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <Screen edges={["top"]}>
      <ScreenHeader title="Аккаунт" />
      <SectionCard>
        <Row label="Email" value={u?.email ?? "—"} />
        <Divider inset={16} />
        <Row label="Зарегистрирован" value={registered} />
        <Divider inset={16} />
        <Row label="ID пользователя" value={u?.id ?? "—"} />
      </SectionCard>

      <View className="mx-3 mt-6">
        <Button
          label="Выйти"
          variant="secondary"
          onPress={() => supabase.auth.signOut()}
        />
      </View>
    </Screen>
  );
}
