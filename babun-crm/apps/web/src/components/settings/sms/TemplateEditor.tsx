"use client";

// STORY-047 G5 — template editor with placeholder helper buttons
// + live preview. Used inside SmsConfigForm.
//
// Two textareas (24h and 2h) live behind tabs. Each has a row of
// pill buttons that insert {client_name} / {time} / {date} / {phone}
// / {business_name} at the cursor. The preview uses sample data so
// the owner sees what a real SMS will look like before saving.

import { useRef, useState } from "react";

const PLACEHOLDERS = [
  "{client_name}",
  "{time}",
  "{date}",
  "{phone}",
  "{business_name}",
] as const;

const SAMPLE = {
  client_name: "Иван Петров",
  time: "14:30",
  date: "5 мая",
  phone: "+357 99 123 456",
};

interface Props {
  template24h: string;
  template2h: string;
  onChange24h: (v: string) => void;
  onChange2h: (v: string) => void;
  /** Tenant business name — substituted into {business_name} for the
   *  preview. Falls back to "AirFix" when the tenant hasn't set one. */
  businessName: string;
}

export default function TemplateEditor({
  template24h,
  template2h,
  onChange24h,
  onChange2h,
  businessName,
}: Props) {
  const [tab, setTab] = useState<"t24h" | "t2h">("t24h");
  const ref24 = useRef<HTMLTextAreaElement | null>(null);
  const ref2 = useRef<HTMLTextAreaElement | null>(null);

  const value = tab === "t24h" ? template24h : template2h;
  const setValue = tab === "t24h" ? onChange24h : onChange2h;
  const taRef = tab === "t24h" ? ref24 : ref2;

  const insertPlaceholder = (ph: string) => {
    const ta = taRef.current;
    if (!ta) {
      setValue(value + ph);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + ph + value.slice(end);
    setValue(next);
    // Restore the cursor just after the inserted placeholder.
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + ph.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const preview = renderPreview(value, businessName || "AirFix");

  return (
    <div>
      <label className="block text-[12px] uppercase tracking-wide text-[var(--label-secondary)] mb-2">
        Шаблоны
      </label>
      <div className="flex gap-2 mb-2">
        <TabPill active={tab === "t24h"} onClick={() => setTab("t24h")} label="За 24 часа" />
        <TabPill active={tab === "t2h"} onClick={() => setTab("t2h")} label="За 2 часа" />
      </div>

      {/* Placeholder helpers */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {PLACEHOLDERS.map((ph) => (
          <button
            key={ph}
            type="button"
            onClick={() => insertPlaceholder(ph)}
            className="px-2.5 h-7 rounded-full bg-[var(--surface-card-secondary)] text-[12px] text-[var(--label-secondary)] active:opacity-70 transition"
          >
            {ph}
          </button>
        ))}
      </div>

      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-card-secondary)] text-[14px] text-[var(--label)] outline-none focus:ring-2 focus:ring-[var(--system-blue)]/30 resize-y"
      />

      {/* Live preview */}
      <div className="mt-2 px-3 py-2 rounded-[10px] bg-[var(--surface-card-secondary)] border border-dashed border-[var(--separator)]">
        <div className="text-[11px] uppercase tracking-wide text-[var(--label-secondary)] mb-1">
          Предпросмотр
        </div>
        <div className="text-[13px] text-[var(--label)] whitespace-pre-wrap">{preview}</div>
      </div>
    </div>
  );
}

function TabPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-8 rounded-full text-[13px] font-semibold transition ${
        active
          ? "bg-[var(--system-blue)] text-white"
          : "bg-[var(--surface-card-secondary)] text-[var(--label-secondary)] active:opacity-70"
      }`}
    >
      {label}
    </button>
  );
}

function renderPreview(template: string, businessName: string): string {
  return template
    .replaceAll("{client_name}", SAMPLE.client_name)
    .replaceAll("{time}", SAMPLE.time)
    .replaceAll("{date}", SAMPLE.date)
    .replaceAll("{phone}", SAMPLE.phone)
    .replaceAll("{business_name}", businessName);
}
