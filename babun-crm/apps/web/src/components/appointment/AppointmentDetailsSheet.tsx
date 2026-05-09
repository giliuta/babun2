"use client";

// STORY-056 — Read-only details sheet for work appointments in
// view/done mode. Replaces the legacy AppointmentSheet's view+done
// branches; create+edit moved to EventSheet. Personal events
// (kind='event') no longer reach this sheet — dashboard routes them
// straight to EventSheet in mode='edit'.
//
// What this sheet provides:
//   • Read-only render of all blocks (Time/Client/Location/Services/
//     Income/Comment/Photos/Source).
//   • view: PaymentBlock for marking complete + Quick Actions
//     (✓ complete, 📷 photos, ↻ reschedule, ✎ edit).
//   • done: green status badge + ClientActionMenu actions
//     (profile/chat/share/scheduled-repeat/invoice PDF/share-link).
//   • ✎ Edit button fires onEditRequest → parent closes this sheet
//     and opens EventSheet in mode='edit', kind='work'.
//
// KNOWN DEBT: still ~900 lines after stripping create/edit. Sub-block
// extraction is tracked in STORY-056-followup.

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  Check,
  Camera,
  CalendarClock,
  Pencil,
} from "@babun/shared/icons";
import type {
  Appointment,
  AppointmentPayment,
} from "@babun/shared/local/appointments";
import {
  listPhotosForAppointment,
  type AppointmentPhotoRecord,
} from "@babun/shared/db/repositories/appointment-photos";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import type { Client } from "@babun/shared/local/clients";
import type { Master, Team } from "@babun/shared/local/masters";
import { getTeamDisplayName } from "@babun/shared/local/masters";
import type { Service } from "@babun/shared/local/services";
import { getCityColor, CITY_LIST } from "@babun/shared/local/day-cities";
import { formatEUR } from "@babun/shared/common/utils/money";

import TimeBlock from "./TimeBlock";
import ClientBlock from "./ClientBlock";
import LocationsBlock from "./LocationsBlock";
import ServicesBlock from "./ServicesBlock";
import IncomeBlock from "./IncomeBlock";
import CommentBlock from "./CommentBlock";
import PhotoBlock from "./PhotoBlock";
import SourceBlock from "./SourceBlock";
import ClientActionMenu from "./ClientActionMenu";
import SendMessagePopup from "./SendMessagePopup";
import ClientProfileView from "@/components/clients/ClientProfileView";
import { useRouter } from "next/navigation";
import { loadChats } from "@babun/shared/local/chats";
import PaymentBlock from "./PaymentBlock";
import { buildShareUrl } from "@babun/shared/common/utils/share-link";
import { createRecurringReminder } from "@babun/shared/db/repositories/recurring-reminders";
import RepeatReminderSheet from "./RepeatReminderSheet";
import { loadCompany } from "@babun/shared/local/finance/company";
// jspdf + invoice builder are heavy (~350 kB combined). Load them on
// demand when the dispatcher actually taps "Скачать счёт" instead of
// shipping the module in the main dashboard bundle.

export type AppointmentDetailsSheetMode = "view" | "done";

interface AppointmentDetailsSheetProps {
  open: boolean;
  onClose: () => void;
  mode: AppointmentDetailsSheetMode;
  appointment: Appointment;
  clients: Client[];
  teams: Team[];
  activeTeam: Team | null;
  masters?: Master[];
  catalog: Service[];
  cityForDate: (dateKey: string) => string;
  onSave: (apt: Appointment) => void;
  /** Header ↻ — opens parent's RescheduleSheet. */
  onReschedule?: (apt: Appointment) => void;
  /** Header ✓ — triggers parent's PaymentSheet (mark complete). */
  onCompleteQuick?: (apt: Appointment) => void;
  /** Header ✎ — closes this sheet and opens EventSheet in mode='edit'. */
  onEditRequest?: (apt: Appointment) => void;
}

