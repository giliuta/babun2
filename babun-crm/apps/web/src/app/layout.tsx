import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

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

const APP_NAME = "Babun CRM";
const APP_DESCRIPTION = "CRM система для AirFix — управление записями, клиентами и бригадами";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: "%s · Babun CRM",
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
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
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
      <head>
        {/*
         * STORY-036: the Supabase project runs without RLS until
         * STORY-038 lands tenant policies. The publishable key in the
         * client bundle can read the entire clients table, so we keep
         * the deployed instance out of search indexes.
         * Remove this meta tag once STORY-038 is shipped.
         */}
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--surface-grouped)] font-sans">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
