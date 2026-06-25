import { Text } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";

export default function CabinetTab() {
  const { session } = useSession();

  return (
    <Screen className="px-6 pt-6">
      <Text className="mb-2 text-2xl font-bold text-neutral-900">Кабинет</Text>
      <Text className="mb-8 text-sm text-neutral-500">
        Phase 7 — настройки, команды, мастера, справочники.
      </Text>

      <Text className="mb-1 text-xs uppercase tracking-wide text-neutral-400">
        Аккаунт
      </Text>
      <Text className="mb-8 text-base text-neutral-900">
        {session?.user.email ?? "—"}
      </Text>

      <Button
        label="Выйти"
        variant="secondary"
        onPress={() => supabase.auth.signOut()}
      />
    </Screen>
  );
}
