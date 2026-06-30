import { useState } from "react";
import { Alert, Linking, Text, TextInput } from "react-native";
import { useRouter } from "expo-router";
import {
  AuthCard,
  GhostLink,
  InputCard,
  InputDivider,
  PillButton,
} from "@/components/auth/AuthCard";
import { OrDivider, SocialButtons } from "@/components/auth/SocialAuthButtons";
import { COLORS } from "@/components/ui/tokens";
import { supabase } from "@/lib/supabase";

const inputStyle = {
  height: 52,
  paddingHorizontal: 16,
  fontSize: 15,
  color: "#0b1220",
} as const;

// «Вход в Babun» — minimal one-screen login: brand, Apple + Google, then
// email/password right on the screen (fewest taps), plus register/forgot.
// Apple/Google get native OAuth in the next rebuild; email/password works now.
export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valid = email.trim().length > 0 && password.length > 0;

  async function signIn() {
    if (!valid || loading) return;
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (e) setError("Неверная почта или пароль");
    // success → SessionProvider redirects
  }

  const soon = (name: string) =>
    Alert.alert(
      name,
      `Вход через ${name} подключаем в следующей сборке. Пока войдите по почте.`,
    );

  return (
    <AuthCard>
      <SocialButtons onApple={() => soon("Apple")} onGoogle={() => soon("Google")} />

      <OrDivider />

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
          textContentType="username"
          returnKeyType="next"
          style={inputStyle}
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
          onSubmitEditing={signIn}
          style={inputStyle}
        />
      </InputCard>

      {error ? (
        <Text style={{ marginTop: 12, textAlign: "center", fontSize: 13, color: "#f0473c" }}>
          {error}
        </Text>
      ) : null}

      <PillButton
        label={loading ? "Входим…" : "Войти"}
        onPress={signIn}
        disabled={!valid}
        loading={loading}
      />

      <GhostLink label="Забыли пароль?" onPress={() => router.push("/forgot-password")} />
      <GhostLink
        label="Нет аккаунта? Зарегистрироваться"
        muted
        onPress={() => router.push("/register")}
      />

      <Text
        style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: 12,
          lineHeight: 17,
          color: "#97a0ae",
        }}
      >
        Продолжая, вы принимаете{" "}
        <Text style={{ color: "#2c5be0" }} onPress={() => Linking.openURL("https://babun.app/terms")}>
          Условия
        </Text>{" "}
        и{" "}
        <Text style={{ color: "#2c5be0" }} onPress={() => Linking.openURL("https://babun.app/privacy")}>
          Конфиденциальность
        </Text>
      </Text>
    </AuthCard>
  );
}
