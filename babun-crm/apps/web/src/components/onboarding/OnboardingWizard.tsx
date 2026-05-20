"use client";

// STORY audit (defer personal calendar):
// Раньше onboarding имел 4 шага: BusinessName → Vertical → Personal
// Calendar Toggle → Done. По решению пользователя личный календарь
// убираем из first-run — фича остаётся, но включается опционально
// позже через Settings → Аккаунт → Личный календарь. Сейчас:
//   · 3 шага вместо 4 (StepPersonalCalendar удалён)
//   · personalCalendar по умолчанию false для свежей регистрации
//   · StepDone больше не упоминает личный календарь
//   · Финальный CTA ведёт сразу на /dashboard/teams (создать команду)

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/app/onboarding/complete-action";
import OnboardingShell from "./OnboardingShell";
import StepBusinessName from "./StepBusinessName";
import StepVertical from "./StepVertical";
import StepDone from "./StepDone";

export type Vertical = "hvac" | "beauty" | "auto" | "cleaning" | "other";

interface Props {
  tenantId: string;
  initialName: string;
  initialVertical: Vertical | null;
  /** Existing-tenant value, передаётся только при повторном открытии
   *  /onboarding (миграция). Свежий signup игнорирует. */
  initialPersonalCalendar?: boolean;
}

export default function OnboardingWizard({
  tenantId,
  initialName,
  initialVertical,
  initialPersonalCalendar = false,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(initialName);
  const [vertical, setVertical] = useState<Vertical | null>(initialVertical);
  // Keep personalCalendar state but no UI for it — preserves existing
  // tenant choices on re-onboarding without re-asking.
  const personalCalendar = initialPersonalCalendar;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = async (next: "calendar" | "team") => {
    if (saving) return;
    if (!name.trim() || !vertical) return;
    setSaving(true);
    setError(null);
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
    <OnboardingShell step={step} totalSteps={3}>
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
        <StepDone
          name={name}
          vertical={vertical}
          personalCalendar={personalCalendar}
          onBack={() => setStep(2)}
          onCommit={commit}
          saving={saving}
          error={error}
        />
      )}
    </OnboardingShell>
  );
}
