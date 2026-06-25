import "@/bootstrap"; // MUST be first — polyfills + storage seam + sentry.
import "../global.css"; // NativeWind base styles.

import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AppProviders } from "@/providers/AppProviders";
import { useSession } from "@/providers/SessionProvider";

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) {
      router.replace("/login");
    } else if (session && inAuthGroup) {
      router.replace("/");
    }

    void SplashScreen.hideAsync();
  }, [session, loading, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(dashboard)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
