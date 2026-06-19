"use client";

// Create-as-card — the create screen IS the client card opened empty, NOT a
// separate form. One component (ClientCardPage) handles create + view + edit
// so the page never changes shape: phone-primary header, live dedupe, full
// (empty, editable) card below, «Готово» persists and lands on the [id] card.

import { useRouter } from "next/navigation";
import ClientCardPage from "@/components/clients/ClientCardPage";

export default function NewClientPage() {
  const router = useRouter();
  return <ClientCardPage createMode onBack={() => router.back()} />;
}
