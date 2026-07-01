import "@/bootstrap"; // MUST be first — polyfills + storage seam + sentry.
import "../global.css"; // NativeWind base styles.

import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { AppProviders } from "@/providers/AppProviders";
import { useSession } from "@/providers/SessionProvider";
import { ToastProvider } from "@/components/ui/Toast";

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    // The password-recovery deep link creates a real session but must STAY on
    // the reset-password screen to let the user set a new password.
    const onResetPassword = segments[1] === "reset-password";
    if (!session && !inAuthGroup) {
      router.replace("/login");
    } else if (session && inAuthGroup && !onResetPassword) {
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
      <ToastProvider>
        <RootNavigator />
      </ToastProvider>
    </AppProviders>
  );
}
