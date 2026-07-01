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
import { useThemeColors } from "@/theme/colors";

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
  const th = useThemeColors();

  const toggleTag = (id: string) =>
    update({
      tag_ids: client.tag_ids.includes(id)
        ? client.tag_ids.filter((t) => t !== id)
        : [...client.tag_ids, id],
    });

  const chipInactiveBg = th.dark ? "rgba(255,255,255,0.07)" : "#eef1f5";

  return (
    <View className="mx-3 mt-2 rounded-2xl p-3 shadow-sm" style={{ backgroundColor: th.surface }}>
      <Text className="px-1 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider" style={{ color: th.sub }}>
        Метаданные
      </Text>

      <View className="gap-3 px-1">
        {/* Источник обращения — web uses a <select>; RN has no native
            select, so render the options as a wrapping chip group. */}
        <View>
          <Text className="mb-1.5 text-xs" style={{ color: th.sub }}>
            Источник обращения
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {SOURCE_KEYS.map((k) => {
              const active = client.acquisition_source === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => update({ acquisition_source: k })}
                  className="h-7 items-center justify-center rounded-full px-2.5 active:opacity-60"
                  style={{ backgroundColor: active ? th.accent : chipInactiveBg }}
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: active ? "#fff" : th.sub }}
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
          <Text className="mb-1.5 text-xs" style={{ color: th.sub }}>Теги</Text>
          {tags.length === 0 ? (
            <Text className="text-xs italic" style={{ color: th.faint }}>
              Нет тегов в каталоге.
            </Text>
          ) : (
            <View className="flex-row flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = client.tag_ids.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => toggleTag(tag.id)}
                    className="h-7 flex-row items-center gap-1 rounded-full border px-2.5 active:opacity-60"
                    style={
                      active
                        ? {
                            backgroundColor: `${tag.color}22`,
                            borderColor: tag.color,
                          }
                        : {
                            backgroundColor: th.surface,
                            borderColor: th.separator,
                          }
                    }
                  >
                    {active ? (
                      <X color={tag.color} size={10} strokeWidth={2.5} />
                    ) : (
                      <Plus color={th.faint} size={10} strokeWidth={2.5} />
                    )}
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: active ? tag.color : th.faint }}
                    >
                      {tag.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Чёрный список — client.blacklisted. Not present in the web
            block, but the field exists and belongs with meta flags. */}
        <View className="flex-row items-center justify-between border-t pt-3" style={{ borderColor: th.separator }}>
          <Text className="text-[13px]" style={{ color: th.sub }}>Чёрный список</Text>
          <Pressable
            onPress={() => update({ blacklisted: !client.blacklisted })}
            className="h-7 items-center justify-center rounded-full px-3 active:opacity-60"
            style={{ backgroundColor: client.blacklisted ? th.danger : chipInactiveBg }}
          >
            <Text
              className="text-xs font-semibold"
              style={{ color: client.blacklisted ? "#fff" : th.sub }}
            >
              {client.blacklisted ? "В списке" : "Нет"}
            </Text>
          </Pressable>
        </View>

        {/* В базе с … */}
        <Text className="border-t pt-3 text-xs" style={{ borderColor: th.separator, color: th.faint }}>
          В базе с {formatCreatedAt(client.created_at)}
        </Text>
      </View>
    </View>
  );
}

export default MetaBlock;
