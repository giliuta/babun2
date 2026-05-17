"use client";
import { useEffect, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { loadLocale, type Locale } from "@/i18n/locale";
import { loadMessages } from "@/i18n/messages-loader";

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>("ru");
  const [messages, setMessages] = useState<Record<string, unknown> | null>(
    null
  );

  useEffect(() => {
    const l = loadLocale();
    setLocale(l);
    void loadMessages(l).then(setMessages);
  }, []);

  // Pre-hydration fallback: render children without translation context.
  // Call sites that are not yet converted don't see missing-key errors;
  // converted call sites simply display the raw key until mount completes
  // (typically < 50 ms on first render — imperceptible).
  if (!messages) return <>{children}</>;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Europe/Nicosia"
    >
      {children}
    </NextIntlClientProvider>
  );
}
