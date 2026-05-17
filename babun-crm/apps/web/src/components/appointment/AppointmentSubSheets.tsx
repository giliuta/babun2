"use client";

/**
 * AppointmentSubSheets.tsx
 *
 * Wraps the portal-level sub-sheets, pickers, dialogs, and overlays that
 * sit outside the main AppointmentSheet modal chrome:
 *   - ClientPickerSheet
 *   - ServicePickerSheet
 *   - CloseConfirmDialog + AskClientFirstDialog
 *   - ClientActionMenu
 *   - SendMessagePopup
 *   - RepeatReminderSheet
 *   - ClientProfileView overlay
 *
 * Extracted from AppointmentSheet.tsx (Sprint #4 P0 §9, step 2).
 * All state lives in AppointmentSheet; this component only renders
 * conditionally and forwards callbacks.
 */

import type { Appointment, AppointmentService } from "@babun/shared/local/appointments";
import type { Client } from "@babun/shared/local/clients";
import type { Service, ServiceCategory } from "@babun/shared/local/services";
import type { Team } from "@babun/shared/local/masters";
import { servicesToIds, idsToServices } from "@/lib/appointment-services";
import ClientPickerSheet from "@/components/appointments/sheet/ClientPickerSheet";
import ServicePickerSheet from "@/components/appointments/sheet/ServicePickerSheet";
import { CloseConfirmDialog, AskClientFirstDialog } from "./AppointmentConfirmDialogs";
import ClientActionMenu from "./ClientActionMenu";
import SendMessagePopup from "./SendMessagePopup";
import ClientProfileView from "@/components/clients/ClientProfileView";
import RepeatReminderSheet from "./RepeatReminderSheet";
import type { AppointmentSheetMode } from "./AppointmentSheet";
import { buildShareUrl } from "@babun/shared/common/utils/share-link";
import { loadCompany } from "@babun/shared/local/finance/company";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { loadChats } from "@babun/shared/local/chats";

export interface AppointmentSubSheetsProps {
  // ── Client picker ─────────────────────────────────────────────────
  clientSheet: boolean;
  setClientSheet: (v: boolean) => void;
  clients: Client[];
  recentClientIds: string[];
  onClientSelect: (c: Client) => void;

  // ── Service picker ─────────────────────────────────────────────────
  servicePickerOpen: boolean;
  setServicePickerOpen: (v: boolean) => void;
  catalog: Service[];
  categories: ServiceCategory[];
  activeTeam: Team | null;
  appointmentServices: AppointmentService[];
  onServicesConfirm: (services: AppointmentService[]) => void;
  client: Client | null;

  // ── Close/discard dialogs ──────────────────────────────────────────
  closeConfirm: boolean;
  setCloseConfirm: (v: boolean) => void;
  liveMode: AppointmentSheetMode;
  canSave: boolean;
  onClose: () => void;
  onSaveAndClose: () => void;
  askClientFirst: boolean;
  setAskClientFirst: (v: boolean) => void;

  // ── Client action menu ─────────────────────────────────────────────
  clientMenuOpen: boolean;
  setClientMenuOpen: (v: boolean) => void;
  setClientProfileOpen: (v: boolean) => void;
  setSendMsgOpen: (v: boolean) => void;
  setRepeatSheetOpen: (v: boolean) => void;
  appointment: Appointment;
  isEventMode: boolean;
  photos: { id: string }[];
  dateKey: string;
  timeStart: string;
  timeEnd: string;
  address: string;
  price: number;

  // ── Send message popup ─────────────────────────────────────────────
  sendMsgOpen: boolean;

  // ── Repeat reminder sheet ──────────────────────────────────────────
  repeatSheetOpen: boolean;
  onRepeatConfirm: (months: number, note: string) => void;

  // ── Client profile overlay ─────────────────────────────────────────
  clientProfileOpen: boolean;
}

