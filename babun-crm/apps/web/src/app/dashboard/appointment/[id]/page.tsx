"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import AppointmentForm from "@/components/appointments/AppointmentForm";
import { useAppointments } from "@/app/dashboard/layout";

export default function EditAppointmentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getAppointment } = useAppointments();

  const id = params?.id;
  const appointment = id ? getAppointment(id) : undefined;

  useEffect(() => {
    // If we can't find it (likely still loading from localStorage or just invalid id),
    // we'll keep trying — once the context is loaded the component will re-render.
    // If still missing after first tick and not found, show fallback.
  }, [appointment]);

  if (!appointment) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 p-6">
        <div className="text-sm text-gray-500 mb-3">Запись не найдена</div>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
        >
          К календарю
        </button>
      </div>
    );
  }

  return <AppointmentForm initial={appointment} mode="edit" />;
}
