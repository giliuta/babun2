"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/onboarding/complete-action";
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
  // v526 §3.2 — default to personal=true for a fresh signup. A solo
  // owner is the most common starting shape; flipping the default
  // means the wizard pre-selects «Личный календарь» and the dispatcher
  // doesn't have to think about it. Anyone who actually runs a team
  // can switch on Step 3 in one tap. Existing tenants pass their
  // saved value through `initialPersonalCalendar` so this default
  // only affects fresh signups.
  initialPersonalCalendar = true,
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
    // Routed through a server action so the cached tenant entry can
    // be invalidated (revalidateTag("tenant")) atomically with the
    // DB write — otherwise a freshly-onboarded user could redirect
    // back to /onboarding for the rest of the cache TTL window.
    const result = await completeOnboarding({
      tenantId,
      name,
      vertical,
      personalCalendar,
    });
    if (!result.ok) {
      setError(result.error);
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
