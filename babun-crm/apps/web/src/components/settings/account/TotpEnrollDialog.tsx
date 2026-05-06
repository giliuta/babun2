"use client";

// STORY-076 — TOTP enrollment dialog.
//
// Calls supabase.auth.mfa.enroll({ factorType: 'totp' }) to register a
// new TOTP factor. Shows the QR code + manual secret. User scans into
// Google Authenticator / Authy / 1Password / etc, types the 6-digit
// code back, we verify and the factor moves from 'unverified' to
// 'verified'. Cancel or backdrop tap on a half-finished enrollment
// unenrolls the factor so abandoned attempts don't pile up.

import { useEffect, useState } from "react";
import { X } from "@babun/shared/icons";
import { getSupabaseBrowser } from "@/lib/supabase/client";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function TotpEnrollDialog({ onClose, onSuccess }: Props) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Enroll on mount. STORY-078 sweeps stale unverified factors first.
  // STORY-079 also early-exits if a verified factor already exists —
  // the parent component should never open this dialog when 2FA is
  // already on, but the dialog defends itself in case of a mis-wire
  // (otherwise we'd stack new factors and eventually hit
  // `mfa_factor_count_exceeded`).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sb = getSupabaseBrowser();
        try {
          const { data: list } = await sb.auth.mfa.listFactors();
          const factors = list?.totp ?? [];
          const verified = factors.find((f) => f.status === "verified");
          if (verified) {
            if (!cancelled) {
              setError("2FA уже включена. Сначала отключите её, потом подключайте заново.");
            }
            return;
          }
          const stale = factors.filter((f) => f.status !== "verified");
          await Promise.all(
            stale.map((f) =>
              sb.auth.mfa.unenroll({ factorId: f.id }).catch(() => {}),
            ),
          );
        } catch {
          /* ignore — listFactors may not be authed yet on cold start */
        }
        if (cancelled) return;
        const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp" });
        if (cancelled) return;
        if (error) {
          setError(error.message);
          return;
        }
        setFactorId(data.id);
        const totp = (data as { totp?: { qr_code?: string; secret?: string } }).totp;
        setQr(totp?.qr_code ?? null);
        setSecret(totp?.secret ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // If user closes mid-flow, unenroll the half-baked factor.
  const handleClose = async () => {
    if (factorId) {
      try {
        const sb = getSupabaseBrowser();
        await sb.auth.mfa.unenroll({ factorId });
      } catch {
        /* swallow — factor may already be verified */
      }
    }
    onClose();
  };

  const handleVerify = async () => {
    if (!factorId || code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const sb = getSupabaseBrowser();
      const { data: ch, error: chErr } = await sb.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await sb.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code,
      });
      if (vErr) throw vErr;
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неверный код");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="bg-[var(--surface-card)] rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-[18px] font-semibold text-[var(--label)]">
            Подключить 2FA
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Закрыть"
            className="w-8 h-8 -mr-2 -mt-1 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)]"
          >
            <X size={16} />
          </button>
        </div>

        <ol className="text-[13px] text-[var(--label-secondary)] space-y-2 list-decimal pl-4 leading-snug">
          <li>Скачай приложение Google Authenticator, Authy или 1Password.</li>
          <li>Отсканируй QR-код ниже (или впиши код вручную).</li>
          <li>Введи 6-значный код, который покажет приложение.</li>
        </ol>

        {qr ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="QR-код 2FA"
              className="w-44 h-44 bg-white rounded-[10px] p-2"
            />
            {secret && (
              <code className="text-[11px] text-[var(--label-tertiary)] font-mono break-all px-2 text-center">
                {secret}
              </code>
            )}
          </div>
        ) : (
          <div className="text-center text-[13px] text-[var(--label-tertiary)] py-4">
            {error ? error : "Готовим QR-код…"}
          </div>
        )}

        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="w-full h-12 text-center text-[22px] tracking-[0.4em] tabular-nums font-semibold bg-[var(--fill-tertiary)] rounded-[10px] focus:outline-none focus:bg-[var(--surface-card)] focus:border focus:border-[var(--accent)] transition"
        />

        {error && (
          <div className="text-[12px] text-[var(--system-red)] text-center leading-snug">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-semibold active:bg-[var(--fill-secondary)] transition"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={code.length !== 6 || busy || !factorId}
            className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] active:scale-[0.98] transition"
          >
            {busy ? "Проверяем…" : "Подключить"}
          </button>
        </div>
      </div>
    </div>
  );
}
