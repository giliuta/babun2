"use client";

// STORY-034 — Meta block.  Источник обращения · теги · created_at ·
// referrer.  Hidden for the future "crew" role
// (DEFAULT_BLOCK_ORDER flag).

import { Plus, X } from "@babun/shared/icons";
import type { Client } from "@babun/shared/local/clients";
import { ACQUISITION_LABELS, type AcquisitionSource } from "@babun/shared/local/clients";
import { useClients } from "@/components/layout/DashboardClientLayout";
import ClientCard from "../ClientCard";
import { haptic } from "@/lib/haptics";

interface MetaBlockProps {
  client: Client;
  onUpdate: (next: Client) => void;
}

export default function MetaBlock({ client, onUpdate }: MetaBlockProps) {
  // Pull tenant-managed tag list (palette + label).  Created/edited
  // on /dashboard/settings → tags (future).  Today user can pick from
  // existing palette only.
  const { tags } = useClients();

  const toggleTag = (id: string) => {
    haptic("light");
    onUpdate({
      ...client,
      tag_ids: client.tag_ids.includes(id)
        ? client.tag_ids.filter((t) => t !== id)
        : [...client.tag_ids, id],
    });
  };

  return (
    <ClientCard kind="meta" title="Метаданные">
      <div className="px-3 py-3 space-y-3">
        <div>
          <div className="text-[12px] text-[var(--label-secondary)] mb-1">
            Источник обращения
          </div>
          <select
            value={client.acquisition_source}
            onChange={(e) =>
              onUpdate({
                ...client,
                acquisition_source: e.target.value as AcquisitionSource,
              })
            }
            className="w-full h-8 px-2 text-[13px] bg-[var(--fill-tertiary)] border border-transparent rounded-md focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
          >
            {(
              Object.keys(ACQUISITION_LABELS) as (keyof typeof ACQUISITION_LABELS)[]
            ).map((k) => (
              <option key={k} value={k}>
                {ACQUISITION_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-[12px] text-[var(--label-secondary)] mb-1">
            Теги
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags.length === 0 && (
              <span className="text-[12px] text-[var(--label-tertiary)] italic">
                Нет тегов в каталоге.
              </span>
            )}
            {tags.map((t) => {
              const active = client.tag_ids.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className="h-7 px-2.5 rounded-full text-[12px] font-semibold border transition inline-flex items-center gap-1"
                  style={
                    active
                      ? {
                          backgroundColor: `${t.color}22`,
                          borderColor: t.color,
                          color: t.color,
                        }
                      : {
                          backgroundColor: "var(--surface-card)",
                          borderColor: "var(--separator)",
                          color: "var(--label-secondary)",
                        }
                  }
                >
                  {active ? (
                    <X size={10} strokeWidth={2.5} />
                  ) : (
                    <Plus size={10} strokeWidth={2.5} />
                  )}
                  {t.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-[12px] text-[var(--label-tertiary)] tabular-nums pt-1 border-t border-[var(--separator)]">
          В базе с {formatCreatedAt(client.created_at)}
        </div>
      </div>
    </ClientCard>
  );
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
