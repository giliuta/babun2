"use client";

// Sprint clients-99 (F3.10) — Attachments block.
//
// Renders inside the client card. Lists files from
// public.client_attachments, lets the dispatcher upload new ones and
// delete existing ones. Images get an inline thumbnail rendered via
// a 5-minute signed URL; non-images show a generic icon + filename.

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Plus, Trash2, FileText } from "@babun/shared/icons";
import type { Client } from "@babun/shared/local/clients";
import ClientCard from "../ClientCard";
import { Button } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useTenantId } from "@/components/layout/DashboardClientLayout";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { haptic } from "@/lib/haptics";
import {
  AttachmentError,
  deleteAttachment,
  formatBytes,
  getSignedUrl,
  isImage,
  listAttachments,
  uploadAttachment,
  type ClientAttachment,
} from "@/lib/clients/attachments";

interface Props {
  client: Client;
}

export default function AttachmentsBlock({ client }: Props) {
  const tenantId = useTenantId();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ClientAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await listAttachments(getSupabaseBrowser(), {
        tenantId,
        clientId: client.id,
      });
      setItems(next);
      // Mint a signed URL for every image so <img> works.
      const imgs = next.filter(isImage);
      const supabase = getSupabaseBrowser();
      const entries = await Promise.all(
        imgs.map(async (a) => {
          try {
            const url = await getSignedUrl(supabase, a);
            return [a.id, url] as const;
          } catch {
            return [a.id, ""] as const;
          }
        }),
      );
      setThumbs(Object.fromEntries(entries.filter(([, u]) => u)));
    } catch (err) {
      const msg =
        err instanceof AttachmentError ? err.message : "Не удалось загрузить файлы";
      toast.show({ variant: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }, [tenantId, client.id, toast]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handlePick = () => {
    haptic("tap");
    fileRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        await uploadAttachment(getSupabaseBrowser(), {
          tenantId,
          clientId: client.id,
          file,
        });
      }
      toast.show({
        variant: "success",
        message:
          files.length === 1 ? "Файл загружен" : `Загружено: ${files.length}`,
      });
      await reload();
    } catch (err) {
      const msg =
        err instanceof AttachmentError
          ? err.message
          : "Не удалось загрузить файл";
      toast.show({ variant: "error", message: msg });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (a: ClientAttachment) => {
    haptic("warning");
    try {
      await deleteAttachment(getSupabaseBrowser(), { attachment: a, tenantId });
      setItems((prev) => prev.filter((x) => x.id !== a.id));
      setThumbs((prev) => {
        const next = { ...prev };
        delete next[a.id];
        return next;
      });
    } catch (err) {
      const msg =
        err instanceof AttachmentError ? err.message : "Не удалось удалить";
      toast.show({ variant: "error", message: msg });
    }
  };

  const handleOpen = async (a: ClientAttachment) => {
    haptic("light");
    try {
      const url = await getSignedUrl(getSupabaseBrowser(), a);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.show({ variant: "error", message: "Не удалось открыть файл" });
    }
  };

  return (
    <ClientCard
      kind="attachments"
      title="Вложения"
      badge={items.length || undefined}
    >
      <div className="px-3 py-3 space-y-2">
        <input
          ref={fileRef}
          type="file"
          multiple
          onChange={handleFile}
          className="hidden"
          aria-hidden
        />
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handlePick}
            disabled={uploading}
          >
            <Plus size={14} strokeWidth={2.5} />
            {uploading ? "Загрузка…" : "Добавить файл"}
          </Button>
          <span className="text-[11px] text-[var(--label-tertiary)]">
            До 10 МБ. Фото «до/после», договоры, скан паспорта.
          </span>
        </div>

        {loading && items.length === 0 ? (
          <div className="text-[12px] text-[var(--label-tertiary)] py-1">
            Загрузка…
          </div>
        ) : items.length === 0 ? (
          <div className="text-[12px] text-[var(--label-tertiary)] italic flex items-center gap-1.5 py-1">
            <Paperclip size={11} strokeWidth={2.2} />
            Файлов пока нет
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {items.map((a) => {
              const thumb = thumbs[a.id];
              return (
                <div
                  key={a.id}
                  className="group relative aspect-square rounded-[10px] bg-[var(--fill-tertiary)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--accent-tint)]"
                >
                  <button
                    type="button"
                    onClick={() => void handleOpen(a)}
                    className="absolute inset-0 flex items-center justify-center"
                    aria-label={`Открыть ${a.filename}`}
                  >
                    {isImage(a) && thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-[var(--label-secondary)]">
                        <FileText size={22} strokeWidth={2} />
                        <span className="mt-1 text-[10px] uppercase tracking-wider">
                          {(a.filename.split(".").pop() ?? "файл").slice(0, 4)}
                        </span>
                      </div>
                    )}
                  </button>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/35 to-transparent text-white text-[10px] px-1.5 py-0.5 flex items-center justify-between gap-1 pointer-events-none">
                    <span className="truncate flex-1 min-w-0">{a.filename}</span>
                    <span className="tabular-nums opacity-80">
                      {formatBytes(a.size_bytes)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(a)}
                    aria-label="Удалить"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center active:bg-[var(--system-red)] focus-visible:opacity-100"
                  >
                    <Trash2 size={11} strokeWidth={2.4} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ClientCard>
  );
}
