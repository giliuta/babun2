import { useRef, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
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

const emailStyle = {
  height: 52,
  paddingHorizontal: 16,
  fontSize: 15,
  color: "#0b1220",
} as const;

// Map Supabase auth failures to honest, specific messages (a no-signal field
// owner shouldn't be told their password is wrong → retry → lockout).
function authErrorMessage(e: { message?: string; code?: string }): string {
  const m = (e.message ?? "").toLowerCase();
  const c = (e.code ?? "").toLowerCase();
  if (c.includes("email_not_confirmed") || m.includes("not confirmed"))
    return "Подтвердите почту — мы отправили ссылку";
  if (
    m.includes("network") ||
    m.includes("fetch") ||
    m.includes("timeout") ||
    m.includes("connection")
  )
    return "Нет связи. Проверьте интернет и повторите";
  if (c.includes("rate") || m.includes("rate limit") || m.includes("too many"))
    return "Слишком много попыток, подождите минуту";
  return "Неверная почта или пароль";
}

// «Вход в Babun» — minimal one-screen login: brand, Apple + Google, then
// email/password right on the screen (fewest taps), plus register/forgot.
export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
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
    if (e) setError(authErrorMessage(e));
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
          blurOnSubmit={false}
          onSubmitEditing={() => passwordRef.current?.focus()}
          selectionColor="#2c5be0"
          style={emailStyle}
        />
        <InputDivider />
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TextInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            placeholder="Пароль"
            placeholderTextColor={COLORS.faint}
            secureTextEntry={!showPw}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={signIn}
            selectionColor="#2c5be0"
            style={{ flex: 1, height: 52, paddingLeft: 16, paddingRight: 6, fontSize: 15, color: "#0b1220" }}
          />
          <Pressable
            onPress={() => setShowPw((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={showPw ? "Скрыть пароль" : "Показать пароль"}
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            {showPw ? (
              <EyeOff color={COLORS.faint} size={20} />
            ) : (
              <Eye color={COLORS.faint} size={20} />
            )}
          </Pressable>
        </View>
      </InputCard>

      {error ? (
        <Text
          accessibilityLiveRegion="assertive"
          style={{ marginTop: 12, textAlign: "center", fontSize: 13, color: "#f0473c" }}
        >
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

      <Pressable
        onPress={() => router.push("/register")}
        accessibilityRole="button"
        accessibilityLabel="Нет аккаунта? Зарегистрироваться"
        hitSlop={6}
        style={{ height: 44, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ fontSize: 14, color: "#5b6678" }}>
          Нет аккаунта?{" "}
          <Text style={{ color: "#2c5be0", fontWeight: "600" }}>Зарегистрироваться</Text>
        </Text>
      </Pressable>
    </AuthCard>
  );
}
