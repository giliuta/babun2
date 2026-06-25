// MetaBlock (mobile port of apps/web/.../blocks/MetaBlock.tsx)
// STORY-034 — Метаданные: Источник обращения · теги · «в базе с …».
// Plus a Чёрный список toggle (client.blacklisted) — the field exists
// on Client and has no home in the other blocks, so it lives here.
// Presentational only — receives client + update() + the tenant tag
// catalog (the composer supplies `tags`; absent → empty-catalog state,
// matching web).

import { Plus, X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import type { Client, ClientTag } from "@babun/shared/local/clients";
import {
  ACQUISITION_LABELS,
  type AcquisitionSource,
} from "@babun/shared/local/clients";

interface MetaBlockProps {
  client: Client;
  update: (patch: Partial<Client>) => void;
  /** Tenant-managed tag catalog (palette + label). The composer passes
   *  this; when omitted we render the empty-catalog hint, same as web. */
  tags?: ClientTag[];
}

const SOURCE_KEYS = Object.keys(
  ACQUISITION_LABELS,
) as AcquisitionSource[];

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MetaBlock({ client, update, tags = [] }: MetaBlockProps) {
  const toggleTag = (id: string) =>
    update({
      tag_ids: client.tag_ids.includes(id)
        ? client.tag_ids.filter((t) => t !== id)
        : [...client.tag_ids, id],
    });

  return (
    <View className="mx-3 mt-2 rounded-2xl bg-white p-3 shadow-sm">
      <Text className="px-1 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Метаданные
      </Text>

      <View className="gap-3 px-1">
        {/* Источник обращения — web uses a <select>; RN has no native
            select, so render the options as a wrapping chip group. */}
        <View>
          <Text className="mb-1.5 text-xs text-neutral-500">
            Источник обращения
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {SOURCE_KEYS.map((k) => {
              const active = client.acquisition_source === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => update({ acquisition_source: k })}
                  className={`h-7 items-center justify-center rounded-full px-2.5 active:opacity-70 ${
                    active ? "bg-brand" : "bg-neutral-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      active ? "text-white" : "text-neutral-500"
                    }`}
                  >
                    {ACQUISITION_LABELS[k]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Теги */}
        <View>
          <Text className="mb-1.5 text-xs text-neutral-500">Теги</Text>
          {tags.length === 0 ? (
            <Text className="text-xs italic text-neutral-400">
              Нет тегов в каталоге.
            </Text>
          ) : (
            <View className="flex-row flex-wrap gap-1.5">
              {tags.map((t) => {
                const active = client.tag_ids.includes(t.id);
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => toggleTag(t.id)}
                    className="h-7 flex-row items-center gap-1 rounded-full border px-2.5 active:opacity-70"
                    style={
                      active
                        ? {
                            backgroundColor: `${t.color}22`,
                            borderColor: t.color,
                          }
                        : {
                            backgroundColor: "#ffffff",
                            borderColor: "#e5e5e5",
                          }
                    }
                  >
                    {active ? (
                      <X color={t.color} size={10} strokeWidth={2.5} />
                    ) : (
                      <Plus color="#737373" size={10} strokeWidth={2.5} />
                    )}
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: active ? t.color : "#737373" }}
                    >
                      {t.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Чёрный список — client.blacklisted. Not present in the web
            block, but the field exists and belongs with meta flags. */}
        <View className="flex-row items-center justify-between border-t border-neutral-100 pt-3">
          <Text className="text-[13px] text-neutral-700">Чёрный список</Text>
          <Pressable
            onPress={() => update({ blacklisted: !client.blacklisted })}
            className={`h-7 items-center justify-center rounded-full px-3 active:opacity-70 ${
              client.blacklisted ? "bg-danger" : "bg-neutral-100"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                client.blacklisted ? "text-white" : "text-neutral-500"
              }`}
            >
              {client.blacklisted ? "В списке" : "Нет"}
            </Text>
          </Pressable>
        </View>

        {/* В базе с … */}
        <Text className="border-t border-neutral-100 pt-3 text-xs text-neutral-400">
          В базе с {formatCreatedAt(client.created_at)}
        </Text>
      </View>
    </View>
  );
}

export default MetaBlock;