export default function AppointmentSubSheets({
  clientSheet,
  setClientSheet,
  clients,
  recentClientIds,
  onClientSelect,
  servicePickerOpen,
  setServicePickerOpen,
  catalog,
  categories,
  activeTeam,
  appointmentServices,
  onServicesConfirm,
  client,
  closeConfirm,
  setCloseConfirm,
  liveMode,
  canSave,
  onClose,
  onSaveAndClose,
  askClientFirst,
  setAskClientFirst,
  clientMenuOpen,
  setClientMenuOpen,
  setClientProfileOpen,
  setSendMsgOpen,
  setRepeatSheetOpen,
  appointment,
  isEventMode,
  photos,
  dateKey,
  timeStart,
  timeEnd,
  address,
  price,
  sendMsgOpen,
  repeatSheetOpen,
  onRepeatConfirm,
  clientProfileOpen,
}: AppointmentSubSheetsProps) {
  const toast = useToast();
  const router = useRouter();

  return (
    <>
      <ClientPickerSheet
        open={clientSheet}
        onClose={() => setClientSheet(false)}
        onSelect={(c) => {
          onClientSelect(c);
          setClientSheet(false);
        }}
        clients={clients}
        recentClientIds={recentClientIds}
      />

      <ServicePickerSheet
        open={servicePickerOpen}
        onClose={() => setServicePickerOpen(false)}
        services={catalog}
        categories={categories}
        brigadeId={activeTeam?.id ?? null}
        initialSelectedIds={servicesToIds(appointmentServices)}
        onConfirm={(ids) => {
          onServicesConfirm(idsToServices(ids, catalog, appointmentServices));
        }}
        clientName={client?.full_name ?? null}
        clientPhone={client?.phone ?? null}
      />

      <CloseConfirmDialog
        open={closeConfirm}
        mode={liveMode}
        canSave={canSave}
        onCancel={() => setCloseConfirm(false)}
        onDiscard={() => {
          setCloseConfirm(false);
          onClose();
        }}
        onSave={() => {
          if (!canSave) return;
          onSaveAndClose();
          setCloseConfirm(false);
        }}
      />

      <AskClientFirstDialog
        open={askClientFirst}
        onCancel={() => setAskClientFirst(false)}
        onContinue={() => {
          setAskClientFirst(false);
          setServicePickerOpen(true);
        }}
        onPickClient={() => {
          setAskClientFirst(false);
          setClientSheet(true);
        }}
      />

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
            appointment.status === "completed" && !isEventMode && client
              ? () => setRepeatSheetOpen(true)
              : undefined
          }
          onDownloadInvoice={
            appointment.status === "completed" && !isEventMode && client
              ? async () => {
                  // Dynamic import keeps jspdf (+ renderer) out of the
                  // initial bundle. First tap incurs a one-off chunk
                  // load; subsequent taps are cached.
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
          onShareAppointment={
            liveMode === "create" || isEventMode
              ? undefined
              : async () => {
                  const serviceNames = appointmentServices
                    .map((l) => catalog.find((s) => s.id === l.serviceId)?.name)
                    .filter((n): n is string => Boolean(n));
                  const origin =
                    typeof window !== "undefined" ? window.location.origin : "";
                  const url = buildShareUrl(origin, {
                    d: dateKey,
                    ts: timeStart,
                    te: timeEnd,
                    c: client.full_name,
                    s: serviceNames,
                    a: address || undefined,
                    b: activeTeam?.name,
                    t: Math.round(price),
                    st: appointment.status,
                  });
                  const title = `Запись ${dateKey} · ${timeStart}`;
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
                }
          }
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
          serviceSummary={appointmentServices
            .map((l) => catalog.find((s) => s.id === l.serviceId)?.name)
            .filter(Boolean)
            .join(" · ")}
          lastDate={appointment.date}
          onClose={() => setRepeatSheetOpen(false)}
          onConfirm={onRepeatConfirm}
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
    </>
  );
}
