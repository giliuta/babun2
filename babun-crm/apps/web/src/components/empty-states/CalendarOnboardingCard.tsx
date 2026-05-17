"use client";

/* eslint-disable react-hooks/set-state-in-effect */
// Same hydration-from-storage pattern used in CalendarEmptyState.

// STORY-060 §F1.1 — first-run onboarding card.
//
// Centered card guiding fresh tenants through the 3-step setup:
//   1. Add a client
//   2. Create a service
//   3. Schedule the first appointment
// Visible only when the tenant has zero clients, zero services, and
// zero appointments. Dismissable; remembers dismissal in localStorage.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  X,
  User,
  Briefcase,
  CalendarPlus,
} from "@babun/shared/icons";
import { getStorage } from "@babun/shared/storage";

const DISMISS_KEY = "babun:hint-calendar-onboarding-dismissed";

export interface CalendarOnboardingCardProps {
  hasClients: boolean;
  hasServices: boolean;
  hasAppointments: boolean;
  onCreateAppointment: () => void;
}

export function CalendarOnboardingCard({
  hasClients,
  hasServices,
  hasAppointments,
  onCreateAppointment,
}: CalendarOnboardingCardProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasAppointments) {
      setDismissed(true);
      return;
    }
    let stored = false;
    try {
      stored = getStorage().getRaw(DISMISS_KEY) === "1";
    } catch {
      // private mode — show on every reload, acceptable.
    }
    setDismissed(stored);
  }, [hasAppointments]);

  if (hasAppointments || dismissed) return null;

  const handleDismiss = () => {
    try {
      getStorage().setRaw(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const handleCreate = () => {
    if (!hasClients || !hasServices) return;
    try {
      getStorage().setRaw(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
    onCreateAppointment();
  };

  const step3Disabled = !hasClients || !hasServices;

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
      style={{
        top: 80,
        width: "min(420px, calc(100vw - 32px))",
      }}
      aria-live="polite"
    >
      <div className="bg-[var(--surface-card)]/95 backdrop-blur-sm rounded-[18px] shadow-[0_12px_32px_rgba(0,0,0,0.18)] border border-[var(--separator)] p-6 relative">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Скрыть подсказку"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] transition"
        >
          <X size={16} strokeWidth={2.2} />
        </button>

        <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight mb-4">
          Начните за 3 шага
        </div>

        <div className="flex flex-col gap-2">
          <StepRow
            done={hasClients}
            icon={<User size={18} strokeWidth={2} />}
            label="Добавить клиента"
            href="/dashboard/clients?action=new"
            onClick={handleDismiss}
          />
          <StepRow
            done={hasServices}
            icon={<Briefcase size={18} strokeWidth={2} />}
            label="Создать услугу"
            href="/dashboard/services?action=new"
            onClick={handleDismiss}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={step3Disabled}
            className={`flex items-center gap-3 min-h-12 px-3 rounded-[12px] border text-left transition ${
              step3Disabled
                ? "bg-[var(--fill-quaternary)] text-[var(--label-tertiary)] border-transparent cursor-not-allowed"
                : "bg-[var(--accent)] text-[var(--label-on-accent)] border-transparent active:opacity-80"
            }`}
          >
            <span
              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                hasAppointments
                  ? "bg-emerald-500 text-white"
                  : step3Disabled
                    ? "bg-[var(--fill-tertiary)] text-[var(--label-tertiary)]"
                    : "bg-white/20 text-current"
              }`}
            >
              {hasAppointments ? (
                <Check size={14} strokeWidth={3} />
              ) : (
                <CalendarPlus size={16} strokeWidth={2} />
              )}
            </span>
            <span className="flex-1 text-[15px] font-semibold">
              Запланировать запись
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface StepRowProps {
  done: boolean;
  icon: React.ReactNode;
  label: string;
  href: string;
  onClick: () => void;
}

function StepRow({ done, icon, label, href, onClick }: StepRowProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 min-h-12 px-3 rounded-[12px] border border-[var(--separator)] bg-[var(--fill-quaternary)]/40 active:bg-[var(--fill-quaternary)] transition no-underline text-[var(--label)]"
    >
      <span
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
          done
            ? "bg-emerald-500 text-white"
            : "bg-[var(--accent-tint)] text-[var(--accent)]"
        }`}
      >
        {done ? <Check size={14} strokeWidth={3} /> : icon}
      </span>
      <span className="flex-1 text-[15px] font-medium">{label}</span>
    </Link>
  );
}
