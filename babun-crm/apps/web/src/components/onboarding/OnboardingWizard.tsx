"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import OnboardingShell from "./OnboardingShell";
import StepBusinessName from "./StepBusinessName";
import StepVertical from "./StepVertical";
import StepCity from "./StepCity";
import StepDone from "./StepDone";

export type Vertical = "hvac" | "beauty" | "auto" | "cleaning" | "other";

interface Props {
  tenantId: string;
  initialName: string;
  initialVertical: Vertical | null;
  initialCity: string;
}

export default function OnboardingWizard({
  tenantId,
  initialName,
  initialVertical,
  initialCity,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState(initialName);
  const [vertical, setVertical] = useState<Vertical | null>(initialVertical);
  const [city, setCity] = useState(initialCity);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = async (next: "new-client" | "dashboard") => {
    if (saving) return;
    if (!name.trim() || !vertical) return;
    setSaving(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: err } = await supabase
      .from("tenants")
      .update({
        name: name.trim(),
        vertical,
        city: city.trim() || null,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", tenantId);
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    router.push(
      next === "new-client" ? "/dashboard/clients/new" : "/dashboard/clients",
    );
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
        <StepCity
          value={city}
          onChange={setCity}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <StepDone
          name={name}
          vertical={vertical}
          city={city}
          onBack={() => setStep(3)}
          onCommit={commit}
          saving={saving}
          error={error}
        />
      )}
    </OnboardingShell>
  );
}
