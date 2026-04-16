"use client";

import { useMemo, useState } from "react";
import type { Client, Location } from "@/lib/clients";
import type { DraftClient } from "@/lib/draft-clients";
import type { ServicePreset } from "@/lib/service-presets";
import {
  SERVICE_PRESETS,
  priceForPreset,
  suggestPreset,
} from "@/lib/service-presets";
import ClientPickerSheet from "@/components/appointments/sheet/ClientPickerSheet";
import LocationPicker from "./LocationPicker";
import SmartSuggestion from "./SmartSuggestion";

interface ClientModeProps {
  dateLabel: string;
  timeLabel: string;
  cityLabel: string;
  cityColor: string;
  teamLabel: string;
  clients: Client[];
  draftClients: DraftClient[];
  recentClientIds: string[];
  /** ISO date key of the booking (for сheduled reminders). */
  dateKey: string;
  onCreate: (payload: ClientBookingPayload) => void;
  onCancel: () => void;
}

export interface ClientBookingPayload {
  client: Client | DraftClient;
  locationId: string | null;
  address: string;
  preset: ServicePreset;
  comment: string;
  smsEnabled: boolean;
}

export default function ClientMode({
  dateLabel,
  timeLabel,
  cityLabel,
  cityColor,
  teamLabel,
  clients,
  draftClients,
  recentClientIds,
  onCreate,
  onCancel,
}: ClientModeProps) {
  const [client, setClient] = useState<Client | DraftClient | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [preset, setPreset] = useState<ServicePreset | null>(null);
  const [comment, setComment] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [clientSheet, setClientSheet] = useState(false);
  const [serviceSheet, setServiceSheet] = useState(false);

  const clientLocations: Location[] = useMemo(() => {
    if (!client) return [];
    return (client as Client).locations ?? [];
  }, [client]);

  const selectedLocation = useMemo(() => {
    if (clientLocations.length === 0) return null;
    if (locationId) {
      return (
        clientLocations.find((l) => l.id === locationId) ?? clientLocations[0]
      );
    }
    return (
      clientLocations.find((l) => l.isPrimary) ?? clientLocations[0] ?? null
    );
  }, [clientLocations, locationId]);

  const address = selectedLocation?.address ?? "";
  const acUnits = selectedLocation?.acUnits ?? 0;

  const suggestion = useMemo(
    () => (preset ? null : suggestPreset(acUnits)),
    [preset, acUnits]
  );

  const price = preset ? priceForPreset(preset) : 0;
  const canSave = Boolean(client && preset);

  const handleClientPick = (c: Client | DraftClient) => {
    setClient(c);
    const locs = (c as Client).locations ?? [];
    const primary = locs.find((l) => l.isPrimary) ?? locs[0] ?? null;
    setLocationId(primary?.id ?? null);
  };

  const handleSubmit = () => {
    if (!client || !preset) return;
    onCreate({
      client,
      locationId,
      address,
      preset,
      comment: comment.trim(),
      smsEnabled: smsEnabled && Boolean((client as Client).phone),
    });
  };

  const clientPhone = (client as Client | null)?.phone ?? "";
  const hasPhone = Boolean(clientPhone);

  // Deep-link to chat in the client's preferred channel — used when
  // we have no address to ask the client for one.
  const askChannelHref = hasPhone
    ? `sms:${clientPhone.replace(/\D/g, "")}?body=${encodeURIComponent(
        "Здравствуйте! Подскажите адрес для выезда — без адреса бригада не сможет приехать."
      )}`
    : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Context chip — read-only (дата/время/город/бригада) */}
      <div className="flex-shrink-0 px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-600 overflow-x-auto">
        <span className="font-semibold text-slate-900 flex-shrink-0">{dateLabel}</span>
        <span className="text-slate-400">·</span>
        <span className="tabular-nums flex-shrink-0">{timeLabel}</span>
        {cityLabel && (
          <>
            <span className="text-slate-400">·</span>
            <span className="font-semibold flex-shrink-0" style={{ color: cityColor }}>
              {cityLabel}
            </span>
          </>
        )}
        <span className="text-slate-400">·</span>
        <span className="flex-shrink-0">{teamLabel}</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Client picker row */}
        <div className="p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Клиент
          </div>
          <button
            type="button"
            onClick={() => setClientSheet(true)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition active:scale-[0.99] text-left ${
              client
                ? "bg-white border border-slate-200"
                : "bg-white border-2 border-dashed border-slate-300"
            }`}
          >
            {client ? (
              <>
                <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-[13px] flex-shrink-0">
                  {initials(client.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold text-slate-900 truncate">
                    {client.full_name}
                  </div>
                  {clientPhone && (
                    <div className="text-[12px] text-slate-500 tabular-nums truncate">
                      {clientPhone}
                    </div>
                  )}
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 flex-shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div className="flex-1 text-[14px] font-medium text-slate-500">
                  Выбрать клиента
                </div>
              </>
            )}
          </button>
        </div>

        {/* Locations (if >1) */}
        <LocationPicker
          locations={clientLocations}
          selectedId={locationId}
          onSelect={setLocationId}
        />

        {/* Address (if available) or warning */}
        {client && (
          <div className="px-4 pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Адрес
            </div>
            {address ? (
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0 text-[13px] text-slate-800 truncate">
                  {address}
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-8 px-2 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center flex-shrink-0"
                >
                  Карты
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <div className="text-[12px] text-amber-800 flex-1">
                  ⚠ Адрес не указан
                </div>
                {askChannelHref && (
                  <a
                    href={askChannelHref}
                    className="h-8 px-2.5 rounded-lg bg-amber-500 text-white text-[11px] font-semibold flex items-center active:bg-amber-600 flex-shrink-0"
                  >
                    Спросить
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Smart suggestion */}
        {suggestion && (
          <div className="mt-3 flex">
            <SmartSuggestion preset={suggestion} onApply={() => setPreset(suggestion)} />
          </div>
        )}

        {/* Service */}
        <div className="px-4 pt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Услуга
          </div>
          <button
            type="button"
            onClick={() => setServiceSheet(true)}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition active:scale-[0.99] text-left ${
              preset
                ? "bg-white border border-slate-200"
                : "bg-white border-2 border-dashed border-slate-300"
            }`}
          >
            {preset ? (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-slate-900 truncate">
                    {preset.label}
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                    {preset.duration} мин · €{price}
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400 flex-shrink-0">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </>
            ) : (
              <div className="flex-1 text-[14px] font-medium text-slate-500">
                Выбрать услугу
              </div>
            )}
          </button>
        </div>

        {/* Comment */}
        <div className="px-4 pt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Комментарий
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Особенности, код домофона…"
            rows={2}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[14px] text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* SMS toggle */}
        {hasPhone && (
          <div className="px-4 pt-3 pb-4 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-slate-800">
                SMS-напоминание
              </div>
              <div className="text-[11px] text-slate-500">
                за сутки и за час до приёма
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSmsEnabled((v) => !v)}
              className={`w-11 h-6 rounded-full relative transition-colors ${
                smsEnabled ? "bg-violet-600" : "bg-slate-300"
              }`}
              aria-pressed={smsEnabled}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  smsEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div
        className="flex-shrink-0 px-4 pt-2 bg-white border-t border-slate-200 flex gap-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 10px)" }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-12 rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-700 active:bg-slate-50"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSave}
          className="flex-[2] h-12 rounded-xl bg-violet-600 text-white text-[14px] font-semibold active:scale-[0.99] transition disabled:bg-slate-300 disabled:text-slate-500"
        >
          {canSave
            ? `Создать запись · €${price}`
            : "Выберите клиента и услугу"}
        </button>
      </div>

      {/* Sub-sheets */}
      <ClientPickerSheet
        open={clientSheet}
        onClose={() => setClientSheet(false)}
        onSelect={(c) => {
          handleClientPick(c);
          setClientSheet(false);
        }}
        clients={clients}
        draftClients={draftClients}
        recentClientIds={recentClientIds}
      />

      <ServicePresetSheet
        open={serviceSheet}
        onClose={() => setServiceSheet(false)}
        onPick={(p) => {
          setPreset(p);
          setServiceSheet(false);
        }}
        recommended={suggestion}
      />
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ─── Inline ServicePresetSheet ─────────────────────────────────────────
// Небольшой bottom-sheet для выбора пресета услуги. Рекомендованный
// пресет (если есть) в рамке сверху. Держим inline — меньше файлов.

