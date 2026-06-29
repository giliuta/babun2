import { useState } from "react";
import { Text, TextInput } from "react-native";
import { useRouter } from "expo-router";
import {
  AuthCard,
  GhostLink,
  InputCard,
  InputDivider,
  PillButton,
} from "@/components/auth/AuthCard";
import { COLORS } from "@/components/ui/tokens";
import { supabase } from "@/lib/supabase";

// Auth login. Mirrors the web LoginForm/AuthCard (STORY-037 G3): centered
// Babun logo tile, 28px title, iOS grouped input card, pill CTA, ghost links.
// OAuth (Google/Apple) is a separate native step — added later.
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const formValid = email.trim().length > 0 && password.length > 0;

  async function handleSignIn() {
    if (!formValid || loading) return;
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
    <AuthCard title="С возвращением" subtitle="Войдите, чтобы продолжить">
      <InputCard>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={COLORS.faint}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          returnKeyType="next"
          className="h-[52px] px-4 text-[15px] text-ink"
        />
        <InputDivider />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Пароль"
          placeholderTextColor={COLORS.faint}
          secureTextEntry
          autoComplete="current-password"
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
          className="h-[52px] px-4 text-[15px] text-ink"
        />
      </InputCard>

      {error ? (
        <Text className="mt-3 px-2 text-center text-[13px] text-danger">
          {error}
        </Text>
      ) : null}

      <PillButton
        label={loading ? "Входим…" : "Войти"}
        onPress={handleSignIn}
        disabled={!formValid}
        loading={loading}
      />

      <GhostLink
        label="Забыли пароль?"
        onPress={() => router.push("/forgot-password")}
      />
      <GhostLink
        label="Нет аккаунта? Зарегистрироваться"
        onPress={() => router.push("/register")}
      />
    </AuthCard>
  );
}
