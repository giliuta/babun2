// STORY-070 wave 2 placeholder — full billing surface ships next pass.
//
// Goal of wave 2: paginated list of all Stripe events + sms_topups
// across all tenants, with filtering by event_type / amount / status.

export default function AdminBillingPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <header className="px-6 py-5 border-b border-[var(--separator)] bg-[var(--surface-card)]">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--label)]">
          Платежи и пополнения
        </h1>
        <p className="text-[13px] text-[var(--label-secondary)] mt-1">
          Полный список всех Stripe-событий и SMS-пополнений по всем тенантам.
        </p>
      </header>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-6 text-center">
          <div className="text-[16px] font-semibold text-[var(--label)] mb-2">
            Скоро
          </div>
          <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
            Wave 2 STORY-070 — полная история платежей с фильтрами + Stripe sync.
            Пока используй детальную страницу тенанта для просмотра конкретных событий.
          </p>
        </div>
      </div>
    </div>
  );
}
