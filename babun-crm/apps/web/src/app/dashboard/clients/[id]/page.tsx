"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import ClientProfileView from "@/components/clients/ClientProfileView";

type Params = { id: string };

export default function ClientProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = use(params);
  const router = useRouter();
  return <ClientProfileView clientId={id} onBack={() => router.back()} />;
}
