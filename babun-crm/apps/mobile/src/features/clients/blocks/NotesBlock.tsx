// NotesBlock — mobile port of the web client-card Notes block
// (apps/web/src/components/clients/blocks/NotesBlock.tsx).
//
// Free-form dated log: calls, meetings, complaints, upsell hooks. Each
// note carries a created_at timestamp shown as «25 июн». Add prepends a
// new note; remove drops one. Persists via `update(patch)`.
//
// DEGRADED vs web: the web renders note text through <MarkdownLite>
// (**bold**, *italic*, ::red::, «- » lists). That helper is DOM-based,
// so here we render the raw text plainly. A native markdown-lite
// renderer is a follow-up if the team wants the inline styling.
//
// DROPPED vs web: the `focusToken` prop (open + focus + scrollIntoView
// driven by the hero «+ Заметка» quick action) relied on DOM refs /
// window.setTimeout / scrollIntoView. The block is always expanded on
// mobile, so the input is reachable without that machinery.

import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { StickyNote, X } from "lucide-react-native";
import type { Client, ClientNote } from "@babun/shared/local/clients";

interface NotesBlockProps {
  client: Client;
  update: (patch: Partial<Client>) => void;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function NotesBlock({ client, update }: NotesBlockProps) {
  const [draft, setDraft] = useState("");
  const notes = client.notes ?? [];

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    const note: ClientNote = {
      id: genId("note"),
      text,
      created_at: new Date().toISOString(),
    };
    update({ notes: [note, ...notes] });
    setDraft("");
  };

  const remove = (id: string) =>
    update({ notes: notes.filter((n) => n.id !== id) });

  return (
    <View className="mx-3 mt-2 rounded-2xl bg-white p-3 shadow-sm">
      <Text className="px-1 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Заметки{notes.length ? ` · ${notes.length}` : ""}
      </Text>

      <View className="gap-2 px-1 pt-1">
        <View className="flex-row gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            placeholder="Записать звонок / встречу / наблюдение"
            placeholderTextColor="#a3a3a3"
            className="h-9 flex-1 rounded-[10px] bg-neutral-100 px-3 text-[13px] text-neutral-900"
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim()}
            className={`items-center justify-center rounded-[10px] px-4 ${
              draft.trim() ? "bg-brand" : "bg-neutral-200"
            }`}
          >
            <Text className="text-sm font-semibold text-white">Добавить</Text>
          </Pressable>
        </View>

        {notes.length === 0 ? (
          <View className="flex-row items-center gap-1.5 py-1">
            <StickyNote color="#a3a3a3" size={12} />
            <Text className="text-[12px] italic text-neutral-400">Пусто</Text>
          </View>
        ) : (
          <View className="gap-1.5">
            {notes.map((n) => (
              <View
                key={n.id}
                className="flex-row items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 p-2"
              >
                <Text className="flex-1 text-[13px] text-amber-700">
                  <Text className="text-[12px] text-amber-700">
                    {formatNoteDate(n.created_at)}{" "}
                  </Text>
                  {n.text}
                </Text>
                <Pressable
                  onPress={() => remove(n.id)}
                  className="h-6 w-6 items-center justify-center active:opacity-60"
                >
                  <X color="#b45309" size={13} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
