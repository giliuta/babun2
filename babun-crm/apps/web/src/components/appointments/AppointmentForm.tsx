"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import {
  useAppointments,
  useFormSettings,
  useTeams,
  useServices,
  useClients,
} from "@/app/dashboard/layout";
import {
  type Appointment,
  type AppointmentStatus,
  type AppointmentPhoto,
  type Payment,
  type PaymentMethod,
  createPayment,
  duplicateAppointment,
  getPaidAmount,
  getDebtAmount,
  isFullyPaid,
  validateAppointment,
  PAYMENT_METHOD_LABELS,
  STATUS_LABELS,
} from "@/lib/appointments";
import type { Service } from "@/lib/services";
import type { Client } from "@/lib/clients";
import { generateId } from "@/lib/masters";
import { getDayNameShort } from "@/lib/date-utils";

// ─── Draft clients (localStorage) ───────────────────────────────────────

const DRAFT_CLIENTS_KEY = "babun-draft-clients";

export interface DraftClient {
  id: string;
  full_name: string;
  phone: string;
}

export function loadDraftClients(): DraftClient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFT_CLIENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDraftClients(list: DraftClient[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_CLIENTS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(((total % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
  const mm = (((total % 60) + 60) % 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const monthNames = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}, ${getDayNameShort(d)}`;
}

interface AppointmentFormProps {
  initial: Appointment;
  mode: "new" | "edit";
}

export default function AppointmentForm({ initial, mode }: AppointmentFormProps) {
  const router = useRouter();
  const { upsertAppointment, deleteAppointment } = useAppointments();
  const { fieldVisibility, requiredFields } = useFormSettings();
  const { teams } = useTeams();
  const { services } = useServices();
  const { clients } = useClients();

  // Local form state
  const [date, setDate] = useState(initial.date);
  const [timeStart, setTimeStart] = useState(initial.time_start);
  const [timeEnd, setTimeEnd] = useState(initial.time_end);
  const [manualEndEdited, setManualEndEdited] = useState(false);
  const [clientId, setClientId] = useState<string | null>(initial.client_id);
  const [teamId, setTeamId] = useState<string | null>(initial.team_id);
  const [serviceIds, setServiceIds] = useState<string[]>(initial.service_ids);
  const [totalAmount, setTotalAmount] = useState(initial.total_amount);
  const [customTotal, setCustomTotal] = useState(initial.custom_total);
  const [prepaidAmount, setPrepaidAmount] = useState(initial.prepaid_amount);
  const [payments, setPayments] = useState<Payment[]>(initial.payments);
  const [comment, setComment] = useState(initial.comment);
  const [address, setAddress] = useState(initial.address);
  const [status, setStatus] = useState<AppointmentStatus>(initial.status);
  const [photos, setPhotos] = useState<AppointmentPhoto[]>(initial.photos ?? []);

  // Draft clients (loaded from localStorage)
  const [draftClients, setDraftClients] = useState<DraftClient[]>([]);
  useEffect(() => {
    setDraftClients(loadDraftClients());
  }, []);

  // Team default: if no team, pick first active
  useEffect(() => {
    if (!teamId && teams.length > 0) {
      const firstActive = teams.find((t) => t.active);
      if (firstActive) setTeamId(firstActive.id);
    }
  }, [teamId, teams]);

  const allClients = useMemo<(Client | DraftClient)[]>(() => {
    return [...clients, ...draftClients];
  }, [clients, draftClients]);

  const selectedClient = useMemo(
    () => allClients.find((c) => c.id === clientId) ?? null,
    [allClients, clientId]
  );

  const selectedServices = useMemo<Service[]>(
    () =>
      serviceIds
        .map((id) => services.find((s) => s.id === id))
        .filter((s): s is Service => Boolean(s)),
    [serviceIds, services]
  );

  // Auto calculate end time from start + services duration
  useEffect(() => {
    if (manualEndEdited) return;
    if (!timeStart) return;
    const totalMin = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0);
    if (totalMin > 0) {
      setTimeEnd(addMinutesToTime(timeStart, totalMin));
    }
  }, [timeStart, selectedServices, manualEndEdited]);

  // Auto total from services unless custom
  useEffect(() => {
    if (customTotal) return;
    const sum = selectedServices.reduce((acc, s) => acc + s.price, 0);
    setTotalAmount(sum);
  }, [selectedServices, customTotal]);

  const paidAmount =
    prepaidAmount + payments.reduce((sum, p) => sum + p.amount, 0);
  const debtAmount = Math.max(0, totalAmount - paidAmount);
  const fullyPaid = totalAmount > 0 && paidAmount >= totalAmount;

  // Validation (live)
  const liveAppointment: Appointment = useMemo(
    () => ({
      ...initial,
      date,
      time_start: timeStart,
      time_end: timeEnd,
      client_id: clientId,
      team_id: teamId,
      service_ids: serviceIds,
      total_amount: totalAmount,
      custom_total: customTotal,
      prepaid_amount: prepaidAmount,
      payments,
      comment,
      address,
      status,
      photos,
    }),
    [
      initial,
      date,
      timeStart,
      timeEnd,
      clientId,
      teamId,
      serviceIds,
      totalAmount,
      customTotal,
      prepaidAmount,
      payments,
      comment,
      address,
      status,
      photos,
    ]
  );

  const hasClientPhone = selectedClient ? Boolean(selectedClient.phone) : false;
  const validation = validateAppointment(liveAppointment, requiredFields, hasClientPhone);

  const handleSave = () => {
    const now = new Date().toISOString();
    const apt: Appointment = {
      ...liveAppointment,
      updated_at: now,
      created_at: initial.created_at || now,
    };
    upsertAppointment(apt);
    router.push("/dashboard");
  };

  const handleCancel = () => {
    router.push("/dashboard");
  };

  const handleDelete = () => {
    if (typeof window !== "undefined" && !window.confirm("Удалить запись?")) return;
    deleteAppointment(initial.id);
    router.push("/dashboard");
  };

  const handleQuickCancel = () => {
    const now = new Date().toISOString();
    const apt: Appointment = {
      ...liveAppointment,
      status: "cancelled",
      updated_at: now,
      created_at: initial.created_at || now,
    };
    upsertAppointment(apt);
    router.push("/dashboard");
  };

  const handleDuplicate = () => {
    const copy = duplicateAppointment(liveAppointment);
    upsertAppointment(copy);
    router.push(`/dashboard/appointment/${copy.id}`);
  };

  const handleAddPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotos((prev) => [
        ...prev,
        {
          id: generateId("ph"),
          data_url: dataUrl,
          caption: "",
          uploaded_at: new Date().toISOString(),
        },
      ]);
    };
    reader.readAsDataURL(file);
  };

  // Void helpers to silence unused-value warnings for getPaidAmount/getDebtAmount/isFullyPaid
  void getPaidAmount;
  void getDebtAmount;
  void isFullyPaid;

  return (
    <>
      <PageHeader
        title={mode === "new" ? "Новая запись" : "Запись клиента"}
        rightContent={
          <button
            type="button"
            onClick={handleSave}
            className="px-3 py-1.5 bg-white text-indigo-700 lg:bg-indigo-600 lg:text-white rounded-lg text-sm font-semibold hover:bg-indigo-50 lg:hover:bg-indigo-700"
          >
            Сохранить
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-2xl mx-auto p-3 lg:p-4 pb-32 space-y-3">
          {/* Validation banner */}
          {validation.level !== "ok" && validation.missing.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3">
              ⚠️ Не хватает: {validation.missing.join(", ")}
            </div>
          )}

          {/* A. Время */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>⏰</span>
              <span>Время</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Дата</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {date && (
                  <div className="text-xs text-gray-500 mt-1">{formatDateLabel(date)}</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Начало</label>
                  <input
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Конец</label>
                  <input
                    type="time"
                    value={timeEnd}
                    onChange={(e) => {
                      setTimeEnd(e.target.value);
                      setManualEndEdited(true);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              {timeStart && timeEnd && timeToMinutes(timeEnd) <= timeToMinutes(timeStart) && (
                <div className="text-xs text-red-600">Конец должен быть позже начала</div>
              )}
            </div>
          </section>

          {/* B. Клиент */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>👤</span>
              <span>Клиент</span>
            </div>
            <ClientPicker
              clients={allClients}
              selectedClientId={clientId}
              onSelect={(id) => setClientId(id)}
              onCreate={(name, phone) => {
                const draft: DraftClient = {
                  id: generateId("cl"),
                  full_name: name,
                  phone,
                };
                const next = [...draftClients, draft];
                setDraftClients(next);
                saveDraftClients(next);
                setClientId(draft.id);
              }}
              onDetach={() => setClientId(null)}
            />
          </section>

          {/* C. Услуги */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>🛠️</span>
              <span>Услуги</span>
            </div>
            <ServicesPicker
              allServices={services}
              selectedIds={serviceIds}
              onChange={(ids) => {
                setServiceIds(ids);
                // if services changed and user was on custom — keep custom; otherwise auto will recompute.
              }}
            />

            {/* Total */}
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Сумма заказа</span>
                {customTotal ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={totalAmount}
                      onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
                      className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-gray-600">EUR</span>
                  </div>
                ) : (
                  <span className="font-semibold text-gray-900">{totalAmount} EUR</span>
                )}
              </div>
              {customTotal ? (
                <button
                  type="button"
                  onClick={() => setCustomTotal(false)}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Сбросить (авто-расчёт)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCustomTotal(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800"
                >
                  Изменить сумму вручную
                </button>
              )}
            </div>
          </section>

          {/* D. Бригада */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>👥</span>
              <span>Бригада</span>
            </div>
            <select
              value={teamId ?? ""}
              onChange={(e) => setTeamId(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="">— Не выбрано —</option>
              {teams
                .filter((t) => t.active)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.region})
                  </option>
                ))}
            </select>
            {teamId && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                {(() => {
                  const t = teams.find((t) => t.id === teamId);
                  if (!t) return null;
                  return (
                    <>
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      <span>{t.name}</span>
                      <span className="text-gray-400">•</span>
                      <span>{t.region}</span>
                    </>
                  );
                })()}
              </div>
            )}
          </section>

          {/* E. Адрес */}
          {fieldVisibility.show_address && (
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span>📍</span>
                <span>Адрес</span>
              </div>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Улица, дом, квартира..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {selectedClient && !address && (
                <button
                  type="button"
                  disabled
                  className="mt-2 text-xs text-gray-400 cursor-not-allowed"
                  title="У клиента пока нет сохранённого адреса"
                >
                  Использовать адрес клиента
                </button>
              )}
            </section>
          )}

          {/* F. Комментарий */}
          {fieldVisibility.show_comment && (
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span>💬</span>
                <span>Комментарий</span>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Например: 4 кондеров, заправка, домофон 1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </section>
          )}

          {/* F2. Фото */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>📷</span>
              <span>Фото ({photos.length})</span>
            </div>
            <div className="grid grid-cols-3 lg:grid-cols-4 gap-2">
              {photos.map((ph) => (
                <div key={ph.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ph.data_url} alt={ph.caption} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((p) => p.id !== ph.id))}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100"
                    aria-label="Удалить фото"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 text-gray-400 hover:text-indigo-500">
                <span className="text-2xl">+</span>
                <span className="text-[10px] mt-0.5">Фото</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    files.forEach(handleAddPhoto);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </section>

          {/* G. Оплата */}
          {(fieldVisibility.show_payments || fieldVisibility.show_prepaid) && (
            <section className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span>💰</span>
                <span>Оплата</span>
              </div>

              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-gray-600">Сумма заказа</span>
                <span className="font-semibold text-gray-900">{totalAmount} EUR</span>
              </div>

              {fieldVisibility.show_prepaid && (
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 mb-1">
                    Аванс / предоплата
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={prepaidAmount}
                      onChange={(e) => setPrepaidAmount(Number(e.target.value) || 0)}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-600">EUR</span>
                  </div>
                </div>
              )}

              {fieldVisibility.show_payments && (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500">Оплачено</div>
                  {payments.length === 0 && (
                    <div className="text-xs text-gray-400">Пока нет платежей</div>
                  )}
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">
                          {PAYMENT_METHOD_LABELS[p.method]}
                        </span>
                        <span className="font-semibold text-gray-900">{p.amount} EUR</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPayments((prev) => prev.filter((x) => x.id !== p.id))
                        }
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-red-500"
                        aria-label="Удалить платёж"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <AddPaymentInline onAdd={(m, a) => setPayments((prev) => [...prev, createPayment(m, a)])} />
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Внесено</span>
                  <span className="font-semibold text-gray-900">{paidAmount} EUR</span>
                </div>
                {debtAmount > 0 ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Долг</span>
                    <span className="text-orange-600 font-semibold">
                      {debtAmount} EUR 🟧
                    </span>
                  </div>
                ) : fullyPaid ? (
                  <div className="text-sm text-emerald-600 font-semibold">
                    Полностью оплачено ✓
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {/* H. Статус */}
          <section className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>🚦</span>
              <span>Статус</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { s: "scheduled", color: "blue" },
                  { s: "in_progress", color: "purple" },
                  { s: "completed", color: "green" },
                  { s: "cancelled", color: "red" },
                ] as { s: AppointmentStatus; color: string }[]
              ).map(({ s, color }) => {
                const active = status === s;
                const activeClasses: Record<string, string> = {
                  blue: "bg-blue-500 text-white border-blue-500",
                  purple: "bg-purple-500 text-white border-purple-500",
                  green: "bg-emerald-500 text-white border-emerald-500",
                  red: "bg-red-500 text-white border-red-500",
                };
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      active
                        ? activeClasses[color]
                        : "border-gray-300 text-gray-700 hover:bg-gray-50 bg-white"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Actions (edit mode only) */}
          {mode === "edit" && (
            <div className="flex flex-col gap-2 pt-4">
              <button
                type="button"
                onClick={handleDuplicate}
                className="w-full min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200"
              >
                📋 Дублировать запись
              </button>
              <button
                type="button"
                onClick={handleQuickCancel}
                className="w-full min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600"
              >
                ❌ Отменить заказ
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="w-full min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Удалить запись
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 bg-white border-t border-gray-200 px-3 py-3 flex gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Сохранить
        </button>
      </div>
    </>
  );
}

// ─── Client picker ──────────────────────────────────────────────────────

interface ClientPickerProps {
  clients: (Client | DraftClient)[];
  selectedClientId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string, phone: string) => void;
  onDetach: () => void;
}

function ClientPicker({
  clients,
  selectedClientId,
  onSelect,
  onCreate,
  onDetach,
}: ClientPickerProps) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const selected = clients.find((c) => c.id === selectedClientId) ?? null;

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return clients
      .filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [clients, query]);

  if (selected) {
    return (
      <div className="flex items-center gap-3 px-3 py-3 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="w-10 h-10 rounded-full bg-amber-400 text-white flex items-center justify-center font-bold text-sm shrink-0">
          {selected.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">
            {selected.full_name}
          </div>
          <div className="text-xs text-gray-500">{selected.phone}</div>
        </div>
        <button
          type="button"
          onClick={onDetach}
          className="text-xs text-indigo-600 hover:text-indigo-800"
        >
          Открепить
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по имени или телефону..."
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {query.trim() && (
        <div className="space-y-1">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onSelect(c.id);
                setQuery("");
              }}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg text-left"
            >
              <div className="w-9 h-9 rounded-full bg-amber-400 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {c.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {c.full_name}
                </div>
                <div className="text-xs text-gray-500">{c.phone}</div>
              </div>
            </button>
          ))}
          {!showCreate && (
            <button
              type="button"
              onClick={() => {
                setShowCreate(true);
                setNewName(query);
              }}
              className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg"
            >
              + Создать &quot;{query}&quot;
            </button>
          )}
        </div>
      )}

      {showCreate && (
        <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Имя *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Телефон *</label>
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
                setNewPhone("");
              }}
              className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-white"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={!newName.trim() || !newPhone.trim()}
              onClick={() => {
                onCreate(newName.trim(), newPhone.trim());
                setShowCreate(false);
                setNewName("");
                setNewPhone("");
                setQuery("");
              }}
              className="flex-1 min-h-[40px] px-3 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Сохранить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Services picker ────────────────────────────────────────────────────

interface ServicesPickerProps {
  allServices: Service[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function ServicesPicker({ allServices, selectedIds, onChange }: ServicesPickerProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo<Service[]>(
    () =>
      selectedIds
        .map((id) => allServices.find((s) => s.id === id))
        .filter((s): s is Service => Boolean(s)),
    [selectedIds, allServices]
  );

  const total = selected.reduce((sum, s) => sum + s.price, 0);

  return (
    <div className="space-y-2">
      {selected.length === 0 && (
        <div className="text-xs text-gray-400">Услуги не выбраны</div>
      )}
      {selected.map((s) => (
        <div
          key={s.id}
          className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900 truncate">{s.name}</div>
            <div className="text-xs text-gray-500">
              {s.duration_minutes} мин • {s.price} EUR
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(selectedIds.filter((id) => id !== s.id))}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-red-500"
            aria-label="Удалить услугу"
          >
            ×
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full min-h-[44px] px-3 py-2 rounded-lg text-sm font-medium text-indigo-600 border border-dashed border-indigo-300 hover:bg-indigo-50"
      >
        + Добавить услугу
      </button>

      {selected.length > 0 && (
        <div className="flex items-center justify-between text-sm pt-2">
          <span className="text-gray-600">Итого</span>
          <span className="font-semibold text-gray-900">{total} EUR</span>
        </div>
      )}

      {open && (
        <ServicesSheet
          allServices={allServices}
          selectedIds={selectedIds}
          onClose={() => setOpen(false)}
          onSave={(ids) => {
            onChange(ids);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

interface ServicesSheetProps {
  allServices: Service[];
  selectedIds: string[];
  onClose: () => void;
  onSave: (ids: string[]) => void;
}

function ServicesSheet({ allServices, selectedIds, onClose, onSave }: ServicesSheetProps) {
  const [local, setLocal] = useState<string[]>(selectedIds);

  const toggle = (id: string) => {
    setLocal((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/40">
      <div className="w-full lg:max-w-lg bg-white rounded-t-2xl lg:rounded-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Выбор услуг</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-500 text-xl"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {allServices.filter((s) => s.is_active).map((s) => {
            const checked = local.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                  checked ? "bg-indigo-50" : "hover:bg-gray-50"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    checked
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-gray-300"
                  }`}
                >
                  {checked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{s.name}</div>
                  <div className="text-xs text-gray-500">
                    {s.duration_minutes} мин • {s.price} EUR
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="border-t border-gray-200 px-3 py-3 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onSave(local)}
            className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add payment inline ─────────────────────────────────────────────────

interface AddPaymentInlineProps {
  onAdd: (method: PaymentMethod, amount: number) => void;
}

function AddPaymentInline({ onAdd }: AddPaymentInlineProps) {
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium text-indigo-600 border border-dashed border-indigo-300 hover:bg-indigo-50"
      >
        + Добавить платёж
      </button>
    );
  }

  const handleSubmit = () => {
    const n = Number(amount);
    if (!n || n <= 0) return;
    onAdd(method, n);
    setAmount("");
    setOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value as PaymentMethod)}
        className="px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="cash">{PAYMENT_METHOD_LABELS.cash}</option>
        <option value="card">{PAYMENT_METHOD_LABELS.card}</option>
        <option value="transfer">{PAYMENT_METHOD_LABELS.transfer}</option>
      </select>
      <input
        type="number"
        min={0}
        placeholder="Сумма"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="button"
        onClick={handleSubmit}
        className="min-h-[40px] px-3 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
      >
        Добавить
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setAmount("");
        }}
        className="min-h-[40px] px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-white"
      >
        Отмена
      </button>
    </div>
  );
}
