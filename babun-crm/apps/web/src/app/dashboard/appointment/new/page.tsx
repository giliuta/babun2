"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import NewAppointmentSheet from "@/components/appointments/sheet/NewAppointmentSheet";
import { createBlankAppointment } from "@/lib/appointments";
import { formatDateKey } from "@/lib/date-utils";

export default function NewAppointmentPage() {
  return (
    <Suspense fallback={<div className="flex-1 bg-gray-50" />}>
      <NewAppointmentInner />
    </Suspense>
  );
}

function NewAppointmentInner() {
  const searchParams = useSearchParams();

  const initial = useMemo(() => {
    const date = searchParams.get("date") || formatDateKey(new Date());
    const time = searchParams.get("time") || "10:00";
    const clientId = searchParams.get("client_id");
    const teamId = searchParams.get("team_id");

    return createBlankAppointment({
      date,
      time_start: time,
      time_end: addMinutes(time, 60),
      client_id: clientId,
      team_id: teamId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <NewAppointmentSheet initial={initial} mode="new" />;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(((total % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
  const mm = (((total % 60) + 60) % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
