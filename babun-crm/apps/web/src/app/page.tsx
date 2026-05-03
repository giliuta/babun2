// STORY-045 — public landing page on root.
//
// Auth-aware: a logged-in visitor never sees the marketing page; we
// short-circuit to /dashboard/clients via a server-side redirect so
// there's no flash of landing UI mid-hydration. Anon visitors get the
// full page (Hero + Features + HowItWorks + Pricing + FAQ + Footer).

import type { Viewport } from "next";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import Footer from "@/components/landing/Footer";

// Public marketing pages allow pinch-zoom (a11y/Lighthouse).
// Dashboard keeps userScalable=false in the root layout for the
// custom calendar pinch-zoom handler. STORY-056 unified the brand
// blue across surfaces — landing themeColor now matches manifest.ts
// and the icon gradient.
export const viewport: Viewport = {
  themeColor: "#1F66D7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

// STORY-060 — JSON-LD structured data for SEO. Google + LinkedIn use
// schema.org Organization to enrich link previews; SoftwareApplication
// helps the landing show up for "CRM" queries. Inlined as a literal
// JSON object so Next renders it server-side without a client script.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://babun.app/#org",
      name: "Babun",
      url: "https://babun.app",
      logo: "https://babun.app/icon.svg",
      sameAs: [],
      address: {
        "@type": "PostalAddress",
        addressCountry: "CY",
      },
    },
    {
      "@type": "SoftwareApplication",
      name: "Babun CRM",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
      },
      description:
        "CRM для сервисного бизнеса: записи, клиенты, SMS-напоминания. Работает с iPhone и компьютера.",
      url: "https://babun.app",
      publisher: { "@id": "https://babun.app/#org" },
    },
  ],
};

export default async function HomePage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/dashboard/clients");
  }

  return (
    <>
      <script
        type="application/ld+json"
        // Inline JSON-LD is a documented, safe Next pattern for
        // SEO-only structured data. The object is build-time literal,
        // not user-controlled, so XSS surface is nil.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
      <main
        id="main"
        className="min-h-[100dvh] bg-[var(--surface-grouped)] text-[var(--label)]"
      >
        <Header />
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <Footer />
      </main>
    </>
  );
}
