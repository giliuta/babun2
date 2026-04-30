"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, X, Copy, Check } from "@babun/shared/icons";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useConfirm } from "@/components/ui/ConfirmProvider";

type Role = "owner" | "dispatcher" | "master";
const ROLE_LABEL: Record<Role, string> = {
  owner: "Владелец",
  dispatcher: "Диспетчер",
  master: "Мастер",
};

interface Member {
  user_id: string;
  role: Role;
  joined_at: string;
  email?: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  expires_at: string;
  token: string;
}

interface Props {
  tenantId: string;
  callerUserId: string;
  callerRole: string;
}

export default function TeamSettingsClient({
  tenantId,
  callerUserId,
  callerRole,
}: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isOwner = callerRole === "owner";

  async function refresh() {
    setError(null);
    const supabase = getSupabaseBrowser();
    try {
      const [memRes, invRes] = await Promise.all([
        supabase
          .from("tenant_members")
          .select("user_id, role, joined_at")
          .eq("tenant_id", tenantId)
          .order("joined_at", { ascending: true }),
        supabase
          .from("invitations")
          .select("id, email, role, expires_at, token")
          .eq("tenant_id", tenantId)
          .is("accepted_at", null)
          .order("created_at", { ascending: false }),
      ]);
      if (memRes.error) throw memRes.error;
      if (invRes.error) throw invRes.error;
      setMembers((memRes.data ?? []) as Member[]);
      setInvites((invRes.data ?? []) as Invitation[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function changeRole(member: Member, nextRole: Role) {
    if (member.role === nextRole) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: e } = await supabase
      .from("tenant_members")
      .update({ role: nextRole })
      .eq("tenant_id", tenantId)
      .eq("user_id", member.user_id);
    if (e) {
      setError(e.code === "23514" ? "Нельзя понизить последнего владельца." : e.message);
    }
    setBusy(false);
    await refresh();
  }

  async function removeMember(member: Member) {
    const confirmed = await confirm({
      title: "Удалить участника?",
      message: "Доступ к команде будет отозван немедленно.",
    });
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: e } = await supabase
      .from("tenant_members")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", member.user_id);
    if (e) {
      setError(e.code === "23514" ? "Нельзя удалить последнего владельца." : e.message);
    }
    setBusy(false);
    await refresh();
  }

  async function leaveTeam() {
    const confirmed = await confirm({
      title: "Покинуть команду?",
      message: "Вы потеряете доступ к данным этой команды.",
    });
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowser();
    const { error: e } = await supabase
      .from("tenant_members")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("user_id", callerUserId);
    setBusy(false);
    if (e) {
      setError(e.code === "23514" ? "Вы единственный владелец. Сначала пригласите ещё одного." : e.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function revokeInvite(inv: Invitation) {
    const confirmed = await confirm({ title: "Отозвать приглашение?" });
    if (!confirmed) return;
    setBusy(true);
    const supabase = getSupabaseBrowser();
    const { error: e } = await supabase
      .from("invitations")
      .delete()
      .eq("id", inv.id);
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    await refresh();
  }

  return (
    <>
      <div>
        <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider flex items-center gap-2">
          <Users size={14} />
          <span>Участники ({members.length})</span>
        </div>
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)]">
          {loading && (
            <div className="p-4 text-[14px] text-[var(--label-tertiary)]">Загрузка…</div>
          )}
          {!loading && members.length === 0 && (
            <div className="p-4 text-[14px] text-[var(--label-tertiary)]">Никого нет.</div>
          )}
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-[var(--label)] truncate">
                  {m.user_id === callerUserId ? "Это вы" : m.user_id.slice(0, 8) + "…"}
                </div>
                <div className="text-[12px] text-[var(--label-tertiary)]">
                  {ROLE_LABEL[m.role]} · с {m.joined_at.slice(0, 10)}
                </div>
              </div>
              {isOwner && m.user_id !== callerUserId && (
                <select
                  value={m.role}
                  onChange={(e) => void changeRole(m, e.target.value as Role)}
                  disabled={busy}
                  className="px-2 py-1 rounded-[8px] border border-[var(--separator)] text-[13px] bg-[var(--surface-card)]"
                >
                  <option value="owner">Владелец</option>
                  <option value="dispatcher">Диспетчер</option>
                  <option value="master">Мастер</option>
                </select>
              )}
              {isOwner && m.user_id !== callerUserId && (
                <button
                  type="button"
                  onClick={() => void removeMember(m)}
                  disabled={busy}
                  className="px-3 h-9 rounded-[10px] bg-[rgba(255,59,48,0.10)] border border-[rgba(255,59,48,0.30)] text-[var(--system-red)] text-[13px] font-semibold active:bg-[rgba(255,59,48,0.18)] transition"
                >
                  Удалить
                </button>
              )}
              {m.user_id === callerUserId && (
                <button
                  type="button"
                  onClick={() => void leaveTeam()}
                  disabled={busy}
                  className="px-3 h-9 rounded-[10px] border border-[var(--separator)] text-[var(--label-secondary)] text-[13px] font-medium active:bg-[var(--fill-quaternary)] transition"
                >
                  Покинуть
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {isOwner && (
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="w-full h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] transition flex items-center justify-center gap-2"
        >
          <UserPlus size={16} />
          Пригласить участника
        </button>
      )}

      {invites.length > 0 && isOwner && (
        <div>
          <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
            Ожидают принятия ({invites.length})
          </div>
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)]">
            {invites.map((inv) => (
              <PendingInviteRow
                key={inv.id}
                inv={inv}
                onRevoke={() => void revokeInvite(inv)}
              />
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="text-[13px] text-[var(--system-red)] leading-snug bg-[rgba(255,59,48,0.10)] border border-[rgba(255,59,48,0.30)] rounded-[10px] px-3 py-2">
          {error}
        </div>
      )}

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onCreated={() => {
            setInviteOpen(false);
            void refresh();
          }}
        />
      )}
    </>
  );
}

function PendingInviteRow({
  inv,
  onRevoke,
}: {
  inv: Invitation;
  onRevoke: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/invite/${inv.token}` : "";
  const expiresIn = Math.max(
    0,
    Math.floor((new Date(inv.expires_at).getTime() - Date.now()) / 86400000),
  );
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
      <div className="flex-1 min-w-0">
        <div className="text-[14px] text-[var(--label)] truncate">{inv.email}</div>
        <div className="text-[12px] text-[var(--label-tertiary)]">
          {ROLE_LABEL[inv.role]} · истекает через {expiresIn} дн.
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            void navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }
        }}
        className="px-3 h-9 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[13px] font-medium active:bg-[var(--fill-secondary)] transition flex items-center gap-1"
      >
        {copied ? <><Check size={14} /> Скопировано</> : <><Copy size={14} /> Ссылка</>}
      </button>
      <button
        type="button"
        onClick={onRevoke}
        className="w-9 h-9 rounded-[10px] text-[var(--label-tertiary)] active:bg-[var(--fill-quaternary)] flex items-center justify-center"
        aria-label="Отозвать"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function InviteModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("dispatcher");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `HTTP ${res.status}`);
      return;
    }
    const body = (await res.json()) as { url: string };
    setCreatedUrl(body.url);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <h2 className="text-[17px] font-semibold text-[var(--label)]">
          {createdUrl ? "Приглашение создано" : "Пригласить участника"}
        </h2>
        {createdUrl ? (
          <>
            <p className="text-[13px] text-[var(--label-secondary)] leading-snug">
              Скопируйте ссылку и отправьте приглашённому. Действует 7 дней, использовать можно один раз.
            </p>
            <input
              readOnly
              value={createdUrl}
              className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] rounded-[10px] text-[13px] text-[var(--label)] font-mono"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (createdUrl) void navigator.clipboard.writeText(createdUrl);
                }}
                className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-medium active:bg-[var(--fill-secondary)] transition"
              >
                Скопировать
              </button>
              <button
                type="button"
                onClick={onCreated}
                className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold active:bg-[var(--accent-pressed)] transition"
              >
                Готово
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="block">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
                Email
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                className="w-full h-11 px-3.5 bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] text-[15px] text-[var(--label)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition"
              />
            </label>
            <label className="block">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
                Роль
              </div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full h-11 px-3 bg-[var(--fill-tertiary)] rounded-[10px] text-[15px] text-[var(--label)]"
              >
                <option value="dispatcher">Диспетчер — календарь и клиенты</option>
                <option value="master">Мастер — только статус и комментарии</option>
                <option value="owner">Владелец — полный доступ</option>
              </select>
            </label>
            {error && (
              <div className="text-[13px] text-[var(--system-red)] leading-snug">{error}</div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 h-11 rounded-[10px] bg-[var(--fill-tertiary)] text-[var(--label)] text-[15px] font-medium active:bg-[var(--fill-secondary)] disabled:opacity-50 transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy || !email}
                className="flex-1 h-11 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[15px] font-semibold disabled:opacity-40 active:bg-[var(--accent-pressed)] transition"
              >
                {busy ? "Создаём…" : "Создать"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
