"use client";

// STORY-034 — Notes block.  Free-form dated log: calls, meetings,
// complaints, upsell hooks, gut-feel observations.  Quick-action
// «+ Заметка» in the hero bumps a `focusToken` prop — when it
// changes, this block opens itself, focuses the input, and (if URL
// has #notes) scrolls into view.

import { useEffect, useRef, useState } from "react";
import { X, StickyNote } from "@babun/shared/icons";
import type { Client, ClientNote } from "@babun/shared/local/clients";
import { generateId } from "@babun/shared/local/masters";
import ClientCard from "../ClientCard";
import { setBlockOpen } from "@babun/shared/local/business-blocks";
import { haptic } from "@/lib/haptics";
import { Button } from "@/components/ui";

interface NotesBlockProps {
  client: Client;
  onUpdate: (next: Client) => void;
  /** Increments when the user taps «+ Заметка» in quick actions.
   *  Triggers open + focus + scroll. */
  focusToken: number;
}

export default function NotesBlock({
  client,
  onUpdate,
  focusToken,
}: NotesBlockProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // The card itself owns "open" state — we need to override it on
  // focusToken bumps.  Achieve that by toggling forceOpen and clearing
  // it on the next tick (so the user can still close manually after).
  const [forceOpen, setForceOpen] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (focusToken === 0) return;
    setBlockOpen("notes", true);
    setForceOpen(true);
    // Clear forceOpen on the next macro-task so subsequent toggles
    // by the user are honoured.
    const t = window.setTimeout(() => setForceOpen(undefined), 50);
    // Focus + scroll on the next paint.
    const r = window.setTimeout(() => {
      inputRef.current?.focus();
      wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(r);
    };
  }, [focusToken]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    haptic("tap");
    const note: ClientNote = {
      id: generateId("note"),
      text,
      created_at: new Date().toISOString(),
    };
    onUpdate({ ...client, notes: [note, ...client.notes] });
    setDraft("");
    inputRef.current?.focus();
  };

  const remove = (id: string) => {
    haptic("warning");
    onUpdate({
      ...client,
      notes: client.notes.filter((n) => n.id !== id),
    });
  };

  return (
    <div ref={wrapRef} id="notes">
      <ClientCard
        kind="notes"
        title="Заметки"
        badge={client.notes.length || undefined}
        forceOpen={forceOpen}
      >
        <div className="px-3 py-3 space-y-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Записать звонок / встречу / наблюдение"
              className="flex-1 h-9 px-3 rounded-[10px] bg-[var(--fill-tertiary)] border border-transparent text-[13px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={submit}
              disabled={!draft.trim()}
            >
              Добавить
            </Button>
          </div>
          {client.notes.length === 0 ? (
            <div className="text-[12px] text-[var(--label-tertiary)] italic flex items-center gap-1.5 py-1">
              <StickyNote size={11} strokeWidth={2.2} />
              Пусто
            </div>
          ) : (
            <div className="space-y-1.5">
              {client.notes.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-[rgba(255,149,0,0.08)] border border-[rgba(255,149,0,0.25)]"
                >
                  <div className="flex-1 text-[13px] text-[var(--system-orange)] whitespace-pre-wrap">
                    <span className="text-[12px] mr-1 tabular-nums">
                      {formatNoteDate(n.created_at)}
                    </span>
                    {n.text}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    aria-label="Удалить"
                    className="w-6 h-6 flex items-center justify-center rounded text-[var(--system-orange)] active:text-[var(--system-red)]"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ClientCard>
    </div>
  );
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
