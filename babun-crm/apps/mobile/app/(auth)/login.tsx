import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Screen } from "@/components/ui/Screen";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    // On success, SessionProvider's onAuthStateChange triggers the redirect.
    if (signInError) setError(signInError.message);
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 justify-center px-6">
          <Text className="mb-1 text-3xl font-bold text-neutral-900">Babun</Text>
          <Text className="mb-8 text-base text-neutral-500">Вход в кабинет</Text>

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            placeholder="you@example.com"
          />
          <Field
            label="Пароль"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
            error={error}
          />

          <Button
            label="Войти"
            onPress={handleSignIn}
            disabled={!canSubmit}
            loading={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
