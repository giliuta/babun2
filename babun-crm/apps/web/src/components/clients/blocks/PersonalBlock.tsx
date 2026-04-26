"use client";

// STORY-034 — Personal block.  Город · ДР · Email · Язык.  Compact
// inline-edit form; nothing here drives behavior, it's reference data
// for SMS templates and birthday reminders.

import type { Client } from "@babun/shared/local/clients";
import ClientCard from "../ClientCard";

interface PersonalBlockProps {
  client: Client;
  onUpdate: (next: Client) => void;
}

const LANG_OPTIONS: { value: string; label: string; flag: string }[] = [
  { value: "ru", label: "RU", flag: "🇷🇺" },
  { value: "en", label: "EN", flag: "🇬🇧" },
  { value: "el", label: "EL", flag: "🇬🇷" },
];

export default function PersonalBlock({
  client,
  onUpdate,
}: PersonalBlockProps) {
  const update = (patch: Partial<Client>) =>
    onUpdate({ ...client, ...patch });

  return (
    <ClientCard kind="personal" title="Личное">
      <div className="px-3 py-3 space-y-2.5">
        <Row label="Город">
          <input
            type="text"
            value={client.city}
            onChange={(e) => update({ city: e.target.value })}
            placeholder="Пафос"
            maxLength={60}
            className="flex-1 h-8 px-2 text-[13px] bg-[var(--fill-tertiary)] border border-transparent rounded-md focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
        </Row>
        <Row label="День рождения">
          <input
            type="date"
            value={client.birthday}
            onChange={(e) => update({ birthday: e.target.value })}
            className="flex-1 h-8 px-2 text-[13px] tabular-nums bg-[var(--fill-tertiary)] border border-transparent rounded-md focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
        </Row>
        <Row label="Email">
          <input
            type="email"
            value={client.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="email@example.com"
            maxLength={120}
            className="flex-1 h-8 px-2 text-[13px] bg-[var(--fill-tertiary)] border border-transparent rounded-md focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          />
        </Row>
        <Row label="Язык">
          <div className="flex-1 flex gap-1">
            {LANG_OPTIONS.map((l) => {
              const active = (client.language ?? "") === l.value;
              return (
                <button
                  key={l.value}
                  type="button"
                  onClick={() =>
                    update({ language: active ? "" : l.value })
                  }
                  className={`h-7 px-2 rounded-full text-[12px] font-semibold transition active:scale-[0.97] ${
                    active
                      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                      : "bg-[var(--fill-tertiary)] text-[var(--label-secondary)]"
                  }`}
                >
                  {l.flag} {l.label}
                </button>
              );
            })}
          </div>
        </Row>
      </div>
    </ClientCard>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[12px] text-[var(--label-secondary)]">
        {label}
      </span>
      {children}
    </div>
  );
}
