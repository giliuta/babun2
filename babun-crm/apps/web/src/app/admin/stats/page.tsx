// STORY-070 wave 2 placeholder — full stats with charts ships next pass.
//
// Goal of wave 2: time-series charts (signups/day, MRR/month,
// SMS volume/day), plan distribution donut, top tenants by SMS.

export default function AdminStatsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-6 py-5 border-b border-[var(--separator)] bg-[var(--surface-card)]">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--label)]">
          Статистика
        </h1>
        <p className="text-[13px] text-[var(--label-secondary)] mt-1">
          Графики по регистрациям, MRR, отправкам SMS.
        </p>
      </header>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-6 text-center">
          <div className="text-[16px] font-semibold text-[var(--label)] mb-2">
            Скоро
          </div>
          <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
            Wave 2 STORY-070 — time-series графики + plan distribution + top tenants.
            Пока ключевые числа можно увидеть в Обзоре платформы.
          </p>
        </div>
      </div>
    </div>
  );
}
