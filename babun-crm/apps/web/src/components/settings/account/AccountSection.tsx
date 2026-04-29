"use client";

import { Mail, Calendar, Hash } from "@babun/shared/icons";

interface Props {
  email: string;
  createdAt: string;
  userId: string;
}

// Read-only summary of the auth.users row. Shown first so the user
// can quickly verify which account they're logged in as before
// editing anything below.
export default function AccountSection({ email, createdAt, userId }: Props) {
  const created = new Date(createdAt);
  const formatted = created.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  // Show only the first 8 chars of the UUID so support can match it
  // in logs without us leaking the full account identifier on screen.
  const idShort = userId.slice(0, 8);

  return (
    <Section title="Аккаунт">
      <Row icon={<Mail size={16} />} label="Email" value={email} />
      <Row
        icon={<Calendar size={16} />}
        label="Регистрация"
        value={formatted}
      />
      <Row
        icon={<Hash size={16} />}
        label="ID для поддержки"
        value={idShort}
        mono
      />
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)]">
        {children}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[48px]">
      <span className="text-[var(--label-tertiary)] shrink-0">{icon}</span>
      <span className="text-[15px] text-[var(--label)] flex-1">{label}</span>
      <span
        className={`text-[14px] text-[var(--label-secondary)] truncate text-right ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
