"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
// STORY-034 — switched from legacy ClientProfileView to the redesigned
// ClientCardPage.  The old component stays in the repo for the /chats
// side-panel until STORY-035 ports that path too.
import ClientCardPage from "@/components/clients/ClientCardPage";

type Params = { id: string };

export default function ClientProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = use(params);
  const router = useRouter();
  return <ClientCardPage clientId={id} onBack={() => router.back()} />;
}
