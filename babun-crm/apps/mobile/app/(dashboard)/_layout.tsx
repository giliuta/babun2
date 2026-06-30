import { Tabs } from "expo-router";
import {
  Calendar,
  LayoutGrid,
  MessageCircle,
  Users,
  Wallet,
} from "lucide-react-native";
import { useThemeColors } from "@/theme/colors";

export default function DashboardLayout() {
  const t = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.faint,
        sceneStyle: { backgroundColor: t.canvas },
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.separator,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Календарь",
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: "Клиенты",
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Чаты",
          tabBarIcon: ({ color, size }) => (
            <MessageCircle color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: "Финансы",
          tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="cabinet"
        options={{
          title: "Кабинет",
          tabBarIcon: ({ color, size }) => (
            <LayoutGrid color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
