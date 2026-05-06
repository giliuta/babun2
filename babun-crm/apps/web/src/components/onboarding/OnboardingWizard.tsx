"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import OnboardingShell from "./OnboardingShell";
import StepBusinessName from "./StepBusinessName";
import StepVertical from "./StepVertical";
import StepPersonalCalendar from "./StepPersonalCalendar";
import StepDone from "./StepDone";

export type Vertical = "hvac" | "beauty" | "auto" | "cleaning" | "other";

interface Props {
  tenantId: string;
  initialName: string;
  initialVertical: Vertical | null;
  initialPersonalCalendar?: boolean;
}

export default function OnboardingWizard({
  tenantId,
  initialName,
  initialVertical,
  initialPersonalCalendar = false,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState(initialName);
  const [vertical, setVertical] = useState<Vertical | null>(initialVertical);
  const [personalCalendar, setPersonalCalendar] = useState<boolean>(
    initialPersonalCalendar,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // STORY-073 — post-onboarding lands on the calendar (formerly /clients).
  // The calendar's empty state CTAs guide the next step (add appointment,
  // toggle personal, invite team).
  const commit = async (next: "calendar" | "team") => {
    if (saving) return;
    if (!name.trim() || !vertical) return;
    setSaving(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: err } = await (supabase as any)
      .from("tenants")
      .update({
        name: name.trim(),
        vertical,
        personal_calendar_enabled: personalCalendar,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", tenantId);
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    router.push(next === "team" ? "/dashboard/teams" : "/dashboard");
    router.refresh();
  };

  return (
    <OnboardingShell step={step} totalSteps={4}>
      {step === 1 && (
        <StepBusinessName
          value={name}
          onChange={setName}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <StepVertical
          value={vertical}
          onChange={setVertical}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepPersonalCalendar
          value={personalCalendar}
          onChange={setPersonalCalendar}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <StepDone
          name={name}
          vertical={vertical}
          personalCalendar={personalCalendar}
          onBack={() => setStep(3)}
          onCommit={commit}
          saving={saving}
          error={error}
        />
      )}
    </OnboardingShell>
  );
}
