"use client";

// Beta #53 (CRM Core brief) — программа лояльности.
//
// One scrollable settings page: master switch + tier editor. Each
// tier is a row of (threshold, percent, label) with a delete pill.
// Save is implicit — every edit writes through `saveLoyalty()`. The
// «активировать» CTA on the empty state loads the brief's starter
// tier list as a working example.
//
// Visibility on the client card lands in a separate commit (Beta #53
// follow-through) — this page is the configuration surface.

import { useEffect, useState } from "react";
import { Plus, Star, Trash2 } from "@babun/shared/icons";
import PageHeader from "@/components/layout/PageHeader";
import IOSSwitch from "@/components/ui/IOSSwitch";
import { useConfirm } from "@/components/ui/ConfirmProvider";
import { haptic } from "@/lib/haptics";
import {
  DEFAULT_LOYALTY,
  STARTER_LOYALTY_TIERS,
  generateLoyaltyTierId,
  loadLoyalty,
  saveLoyalty,
  type LoyaltySettings,
  type LoyaltyTier,
} from "@babun/shared/local/loyalty";

export default function LoyaltyPage() {
  const confirm = useConfirm();
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_LOYALTY);

  useEffect(() => {
    // Client-only hydration: loadLoyalty() reads localStorage which
    // is undefined during SSR. External-state-sync — pattern flagged
    // by React-Compiler is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadLoyalty());
  }, []);

  const persist = (next: LoyaltySettings) => {
    setSettings(next);
    saveLoyalty(next);
  };

  const toggle = () => {
    haptic("tap");
    persist({ ...settings, enabled: !settings.enabled });
  };

  const seedStarters = () => {
    haptic("success");
    persist({ enabled: true, tiers: STARTER_LOYALTY_TIERS });
  };

  const updateTier = (id: string, patch: Partial<LoyaltyTier>) => {
    persist({
      ...settings,
      tiers: settings.tiers
        .map((t) => (t.id === id ? { ...t, ...patch } : t))
        .sort((a, b) => a.threshold - b.threshold),
    });
  };

  const removeTier = async (id: string) => {
    // STORY audit: уровень лояльности один тап стирал без confirm —
    // диспетчер мог потерять «после 5 визитов — 10%» одним промахом.
    const tier = settings.tiers.find((t) => t.id === id);
    const ok = await confirm({
      title: tier
        ? `Удалить уровень «${tier.label || `${tier.threshold} визитов · ${tier.percent}%`}»?`
        : "Удалить уровень?",
      message: "Клиенты, у которых были скидки по этому уровню, сохранят прежние записи — но новые скидки этого уровня применяться не будут.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    haptic("warning");
    persist({
      ...settings,
      tiers: settings.tiers.filter((t) => t.id !== id),
    });
  };

  const addTier = () => {
    haptic("tap");
    const last = settings.tiers[settings.tiers.length - 1];
    const nextThreshold = (last?.threshold ?? 0) + 5;
    const nextPercent = Math.min(50, (last?.percent ?? 0) + 5);
    persist({
      enabled: true,
      tiers: [
        ...settings.tiers,
        {
          id: generateLoyaltyTierId(),
          threshold: nextThreshold,
          percent: nextPercent,
          label: "Новый уровень",
        },
      ].sort((a, b) => a.threshold - b.threshold),
    });
  };

  return (
    <>
      <PageHeader title="Программа лояльности" backHref="/dashboard/settings" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {/* Master switch — STORY audit: было <input type=checkbox>,
              что на iOS выглядело инородно и не давало haptic. Заменил
              на тот же IOSSwitch, что используется в остальных
              настройках (calendar / sms / online-booking). */}
          <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-4">
            <div className="flex items-center gap-3 min-h-[44px]">
              <Star
                size={18}
                strokeWidth={2}
                className={
                  settings.enabled
                    ? "text-[var(--system-yellow,#FFCC00)]"
                    : "text-[var(--label-tertiary)]"
                }
              />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-[var(--label)]">
                  Включена
                </div>
                <div className="text-[12px] text-[var(--label-secondary)] leading-snug mt-0.5">
                  При записи клиента с накопленными визитами Babun
                  предложит автоматическую скидку соответствующего уровня.
                </div>
              </div>
              <IOSSwitch
                checked={settings.enabled}
                onChange={() => toggle()}
                ariaLabel="Программа лояльности"
              />
            </div>
          </section>

          {settings.tiers.length === 0 && (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5">
              <h2 className="text-[15px] font-semibold text-[var(--label)] mb-1">
                Уровней пока нет
              </h2>
              <p className="text-[13px] text-[var(--label-secondary)] mb-4 leading-snug">
                Начните с готовых — потом подкрутите пороги и проценты под
                свою клиентскую базу.
              </p>
              <button
                type="button"
                onClick={seedStarters}
                className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:bg-[var(--accent-pressed)]"
              >
                Загрузить пример (Бронза / Серебро / Золото)
              </button>
            </div>
          )}

          {settings.tiers.length > 0 && (
            <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] overflow-hidden">
              <header className="px-4 py-3 border-b border-[var(--separator)] text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
                Уровни
              </header>
              <ul className="divide-y divide-[var(--separator)]">
                {settings.tiers.map((tier) => (
                  <li key={tier.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tier.label}
                        onChange={(e) =>
                          updateTier(tier.id, { label: e.target.value })
                        }
                        placeholder="Название уровня"
                        className="flex-1 h-10 px-3 bg-[var(--fill-tertiary)] rounded-[10px] text-[14px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border focus:border-[var(--accent)]"
                      />
                      <button
                        type="button"
                        onClick={() => removeTier(tier.id)}
                        aria-label="Удалить уровень"
                        className="w-9 h-9 rounded-lg text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)] flex items-center justify-center"
                      >
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <NumField
                        label="После визитов"
                        value={tier.threshold}
                        min={1}
                        max={9999}
                        onChange={(v) =>
                          updateTier(tier.id, { threshold: v })
                        }
                      />
                      <NumField
                        label="Скидка %"
                        value={tier.percent}
                        min={0}
                        max={100}
                        onChange={(v) =>
                          updateTier(tier.id, { percent: v })
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={addTier}
                className="w-full flex items-center gap-2 px-4 py-3 min-h-[48px] text-left active:bg-[var(--fill-quaternary)] transition border-t border-[var(--separator)]"
              >
                <span className="w-7 h-7 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                  <Plus size={15} strokeWidth={2.5} />
                </span>
                <span className="text-[14px] font-medium text-[var(--accent)]">
                  Добавить уровень
                </span>
              </button>
            </section>
          )}

          <p className="text-[12px] text-[var(--label-tertiary)] leading-snug">
            Скидка из ближайшего достигнутого уровня применяется автоматически
            при создании записи. Уровень показан в карточке клиента.
          </p>
        </div>
      </div>
    </>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex-1 flex flex-col gap-1">
      <span className="text-[11px] font-medium text-[var(--label-secondary)] tracking-wide">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="h-10 px-3 bg-[var(--fill-tertiary)] rounded-[10px] text-[14px] text-[var(--label)] tabular-nums focus:outline-none focus:bg-[var(--surface-card)] focus:border focus:border-[var(--accent)]"
      />
    </label>
  );
}
