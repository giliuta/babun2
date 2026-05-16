"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check } from "@babun/shared/icons";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { updateTenant } from "@babun/shared/db/repositories/tenants";
// P2 #43 (CRM Core brief) — single source of save-state. Replaces
// the trio of {saving, error, savedAt} that used to disagree on
// which message wins («Сохранено» + «Сохраняем» overlap).
import { useSaveStatus } from "@/hooks/useSaveStatus";

type Vertical = "hvac" | "beauty" | "auto" | "cleaning" | "other";

const VERTICAL_LABELS: Record<Vertical, string> = {
  hvac: "Кондиционеры / HVAC",
  beauty: "Бьюти / салон",
  auto: "Авто-сервис",
  cleaning: "Клининг",
  other: "Другое",
};

interface Props {
  tenantId: string;
  initialName: string;
  initialVertical: string;
  /** STORY-074 — accepted for back-compat with the old form shape but
   *  no longer rendered. Tenants pick city per-day on the calendar
   *  (DayCityModal) so a single global city was always misleading. */
  initialCity?: string;
}

// STORY-041 G4 — Editable business profile. One atomic UPDATE on
// submit (matches the wizard's commit shape from STORY-040), so the
// form is always in a consistent state. Toast self-clears after 2 s
// to keep the UI calm.
export default function BusinessSection({
  tenantId,
  initialName,
  initialVertical,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [vertical, setVertical] = useState<Vertical>(
    (["hvac", "beauty", "auto", "cleaning", "other"].includes(initialVertical)
      ? (initialVertical as Vertical)
      : "other"),
  );
  const save = useSaveStatus();
  const saving = save.status === "saving";
  const error = save.error;
  const savedAt = save.status === "saved";

  const trimmedName = name.trim();
  const valid = trimmedName.length >= 2;
  const dirty =
    trimmedName !== initialName.trim() || vertical !== initialVertical;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    await save.run(async () => {
      const supabase = getSupabaseBrowser();
      await updateTenant(supabase, tenantId, {
        name: trimmedName,
        vertical,
      });
      // Refresh server components so the dashboard layout / settings
      // hero pick up the new tenant name on next render.
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit}>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider flex items-center gap-2">
        <Building2 size={14} />
        <span>Бизнес</span>
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4 space-y-3">
        <Field label="Имя бизнеса" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название вашей компании"
            minLength={2}
            required
            className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
          />
          {!valid && name.length > 0 && (
            <div className="text-[12px] text-[var(--system-red)] mt-1">
              Минимум 2 символа
            </div>
          )}
        </Field>

        <Field label="Тип бизнеса">
          <select
            value={vertical}
            onChange={(e) => setVertical(e.target.value as Vertical)}
            className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition appearance-none"
          >
            {(Object.keys(VERTICAL_LABELS) as Vertical[]).map((v) => (
              <option key={v} value={v}>
                {VERTICAL_LABELS[v]}
              </option>
            ))}
          </select>
          <div className="mt-1 text-[11px] text-[var(--label-secondary)] leading-snug">
            По типу бизнеса будем подсказывать стартовые шаблоны: услуги, цены, шаблоны SMS. Можно поменять в любой момент.
          </div>
        </Field>

        {error && (
          <div className="text-[13px] text-[var(--system-red)] leading-snug">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!valid || !dirty || saving}
          className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition flex items-center justify-center gap-2"
        >
          {savedAt && <Check size={16} />}
          {save.label("Сохранить")}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
        {label}
        {required && <span className="text-[var(--system-red)]"> *</span>}
      </div>
      {children}
    </label>
  );
}
