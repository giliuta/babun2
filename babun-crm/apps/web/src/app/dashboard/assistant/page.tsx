"use client";

// Beta #55 (CRM Core brief) — «спроси у Babun» AI assistant.
//
// MVP stub: a chat-like surface where the operator types a question
// («сколько я заработал за май?», «кто чаще всего срывает сроки?»)
// and Babun answers from the local data. Stubbed today because the
// real backend (LLM call, tool calls into Supabase) is STORY-010 in
// the roadmap; this page exists so the brief's deliverable has a
// home + the operator sees what's coming.
//
// On a future story the input wires to /api/assistant which pipes
// the question through Claude with tool definitions that resolve
// against the finance + clients + appointments tables. The chat
// transcript persists per-tenant in `assistant_conversations`.

import PageHeader from "@/components/layout/PageHeader";
import { Sparkles } from "@babun/shared/icons";

const SAMPLE_PROMPTS = [
  "Сколько я заработал за май?",
  "Кто из мастеров чаще всего срывает сроки?",
  "Какой клиент потратил больше всех в этом году?",
  "Сколько визитов запланировано на следующую неделю?",
  "Какие услуги приносят больше всего денег?",
];

export default function AssistantPage() {
  return (
    <>
      <PageHeader title="Спроси у Babun" backHref="/dashboard" />
      <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-9 h-9 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
                <Sparkles size={18} strokeWidth={2.2} />
              </span>
              <h2 className="text-[17px] font-semibold text-[var(--label)]">
                Скоро здесь
              </h2>
            </div>
            <p className="text-[14px] text-[var(--label-secondary)] leading-snug">
              AI-ассистент, который отвечает по твоим клиентам, финансам
              и расписанию. Спрашивай как человека — формулу не нужно знать.
            </p>
          </div>

          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-3">
              Что можно будет спросить
            </h3>
            <ul className="space-y-2">
              {SAMPLE_PROMPTS.map((p) => (
                <li
                  key={p}
                  className="px-3 py-2 rounded-[10px] bg-[var(--fill-tertiary)] text-[13px] text-[var(--label)] leading-snug"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-5 opacity-60">
            <div className="flex items-center justify-between mb-2">
              <input
                type="text"
                placeholder="Спроси что-нибудь…"
                disabled
                className="flex-1 h-11 px-3 bg-[var(--fill-tertiary)] rounded-[10px] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
              />
            </div>
            <div className="text-[11px] text-[var(--label-tertiary)] italic">
              Ввод появится в одной из следующих версий — пишем сейчас связку
              с LLM и инструменты для финансовых отчётов.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
