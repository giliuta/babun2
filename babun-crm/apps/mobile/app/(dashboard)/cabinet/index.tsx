import { type ComponentType } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  Building2,
  CalendarClock,
  ChevronRight,
  CircleUser,
  Gift,
  Landmark,
  MapPin,
  Receipt,
  Scissors,
  Users,
  Wallet,
  Wrench,
} from "lucide-react-native";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/providers/SessionProvider";

type IconType = ComponentType<{ color?: string; size?: number }>;

function MenuRow({
  icon: Icon,
  label,
  href,
  soon,
}: {
  icon: IconType;
  label: string;
  href?: Href;
  soon?: boolean;
}) {
  const router = useRouter();
  const disabled = soon || !href;
  return (
    <Pressable
      onPress={() => href && router.push(href)}
      disabled={disabled}
      className={`flex-row items-center px-4 py-3.5 ${disabled ? "" : "active:bg-neutral-50"}`}
    >
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-brand/10">
        <Icon color="#4338ca" size={18} />
      </View>
      <Text className="ml-3 flex-1 text-base text-neutral-900">{label}</Text>
      {soon ? (
        <Text className="text-xs text-neutral-400">скоро</Text>
      ) : (
        <ChevronRight color="#c4c4c4" size={18} />
      )}
    </Pressable>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <View className="mx-3 mt-2 overflow-hidden rounded-2xl bg-white shadow-sm">
      {children}
    </View>
  );
}

function Sep() {
  return <View className="ml-14 h-px bg-neutral-100" />;
}

export default function CabinetHome() {
  const { session } = useSession();

  return (
    <Screen>
      <View className="px-4 pb-1 pt-4">
        <Text className="text-2xl font-bold text-neutral-900">Кабинет</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        <Text className="px-5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Справочники
        </Text>
        <Group>
          <MenuRow icon={Scissors} label="Услуги" href="/cabinet/services" />
          <Sep />
          <MenuRow icon={Users} label="Команды" href="/cabinet/teams" />
          <Sep />
          <MenuRow icon={Wrench} label="Мастера" href="/cabinet/masters" />
          <Sep />
          <MenuRow icon={MapPin} label="Города" href="/cabinet/cities" />
        </Group>

        <Text className="px-5 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Настройки
        </Text>
        <Group>
          <MenuRow icon={Wallet} label="Категории" href="/cabinet/categories" />
          <Sep />
          <MenuRow icon={Landmark} label="Счета" href="/cabinet/accounts" />
          <Sep />
          <MenuRow icon={Receipt} label="Шаблоны" href="/cabinet/templates" />
          <Sep />
          <MenuRow icon={Building2} label="Бизнес" href="/cabinet/business" />
          <Sep />
          <MenuRow icon={CalendarClock} label="Календарь" href="/cabinet/calendar" />
          <Sep />
          <MenuRow icon={Gift} label="Лояльность" href="/cabinet/loyalty" />
        </Group>

        <Text className="px-5 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Аккаунт
        </Text>
        <Group>
          <MenuRow
            icon={CircleUser}
            label={session?.user.email ?? "Аккаунт"}
            href="/cabinet/account"
          />
        </Group>

        <View className="mx-3 mt-4">
          <Button
            label="Выйти"
            variant="secondary"
            onPress={() => supabase.auth.signOut()}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
