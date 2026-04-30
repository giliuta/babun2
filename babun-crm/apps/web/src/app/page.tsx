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
// custom calendar pinch-zoom handler.
export const viewport: Viewport = {
  themeColor: "#3E88F7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
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
    <main className="min-h-[100dvh] bg-[var(--surface-grouped)] text-[var(--label)]">
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}