function ServicePresetSheet({
  open,
  onClose,
  onPick,
  recommended,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (p: ServicePreset) => void;
  recommended: ServicePreset | null;
}) {
  if (!open) return null;

  const rest = recommended
    ? SERVICE_PRESETS.filter((p) => p.id !== recommended.id)
    : SERVICE_PRESETS;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full lg:max-w-lg bg-white rounded-t-3xl lg:rounded-3xl lg:mb-8 pb-8 shadow-2xl max-h-[75vh] overflow-y-auto"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 24px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="px-5 pt-3 pb-2 text-[18px] font-semibold text-slate-900">
          Какая услуга?
        </div>
        <div className="px-3 space-y-2">
          {recommended && (
            <button
              type="button"
              onClick={() => onPick(recommended)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-violet-500 bg-violet-50 active:scale-[0.99]"
            >
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[11px] font-semibold text-violet-600 uppercase tracking-wide">
                  Рекомендуем
                </div>
                <div className="text-[15px] font-semibold text-slate-900 truncate">
                  {recommended.label}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[15px] font-bold text-violet-700 tabular-nums">
                  €{priceForPreset(recommended)}
                </div>
                <div className="text-[10px] text-slate-500 tabular-nums">
                  {recommended.duration} мин
                </div>
              </div>
            </button>
          )}
          {rest.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-slate-200 bg-white active:scale-[0.99]"
            >
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[15px] font-semibold text-slate-900 truncate">
                  {p.label}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[14px] font-semibold text-slate-800 tabular-nums">
                  €{priceForPreset(p)}
                </div>
                <div className="text-[10px] text-slate-500 tabular-nums">
                  {p.duration} мин
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
