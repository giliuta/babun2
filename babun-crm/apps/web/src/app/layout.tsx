import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { AuthClearListener } from "@/components/system/AuthClearListener";
import { TelemetryBootstrap } from "@/components/system/TelemetryBootstrap";
import { ThemeBootstrap } from "@/components/system/ThemeBootstrap";

// Narrow the Inter weights we actually use in styles (400 body,
// 500 chip, 600 title, 700 big number, 900 day-header). Next's
// default ships the entire 100–900 axis, which weighs ~240 kB more
// than we need.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "900"],
  display: "swap",
});

const APP_NAME = "Babun";
const APP_TITLE = "Babun — CRM для сервисного бизнеса";
const APP_DESCRIPTION =
  "Babun — мобильная CRM для сервисного бизнеса. Команда, клиенты, расписание и календарь — всё в одном месте. Бесплатно во время беты.";
const SITE_URL = "https://babun.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: APP_NAME,
  title: {
    default: APP_TITLE,
    template: "%s · Babun",
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    url: SITE_URL,
    locale: "ru_RU",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Babun — CRM для сервисного бизнеса",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  // STORY-056 — unified brand blue. Mirrors manifest.ts and the
  // icon gradient so the iOS PWA status bar matches the home-screen
  // icon (currently we use statusBarStyle "default", so this colour
  // is what shows behind any translucent overlay).
  themeColor: "#3E88F7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--surface-grouped)] font-sans">
        <AuthClearListener />
        <TelemetryBootstrap />
        <ThemeBootstrap />
        {children}
        {/* STORY-061c — Vercel Analytics + Speed Insights. Both ship as
            tiny scripts loaded via next/script, only fire in production
            (no-op locally), and don't gather PII. Useful baseline for
            measuring landing-page conversion + dashboard performance. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
