"use client";

// Brief 3 #13 — Telegram channel-connect card. MVP per user spec:
// user creates a bot via @BotFather, pastes the token here, we save
// it locally. Real server-side message dispatch lives in
// STORY-094-channels follow-up.

import { useEffect, useState } from "react";
import { Check, Copy, MessageSquare, Trash2 } from "@babun/shared/icons";
import {
  loadChannelIntegrations,
  upsertChannelIntegration,
  removeChannelIntegration,
  isTelegramTokenShape,
  maskToken,
  type ChannelIntegration,
} from "@babun/shared/local/tenant-integrations";

interface Props {
  tenantId: string;
}

export default function TelegramIntegrationCard({ tenantId }: Props) {
  const [connected, setConnected] = useState<ChannelIntegration | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const list = loadChannelIntegrations(tenantId);
    const tg = list.find((x) => x.kind === "telegram") ?? null;
    setConnected(tg);
  }, [tenantId]);

  const handleSave = () => {
    setError(null);
    const trimmed = token.trim();
    if (!isTelegramTokenShape(trimmed)) {
      setError(
        "Похоже на не-Telegram токен. Формат: 123456789:AAH..., получите у @BotFather.",
      );
      return;
    }
    const next = upsertChannelIntegration(tenantId, {
      kind: "telegram",
      token: trimmed,
    });
    setConnected(next);
    setShowForm(false);
    setToken("");
  };

  const handleDisconnect = () => {
    if (!connected) return;
    removeChannelIntegration(tenantId, connected.id);
    setConnected(null);
    setShowForm(false);
    setToken("");
  };

  const handleCopy = async () => {
    if (!connected) return;
    try {
      await navigator.clipboard.writeText(connected.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — silently ignore */
    }
  };

  return (
    <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-11 h-11 rounded-[12px] bg-[#2AABEE] text-white flex items-center justify-center">
          <MessageSquare size={20} strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[15px] font-semibold text-[var(--label)] truncate">
              Telegram
            </span>
            {connected ? (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 h-5 inline-flex items-center rounded-full bg-[var(--system-green)] text-white shrink-0">
                Подключено
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider font-bold px-2 h-5 inline-flex items-center rounded-full bg-[var(--accent-tint)] text-[var(--accent)] shrink-0">
                MVP
              </span>
            )}
          </div>
          <div className="text-[13px] text-[var(--label-secondary)] leading-snug">
            Бот для уведомлений сотрудникам и чат с клиентами.
            {!connected && (
              <>
                {" "}
                Создайте бота через{" "}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--accent)] underline"
                >
                  @BotFather
                </a>
                , скопируйте токен сюда.
              </>
            )}
          </div>

          {connected && !showForm && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-[12px] tabular-nums">
                <span className="text-[var(--label-tertiary)] uppercase tracking-wider font-semibold">
                  Токен
                </span>
                <code className="flex-1 px-2 py-1 bg-[var(--fill-tertiary)] rounded text-[var(--label)] font-mono truncate">
                  {maskToken(connected.token)}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Скопировать токен"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)] transition"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[var(--label-tertiary)]">
                Подключено {new Date(connected.connected_at).toLocaleDateString("ru-RU")}
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                className="mt-1 inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.25)] text-[var(--system-red)] text-[13px] font-semibold active:bg-[rgba(255,59,48,0.16)] transition"
              >
                <Trash2 size={14} strokeWidth={2} />
                Отключить
              </button>
            </div>
          )}

          {!connected && !showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-3 h-9 px-3.5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold active:bg-[var(--accent-pressed)] transition"
            >
              Подключить
            </button>
          )}

          {showForm && (
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="block text-[11px] uppercase tracking-wider font-semibold text-[var(--label-secondary)] mb-1">
                  Bot Token
                </span>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setError(null);
                  }}
                  placeholder="123456789:AAH..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full h-10 px-3 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[13px] font-mono text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
                />
              </label>
              {error && (
                <div className="text-[12px] text-[var(--system-red)] leading-snug">
                  {error}
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!token.trim()}
                  className="h-9 px-3.5 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold active:bg-[var(--accent-pressed)] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setToken("");
                    setError(null);
                  }}
                  className="h-9 px-3.5 rounded-full bg-[var(--fill-tertiary)] text-[var(--label)] text-[13px] font-medium active:bg-[var(--fill-secondary)] transition"
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
