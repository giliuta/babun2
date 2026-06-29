import { useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import {
  AuthCard,
  GhostLink,
  InputCard,
  InputDivider,
  PillButton,
} from "@/components/auth/AuthCard";
import { COLORS } from "@/components/ui/tokens";
import { supabase } from "@/lib/supabase";

// Mirrors the web RegisterForm (v520 §3.1): name + email + password(≥8) +
// Terms/Privacy ack. On success → SessionProvider redirects (confirm-email
// off) or we show the "check your email" pending state (confirm-email on).
export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const formValid =
    agreed &&
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8;

  async function submit() {
    if (!formValid || loading) return;
    setLoading(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    // confirm-email OFF → signUp returns a session → onAuthStateChange swaps
    // the navigator. ON → no session → show the pending state.
    if (!data.session) {
      setPending(true);
      setLoading(false);
    }
  }

  if (pending) {
    return (
      <AuthCard
        title="Проверьте почту"
        subtitle="Мы отправили ссылку для подтверждения"
      >
        <InputCard>
          <Text className="px-5 py-5 text-[14px] leading-relaxed text-neutral-500">
            На <Text className="font-medium text-neutral-900">{email}</Text> ушло
            письмо со ссылкой. Откройте его, перейдите по ссылке — и возвращайтесь
            сюда, чтобы войти.
          </Text>
        </InputCard>
        <GhostLink
          label="Уже подтвердили? Войти"
          onPress={() => router.replace("/login")}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Создайте аккаунт" subtitle="Это займёт 30 секунд">
      <InputCard>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Ваше имя"
          placeholderTextColor={COLORS.faint}
          autoComplete="name"
          maxLength={120}
          className="h-[52px] px-4 text-[15px] text-ink"
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
          className="h-[52px] px-4 text-[15px] text-ink"
        />
        <InputDivider />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Пароль (минимум 8 символов)"
          placeholderTextColor={COLORS.faint}
          secureTextEntry
          autoComplete="new-password"
          className="h-[52px] px-4 text-[15px] text-ink"
        />
      </InputCard>

      {/* Terms / Privacy ack — required to enable the CTA. */}
      <Pressable
        onPress={() => setAgreed((v) => !v)}
        className="mt-3 flex-row items-start gap-2.5 px-1 py-1"
      >
        <View
          className={`mt-[2px] h-5 w-5 items-center justify-center rounded-md border ${
            agreed ? "border-brand bg-brand" : "border-neutral-300 bg-white"
          }`}
        >
          {agreed ? <Check color="#fff" size={14} /> : null}
        </View>
        <Text className="flex-1 text-[12px] leading-snug text-neutral-500">
          Я согласен(на) с{" "}
          <Text
            className="text-brand underline"
            onPress={() => Linking.openURL("https://babun.app/terms")}
          >
            Условиями
          </Text>{" "}
          и{" "}
          <Text
            className="text-brand underline"
            onPress={() => Linking.openURL("https://babun.app/privacy")}
          >
            Политикой конфиденциальности
          </Text>
          .
        </Text>
      </Pressable>

      {error ? (
        <Text className="mt-2 px-2 text-center text-[13px] text-danger">
          {error}
        </Text>
      ) : null}

      <PillButton
        label={loading ? "Создаём…" : "Создать аккаунт"}
        onPress={submit}
        disabled={!formValid}
        loading={loading}
      />

      <Text className="mt-2 px-2 text-center text-[11px] leading-snug text-neutral-500">
        После регистрации мы отправим письмо со ссылкой подтверждения. Откройте
        его — и возвращайтесь сюда, чтобы войти.
      </Text>

      <GhostLink
        label="Уже есть аккаунт? Войти"
        onPress={() => router.replace("/login")}
      />
    </AuthCard>
  );
}
