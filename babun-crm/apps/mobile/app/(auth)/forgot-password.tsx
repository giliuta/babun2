import { useState } from "react";
import { Text, TextInput } from "react-native";
import { useRouter } from "expo-router";
import {
  AuthCard,
  GhostLink,
  InputCard,
  PillButton,
} from "@/components/auth/AuthCard";
import { COLORS } from "@/components/ui/tokens";
import { supabase } from "@/lib/supabase";

// Mirrors the web ForgotPasswordForm: enter email → reset link emailed →
// "check your mail" confirmation. Same response whether the email exists or
// not, so we never enumerate registered users.
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (loading || email.trim().length === 0) return;
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim());
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <AuthCard
        title="Проверь почту"
        subtitle="Если такой email есть — мы отправили ссылку"
      >
        <InputCard>
          <Text className="px-5 py-5 text-center text-[14px] leading-relaxed text-neutral-500">
            Открой ссылку из письма — перейдёшь на страницу нового пароля.
          </Text>
        </InputCard>
        <GhostLink
          label="Назад ко входу"
          onPress={() => router.replace("/login")}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Сброс пароля" subtitle="Введи email — пришлём ссылку">
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
          returnKeyType="go"
          onSubmitEditing={submit}
          className="h-[52px] px-4 text-[15px] text-ink"
        />
      </InputCard>

      <PillButton
        label={loading ? "Отправляем…" : "Отправить ссылку"}
        onPress={submit}
        disabled={email.trim().length === 0}
        loading={loading}
      />

      <GhostLink label="Назад ко входу" onPress={() => router.replace("/login")} />
    </AuthCard>
  );
}