// Read-only details sheet — view + done. Single layout; mode prop
// drives only the header status badge and PaymentBlock visibility.
export default function AppointmentDetailsSheet({
  open,
  onClose,
  mode,
  appointment,
  clients,
  activeTeam,
  masters,
  catalog,
  cityForDate,
  onSave,
  onReschedule,
  onCompleteQuick,
  onEditRequest,
}: AppointmentDetailsSheetProps) {
  const router = useRouter();
  const toast = useToast();

  const tenantId = useTenantId();
  const [photos, setPhotos] = useState<AppointmentPhotoRecord[]>([]);
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [sendMsgOpen, setSendMsgOpen] = useState(false);
  const [clientProfileOpen, setClientProfileOpen] = useState(false);
  const [repeatSheetOpen, setRepeatSheetOpen] = useState(false);

  // body scroll lock + ESC close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Hydrate photos when the appointment id changes.
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhotos([]);
    if (appointment.id) {
      const supabase = getSupabaseBrowser();
      void listPhotosForAppointment(supabase, appointment.id)
        .then(setPhotos)
        .catch(() => {
          // Quiet failure — sheet is functional without photos.
        });
    }
  }, [open, appointment.id]);

  const client = useMemo<Client | null>(
    () => (appointment.client_id ? clients.find((c) => c.id === appointment.client_id) ?? null : null),
    [appointment.client_id, clients],
  );
  const clientLocations = useMemo(() => client?.locations ?? [], [client]);
  const selectedLocation = useMemo(() => {
    if (clientLocations.length === 0) return null;
    if (appointment.location_id) {
      return clientLocations.find((l) => l.id === appointment.location_id) ?? clientLocations[0];
    }
    return clientLocations.find((l) => l.isPrimary) ?? clientLocations[0];
  }, [clientLocations, appointment.location_id]);

  const city = cityForDate(appointment.date);
  const cityColor = city ? getCityColor(city) : "#64748b";
  const teamLabel = activeTeam
    ? masters && masters.length > 0
      ? getTeamDisplayName(activeTeam, masters)
      : activeTeam.name
    : "—";

  // Quick Actions (✓ / 📷 / ↻ / ✎) appear only on actionable records:
  // view-mode + scheduled/in_progress. Completed/cancelled records show
  // the status badge instead.
  const photoScrollRef = useRef<HTMLDivElement | null>(null);
  const showQuickActions =
    mode === "view" &&
    appointment.status !== "completed" &&
    appointment.status !== "cancelled";
  const scrollToPhotos = () => {
    photoScrollRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  if (!open) return null;

  // ─── Handlers ─────────────────────────────────────────────────────

  const handlePay = (payment: AppointmentPayment) => {
    onSave({
      ...appointment,
      status: "completed",
      payment,
      total_amount: appointment.total_amount,
      updated_at: new Date().toISOString(),
    });
    onClose();
  };

  const doneBadge = (() => {
    if (mode !== "done" || !appointment.payment) return null;
    const p = appointment.payment;
    if (p.method === "cash") {
      return `✅ Выполнено · нал · ${formatEUR(p.cashAmount)}`;
    }
    if (p.method === "card") {
      return `✅ Выполнено · карта · ${formatEUR(p.cardAmount)}`;
    }
    if (p.method === "split") {
      return `✅ Выполнено · 💵 ${formatEUR(p.cashAmount)} + 💳 ${formatEUR(p.cardAmount)}`;
    }
    return `✅ Выполнено · 📄 счёт компании · ${formatEUR(appointment.total_amount)}`;
  })();

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--surface-overlay)] backdrop-blur-[2px] p-2"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col"
        style={{ height: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex-shrink-0 px-4 pb-2 flex items-center justify-between gap-2">
          {mode === "done" ? (
            <div className="flex-1 text-[13px] font-semibold text-[var(--system-green)] truncate">
              {doneBadge}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          {showQuickActions && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {onCompleteQuick && (
                <button
                  type="button"
                  onClick={() => onCompleteQuick(appointment)}
                  aria-label="Отметить выполненной"
                  title="Выполнено"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--system-green)] active:bg-[rgba(52,199,89,0.1)]"
                >
                  <Check size={20} strokeWidth={2.5} />
                </button>
              )}
              <button
                type="button"
                onClick={scrollToPhotos}
                aria-label="Перейти к фото"
                title="Фото"
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--accent)] active:bg-[var(--accent-tint)]"
              >
                <Camera size={19} strokeWidth={2} />
              </button>
              {onReschedule && (
                <button
                  type="button"
                  onClick={() => onReschedule(appointment)}
                  aria-label="Перенести запись"
                  title="Перенести"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--system-orange)] active:bg-[rgba(255,149,0,0.1)]"
                >
                  <CalendarClock size={19} strokeWidth={2} />
                </button>
              )}
              {onEditRequest && (
                <button
                  type="button"
                  onClick={() => onEditRequest(appointment)}
                  aria-label="Редактировать"
                  title="Редактировать"
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--accent)] active:bg-[var(--accent-tint)]"
                >
                  <Pencil size={18} strokeWidth={2} />
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scroll body */}
        <div className="flex-1 min-h-0 overflow-y-auto pb-4">
          {/* City/team caption — read-only info strip. No dropdown, no
              click. City is edited from the calendar day header. */}
          <div className="px-4 py-2 bg-[var(--surface-grouped)] border-b border-[var(--separator)] flex items-center gap-2 text-[13px]">
            {city && (
              <span
                className="font-semibold flex-shrink-0"
                style={{ color: cityColor }}
              >
                {city}
              </span>
            )}
            {city && <span className="text-[var(--label-tertiary)]">·</span>}
            <span className="text-[var(--label)] flex-shrink-0">{teamLabel}</span>
          </div>

          <TimeBlock
            date={appointment.date}
            timeStart={appointment.time_start}
            timeEnd={appointment.time_end}
            readOnly
            onChange={() => {
              // No-op — sheet is read-only. Time edits go through EventSheet.
            }}
          />

          <SourceBlock value={appointment.source ?? null} readonly onChange={() => {}} />

          <ClientBlock
            client={client}
            readonly
            onPick={() => {}}
            onChange={() => {}}
            onMenu={client ? () => setClientMenuOpen(true) : undefined}
          />

          <LocationsBlock
            client={client}
            selectedLocationId={appointment.location_id}
            readOnly
            addressNote={appointment.address_note ?? ""}
            onSelectLocation={() => {}}
            onAddressNoteChange={() => {}}
          />

          <ServicesBlock
            services={appointment.services ?? []}
            globalDiscount={appointment.global_discount ?? null}
            catalog={catalog}
            readonly
            onServicesChange={() => {}}
            onOpenPicker={() => {}}
          />

          <IncomeBlock
            services={appointment.services ?? []}
            globalDiscount={appointment.global_discount ?? null}
            catalog={catalog}
            readonly
            onServicesChange={() => {}}
            onGlobalDiscountChange={() => {}}
          />

          <CommentBlock value={appointment.comment} readonly onChange={() => {}} />

          <div ref={photoScrollRef}>
            <PhotoBlock
              photos={photos}
              readonly
              tenantId={tenantId}
              appointmentId={appointment.id}
              locationLabel={selectedLocation?.label}
              onChange={setPhotos}
            />
          </div>

          {appointment.status === "cancelled" && (
            <div className="px-4 pt-3">
              <div className="px-3 py-2 rounded-[14px] bg-[rgba(255,59,48,0.08)] border border-[rgba(255,59,48,0.2)] text-[13px] text-[var(--label)]">
                <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--system-red)] mb-0.5">
                  Запись отменена
                </div>
                <div>
                  {appointment.cancel_reason?.trim() || "Причина не указана"}
                </div>
              </div>
            </div>
          )}

          {mode === "view" && (
            <PaymentBlock total={appointment.total_amount} onPay={handlePay} />
          )}
        </div>
      </div>

      {client && (
        <ClientActionMenu
          open={clientMenuOpen}
          onClose={() => setClientMenuOpen(false)}
          client={client}
          onProfile={() => setClientProfileOpen(true)}
          onSendMessage={() => setSendMsgOpen(true)}
          onOpenChat={() => {
            const existing = loadChats().find((ch) => ch.client_id === client.id);
            if (existing) {
              router.push(`/dashboard/chats?chat_id=${existing.id}`);
            } else {
              router.push(`/dashboard/chats?client_id=${client.id}`);
            }
          }}
          onShare={async () => {
            const parts = [client.full_name];
            if (client.phone) parts.push(client.phone);
            const text = parts.join(" · ");
            if (typeof navigator !== "undefined" && navigator.share) {
              try {
                await navigator.share({ title: client.full_name, text });
              } catch {
                // user dismissed
              }
            } else if (typeof navigator !== "undefined" && navigator.clipboard) {
              try {
                await navigator.clipboard.writeText(text);
              } catch {
                // ignore
              }
            }
          }}
          onScheduleRepeat={
            appointment.status === "completed" && client
              ? () => setRepeatSheetOpen(true)
              : undefined
          }
          onDownloadInvoice={
            appointment.status === "completed" && client
              ? async () => {
                  const { generateInvoicePDF, downloadBlob } = await import(
                    "@babun/shared/local/finance/invoice"
                  );
                  const { blob, filename } = generateInvoicePDF({
                    appointment,
                    client,
                    services: catalog,
                    team: activeTeam,
                    company: loadCompany(),
                    includePhotos: photos.length > 0,
                  });
                  downloadBlob(blob, filename);
                }
              : undefined
          }
          onShareAppointment={async () => {
            const serviceNames = (appointment.services ?? [])
              .map((l) => catalog.find((s) => s.id === l.serviceId)?.name)
              .filter((n): n is string => Boolean(n));
            const origin =
              typeof window !== "undefined" ? window.location.origin : "";
            const url = buildShareUrl(origin, {
              d: appointment.date,
              ts: appointment.time_start,
              te: appointment.time_end,
              c: client.full_name,
              s: serviceNames,
              a: appointment.address || undefined,
              b: activeTeam?.name,
              t: Math.round(appointment.total_amount),
              st: appointment.status,
            });
            const title = `Запись ${appointment.date} · ${appointment.time_start}`;
            if (typeof navigator !== "undefined" && navigator.share) {
              try {
                await navigator.share({ title, url });
                return;
              } catch {
                // user dismissed — fall through to clipboard.
              }
            }
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              try {
                await navigator.clipboard.writeText(url);
                toast.show({
                  variant: "success",
                  message: "Ссылка скопирована — отправьте клиенту",
                });
              } catch {
                toast.show({
                  variant: "error",
                  message: "Не удалось скопировать. Скопируйте вручную в адресной строке.",
                });
              }
            } else {
              toast.show({
                variant: "error",
                message: "Копирование не поддерживается в этом браузере.",
              });
            }
          }}
        />
      )}

      {client && (
        <SendMessagePopup
          open={sendMsgOpen}
          onClose={() => setSendMsgOpen(false)}
          phone={client.phone ?? null}
          clientName={client.full_name}
        />
      )}

      {client && (
        <RepeatReminderSheet
          open={repeatSheetOpen}
          clientName={client.full_name}
          serviceSummary={(appointment.services ?? [])
            .map((l) => catalog.find((s) => s.id === l.serviceId)?.name)
            .filter(Boolean)
            .join(" · ")}
          lastDate={appointment.date}
          onClose={() => setRepeatSheetOpen(false)}
          onConfirm={(months, note) => {
            const serviceSummary = (appointment.services ?? [])
              .map((l) => catalog.find((s) => s.id === l.serviceId)?.name)
              .filter((n): n is string => Boolean(n))
              .join(" · ");
            const supabase = getSupabaseBrowser();
            void createRecurringReminder(supabase, tenantId, {
              client_id: client.id,
              client_name: client.full_name,
              phone: client.phone ?? "",
              team_id: activeTeam?.id ?? null,
              service_ids: (appointment.services ?? []).map((l) => l.serviceId),
              service_summary: serviceSummary,
              last_date: appointment.date,
              interval_months: months,
              note,
            }).then(() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("babun:recurring-changed"));
              }
            }).catch((err) => {
              console.warn("STORY-050: createRecurringReminder failed", err);
            });
          }}
        />
      )}

      {/* Client profile overlay — rendered on top of the appointment
          sheet so picking ⋯ → Профиль doesn't navigate away. Tapping
          ← inside closes the overlay and leaves the draft intact. */}
      {clientProfileOpen && client && (
        <div
          className="fixed inset-0 z-[95] bg-[var(--surface-overlay)] backdrop-blur-[2px] flex items-center justify-center p-2"
          onClick={() => setClientProfileOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[var(--surface-card)] rounded-[20px] shadow-[var(--shadow-sheet)] flex flex-col overflow-hidden"
            style={{ height: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <ClientProfileView
              clientId={client.id}
              onBack={() => setClientProfileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Keep reference list silenced */}
      <div className="hidden">{CITY_LIST.length}</div>
    </div>
  );
}


