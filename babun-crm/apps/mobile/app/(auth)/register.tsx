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

// «Создать аккаунт» — minimal sign-up: brand, Apple + Google, then name/email/
// password inline. Terms acceptance is a small legal line (no checkbox = fewer
// taps). On success → SessionProvider redirects (or "check email" if confirm-on).
export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const valid =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8;

  async function submit() {
    if (!valid || loading) return;
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (e) {
      setError(e.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      setPending(true);
      setLoading(false);
    }
  }

  const soon = (name: string) =>
    Alert.alert(
      name,
      `Регистрация через ${name} подключаем в следующей сборке. Пока создайте аккаунт по почте.`,
    );

  if (pending) {
    return (
      <AuthCard title="Проверьте почту" subtitle="Мы отправили ссылку для подтверждения">
        <InputCard>
          <Text style={{ paddingHorizontal: 20, paddingVertical: 20, fontSize: 14, lineHeight: 21, color: "#5b6678" }}>
            На <Text style={{ fontWeight: "600", color: "#0b1220" }}>{email.trim()}</Text> ушло
            письмо со ссылкой. Откройте его — и возвращайтесь, чтобы войти.
          </Text>
        </InputCard>
        <GhostLink label="Уже подтвердили? Войти" onPress={() => router.replace("/login")} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Создать аккаунт">
      <SocialButtons onApple={() => soon("Apple")} onGoogle={() => soon("Google")} />

      <OrDivider />

      <InputCard>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Ваше имя"
          placeholderTextColor={COLORS.faint}
          autoComplete="name"
          maxLength={120}
          returnKeyType="next"
          style={inputStyle}
        />
        <InputDivider />
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
          style={inputStyle}
        />
        <InputDivider />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Пароль (от 8 символов)"
          placeholderTextColor={COLORS.faint}
          secureTextEntry
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={submit}
          style={inputStyle}
        />
      </InputCard>

      {error ? (
        <Text style={{ marginTop: 12, textAlign: "center", fontSize: 13, color: "#f0473c" }}>
          {error}
        </Text>
      ) : null}

      <PillButton
        label={loading ? "Создаём…" : "Создать аккаунт"}
        onPress={submit}
        disabled={!valid}
        loading={loading}
      />

      <GhostLink label="Уже есть аккаунт? Войти" muted onPress={() => router.replace("/login")} />

      <Text
        style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: 12,
          lineHeight: 17,
          color: "#97a0ae",
        }}
      >
        Создавая аккаунт, вы принимаете{" "}
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
