"use client";

// Sprint 033 Phase I32 — Master Info mega-page.
//
// Per user decision on v278: «всю учётку + информацию + контакты
// объединяем в одну страницу». One long scroll, grouped into iOS
// Settings sections:
//   · Основное:      имя, день рождения
//   · Контакты:      телефон, WhatsApp, Telegram, email, адрес,
//                    экстренный контакт
//   · Учётка Babun:  login email, статус, последний вход, кнопка
//                    выдать/сбросить пароль
//
// Brigade membership lives on the hub now (read-only plashki)
// — edits happen on the brigade side («Команда»).
//
// Instant commit on blur for existing records; new-master flow shows
// a top-right "Создать" pill that persists the draft and jumps to
// the detail hub so the user can fill the remaining sections.

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Paperclip,
  Plus,
  RefreshCw,
  Trash2,
  UserMinus,
} from "@babun/shared/icons";
import { haptic } from "@/lib/haptics";
import { useMasters } from "@/components/layout/DashboardClientLayout";
import {
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_TONE,
  INCIDENT_LABELS,
  INCIDENT_TONE,
  appendAudit,
  defaultPermissionsForRole,
  generateId,
  generatePassword,
  getInitials,
  type AccountStatus,
  type IncidentCategory,
  type Master,
  type MasterDocument,
  type MasterIncident,
} from "@babun/shared/local/masters";
import MasterSectionShell from "@/components/masters/MasterSectionShell";
import AvatarPickerSheet from "@/components/masters/AvatarPickerSheet";
import IOSSwitch from "@/components/ui/IOSSwitch";
import { isAvatarSet } from "@babun/shared/local/selectors/avatars";

const BLANK_MASTER: Master = {
  id: "",
  full_name: "",
  phone: "",
  team_id: null,
  role: "helper",
  is_active: true,
  permissions: defaultPermissionsForRole("helper"),
  created_at: "",
};

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default function MasterInfoPage({ params }: RouteParams) {
  const { id } = use(params);
  const isNew = id === "new";
  const router = useRouter();
  const { masters, upsertMaster } = useMasters();

  const existing = masters.find((m) => m.id === id);
  const initial: Master = isNew
    ? {
        ...BLANK_MASTER,
        id: generateId("master"),
        created_at: new Date().toISOString(),
      }
    : existing ?? BLANK_MASTER;

  // Identity
  const [fullName, setFullName] = useState(initial.full_name);
  const [title, setTitle] = useState(initial.title ?? "");
  const [birthday, setBirthday] = useState(initial.birthday ?? "");
  const [hireDate, setHireDate] = useState(initial.hire_date ?? "");

  // Bank / tax (moved from salary in v307)
  const [iban, setIban] = useState(initial.iban ?? "");
  const [bankName, setBankName] = useState(initial.bank_name ?? "");
  const [taxNumber, setTaxNumber] = useState(initial.tax_number ?? "");

  // Contacts
  const [phone, setPhone] = useState(initial.phone);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp ?? "");
  const [telegram, setTelegram] = useState(initial.telegram ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [address, setAddress] = useState(initial.address ?? "");

  // Babun account
  const [loginEmail, setLoginEmail] = useState(
    initial.login_email ?? initial.email ?? "",
  );
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Documents row editor + avatar picker + incident editor
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [newIncidentOpen, setNewIncidentOpen] = useState(false);

  useEffect(() => {
    // Reset every form field when `existing` flips (different master
    // picked, or the live tenant-sync brings in a fresh copy of the
    // record). React-Compiler flags each setter as a cascading
    // render, but they batch into a single re-render — the cost is
    // O(1) renders per existing-change, not O(N). The proper fix is
    // a useReducer with an `existing → formState` derive, but that's
    // a larger refactor; suppress here with the «why» so the next
    // touch knows it's deliberate.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!isNew && existing) {
      setFullName(existing.full_name);
      setTitle(existing.title ?? "");
      setBirthday(existing.birthday ?? "");
      setHireDate(existing.hire_date ?? "");
      setPhone(existing.phone);
      setWhatsapp(existing.whatsapp ?? "");
      setTelegram(existing.telegram ?? "");
      setEmail(existing.email ?? "");
      setAddress(existing.address ?? "");
      setIban(existing.iban ?? "");
      setBankName(existing.bank_name ?? "");
      setTaxNumber(existing.tax_number ?? "");
      setLoginEmail(existing.login_email ?? existing.email ?? "");
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [existing, isNew]);

  if (!isNew && !existing) {
    return (
      <MasterSectionShell masterId={id} title="Информация" hideSave>
        <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-4 py-6 text-center text-[13px] text-[var(--label-tertiary)]">
          Сотрудник не найден.
        </div>
      </MasterSectionShell>
    );
  }

  // ── Instant commit helpers (existing master only) ────────────────
  const patch = (diff: Partial<Master>) => {
    if (!existing) return;
    upsertMaster({ ...existing, ...diff });
  };

  const commitStr = (field: keyof Master, next: string, optional = false) => {
    if (!existing) return;
    const trimmed = next.trim();
    const current = (existing[field] as string | undefined) ?? "";
    if (trimmed === current) return;
    // Audit log the change for fields we care about — name/title
    // changes are business-relevant; contact-field nibbling isn't.
    const LOGGED: Partial<Record<keyof Master, true>> = {
      full_name: true,
      title: true,
    };
    let nextMaster: Master = {
      ...existing,
      [field]: optional ? trimmed || undefined : trimmed,
    } as Master;
    if (LOGGED[field]) {
      nextMaster = appendAudit(nextMaster, {
        action: field === "title" ? "title_changed" : "other",
        summary:
          field === "full_name"
            ? `Имя: «${current}» → «${trimmed}»`
            : field === "title"
              ? `Должность: «${current || "—"}» → «${trimmed || "—"}»`
              : `${String(field)} изменено`,
      });
    }
    upsertMaster(nextMaster);
  };

  // ── Babun account actions ────────────────────────────────────────
  const issueCredentials = () => {
    if (!existing) return;
    if (!loginEmail.trim()) {
      haptic("warning");
      return;
    }
    const pwd = generatePassword();
    setGeneratedPassword(pwd);
    setShowPassword(true);
    haptic("tap");
    const wasSet = existing.credentials_set ?? false;
    const nextStatus: AccountStatus = "invited";
    const nextMaster = appendAudit(
      {
        ...existing,
        login_email: loginEmail.trim(),
        credentials_set: true,
        invite_sent_at: new Date().toISOString(),
        account_status: nextStatus,
      },
      {
        action: wasSet ? "credentials_reset" : "credentials_issued",
        summary: wasSet
          ? `Пароль сброшен · ${loginEmail.trim()}`
          : `Выдан доступ · ${loginEmail.trim()}`,
      },
    );
    upsertMaster(nextMaster);
  };

  const revokeCredentials = () => {
    if (!existing) return;
    haptic("warning");
    setGeneratedPassword(null);
    const nextMaster = appendAudit(
      {
        ...existing,
        credentials_set: false,
        account_status: "terminated",
        terminated_at: new Date().toISOString().slice(0, 10),
      },
      {
        action: "credentials_revoked",
        summary: "Доступ отозван",
      },
    );
    upsertMaster(nextMaster);
  };

  const copyPassword = async () => {
    if (!generatedPassword) return;
    try {
      await navigator.clipboard.writeText(generatedPassword);
      haptic("tap");
    } catch {
      // Clipboard may be blocked; user can select text manually.
    }
  };

  // ── Documents ────────────────────────────────────────────────────
  const addDoc = (doc: MasterDocument) => {
    if (!existing) return;
    const current = existing.documents ?? [];
    upsertMaster({ ...existing, documents: [...current, doc] });
    setNewDocOpen(false);
  };
  const updateDoc = (doc: MasterDocument) => {
    if (!existing) return;
    const current = existing.documents ?? [];
    upsertMaster({
      ...existing,
      documents: current.map((d) => (d.id === doc.id ? doc : d)),
    });
  };
  const removeDoc = (docId: string) => {
    if (!existing) return;
    const current = existing.documents ?? [];
    haptic("tap");
    upsertMaster({
      ...existing,
      documents: current.filter((d) => d.id !== docId),
    });
  };

  // ── Incidents (HR journal) ───────────────────────────────────────
  const addIncident = (ev: MasterIncident) => {
    if (!existing) return;
    haptic("tap");
    const current = existing.incidents ?? [];
    upsertMaster({ ...existing, incidents: [...current, ev] });
    setNewIncidentOpen(false);
  };
  const removeIncident = (idToRemove: string) => {
    if (!existing) return;
    haptic("warning");
    const current = existing.incidents ?? [];
    upsertMaster({
      ...existing,
      incidents: current.filter((ev) => ev.id !== idToRemove),
    });
  };

  // ── New-master create flow ───────────────────────────────────────
  const handleCreate = (): boolean => {
    if (!fullName.trim()) {
      haptic("warning");
      return false;
    }
    haptic("tap");
    upsertMaster({
      ...initial,
      full_name: fullName.trim(),
      title: title.trim() || undefined,
      phone: phone.trim(),
      birthday: birthday || undefined,
      hire_date: hireDate || undefined,
      whatsapp: whatsapp.trim() || undefined,
      telegram: telegram.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      login_email: loginEmail.trim() || undefined,
    });
    router.push(`/dashboard/masters/${initial.id}`);
    return false;
  };

  const sharedShellProps = isNew
    ? {
        saveLabel: "Создать",
        canSave: fullName.trim().length > 0,
        onSave: handleCreate,
      }
    : { hideSave: true };

  const avatarInitials = getInitials(fullName || "?");
  const accountStatus: AccountStatus | undefined = existing?.account_status;
  const lastLogin = existing?.last_login_at
    ? new Date(existing.last_login_at).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;
  const inviteSent = existing?.invite_sent_at
    ? new Date(existing.invite_sent_at).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short",
      })
    : null;

  return (
    <MasterSectionShell
      masterId={id}
      title={isNew ? "Новый сотрудник" : "Информация"}
      {...sharedShellProps}
    >
      {/* Avatar — tap to open picker (14 presets + upload + remove).
          For a brand-new card (before Create) editing is disabled —
          the popup on the masters list already captured a photo. */}
      <div className="flex flex-col items-center pt-1 pb-2 gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (isNew) return;
            setAvatarPickerOpen(true);
          }}
          disabled={isNew}
          aria-label="Сменить фото"
          className="w-20 h-20 rounded-full overflow-hidden bg-[var(--fill-tertiary)] flex items-center justify-center active:scale-[0.98] transition disabled:active:scale-100"
        >
          {isAvatarSet(existing?.avatar_url) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={existing!.avatar_url!}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[26px] font-semibold text-[var(--label-secondary)]">
              {avatarInitials}
            </span>
          )}
        </button>
        <div className="text-[13px] text-[var(--label-tertiary)]">
          {isNew ? "Новая карточка" : "Нажмите, чтобы сменить фото"}
        </div>
      </div>

      {/* ── УЧЁТКА В BABUN ────────────────────────────────────────── */}
      {!isNew && (
        <Section
          title="Учётная запись в Babun"
          footer={
            existing?.credentials_set
              ? "Доступ выдан. Сбросьте пароль — старый перестанет работать."
              : "Выдайте сотруднику логин и пароль. Пароль показывается один раз — продиктуйте его по телефону или перешлите в Telegram."
          }
        >
          <TextRow
            label="Email входа"
            value={loginEmail}
            setValue={setLoginEmail}
            onCommit={(v) => commitStr("login_email", v, true)}
            placeholder="login@example.com"
            type="email"
            maxLength={120}
          />
          {accountStatus && (
            <div className="flex items-center justify-between gap-3 min-h-[44px] px-4 border-t border-[var(--separator)]">
              <span className="text-[15px] text-[var(--label)]">Статус</span>
              <span
                className={`text-[12px] font-semibold px-2 py-0.5 rounded-full border ${ACCOUNT_STATUS_TONE[accountStatus]}`}
              >
                {ACCOUNT_STATUS_LABELS[accountStatus]}
              </span>
            </div>
          )}
          {lastLogin && (
            <div className="flex items-center justify-between gap-3 min-h-[44px] px-4 border-t border-[var(--separator)]">
              <span className="text-[15px] text-[var(--label)]">Последний вход</span>
              <span className="text-[14px] text-[var(--label-secondary)] tabular-nums">
                {lastLogin}
              </span>
            </div>
          )}
          {inviteSent && !lastLogin && (
            <div className="flex items-center justify-between gap-3 min-h-[44px] px-4 border-t border-[var(--separator)]">
              <span className="text-[15px] text-[var(--label)]">Приглашён</span>
              <span className="text-[14px] text-[var(--label-secondary)] tabular-nums">
                {inviteSent}
              </span>
            </div>
          )}

          {generatedPassword && (
            <div className="px-4 py-3 border-t border-[var(--separator)] bg-[var(--accent-tint)]">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-[var(--accent)] mb-1.5">
                Пароль — покажется один раз
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`flex-1 text-[15px] font-mono tracking-wide text-[var(--label)] tabular-nums truncate ${
                    showPassword ? "" : "blur-sm select-none"
                  }`}
                >
                  {generatedPassword}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Скрыть" : "Показать"}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-card)] text-[var(--label-secondary)] press-scale"
                >
                  {showPassword ? (
                    <EyeOff size={14} strokeWidth={2} />
                  ) : (
                    <Eye size={14} strokeWidth={2} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={copyPassword}
                  aria-label="Скопировать"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--surface-card)] text-[var(--label-secondary)] press-scale"
                >
                  <Copy size={14} strokeWidth={2} />
                </button>
              </div>
            </div>
          )}

          <div className="px-4 py-3 border-t border-[var(--separator)] flex flex-col gap-2">
            <button
              type="button"
              onClick={issueCredentials}
              disabled={!loginEmail.trim()}
              className="w-full h-11 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] flex items-center justify-center gap-2"
            >
              {existing?.credentials_set ? (
                <>
                  <RefreshCw size={15} strokeWidth={2.5} />
                  Сбросить пароль
                </>
              ) : (
                <>
                  <KeyRound size={15} strokeWidth={2.5} />
                  Выдать доступ
                </>
              )}
            </button>
            {existing?.credentials_set && (
              <button
                type="button"
                onClick={revokeCredentials}
                className="w-full h-11 rounded-full bg-[var(--fill-tertiary)] text-[var(--system-red)] text-[14px] font-medium press-scale flex items-center justify-center gap-2"
              >
                <UserMinus size={15} strokeWidth={2.5} />
                Забрать доступ
              </button>
            )}
          </div>
        </Section>
      )}

      {/* ── ОСНОВНОЕ ──────────────────────────────────────────────── */}
      <Section
        title="Основное"
        footer="Должность — свободное описание роли внутри компании. На права в Babun не влияет (за права отвечает раздел «Доступы»)."
      >
        <TextRow
          label="Имя"
          value={fullName}
          setValue={setFullName}
          onCommit={(v) => commitStr("full_name", v)}
          placeholder="Имя Фамилия"
          maxLength={60}
          required
        />
        <TextRow
          label="Должность"
          value={title}
          setValue={setTitle}
          onCommit={(v) => commitStr("title", v, true)}
          placeholder="Напр. «Старший техник»"
          maxLength={80}
        />
        <DateRow
          label="День рождения"
          value={birthday}
          setValue={setBirthday}
          onCommit={(v) => {
            if (!existing) return;
            if (v === (existing.birthday ?? "")) return;
            patch({ birthday: v || undefined });
          }}
        />
        <DateRow
          label="Дата найма"
          value={hireDate}
          setValue={setHireDate}
          onCommit={(v) => {
            if (!existing) return;
            if (v === (existing.hire_date ?? "")) return;
            patch({ hire_date: v || undefined });
          }}
          last
        />
      </Section>

      {/* ── КОНТАКТЫ ──────────────────────────────────────────────── */}
      <Section title="Контакты" footer="Как с сотрудником связаться вне Babun">
        <TextRow
          label="Телефон"
          value={phone}
          setValue={setPhone}
          onCommit={(v) => commitStr("phone", v)}
          placeholder="+357 …"
          type="tel"
          maxLength={32}
        />
        <TextRow
          label="WhatsApp"
          value={whatsapp}
          setValue={setWhatsapp}
          onCommit={(v) => commitStr("whatsapp", v, true)}
          placeholder="если отличается"
          type="tel"
          maxLength={32}
        />
        <TextRow
          label="Telegram"
          value={telegram}
          setValue={setTelegram}
          onCommit={(v) => commitStr("telegram", v, true)}
          placeholder="@username"
          maxLength={32}
        />
        <TextRow
          label="Email"
          value={email}
          setValue={setEmail}
          onCommit={(v) => commitStr("email", v, true)}
          placeholder="personal@example.com"
          type="email"
          maxLength={120}
        />
        <TextRow
          label="Адрес"
          value={address}
          setValue={setAddress}
          onCommit={(v) => commitStr("address", v, true)}
          placeholder="Пафос, улица…"
          maxLength={120}
          last
        />
      </Section>

      {/* ── БАНК И РЕКВИЗИТЫ ─────────────────────────────────────── */}
      {!isNew && existing && (
        <Section
          title="Банк и реквизиты"
          footer="Хранятся на сотруднике. «Резидент Кипра» влияет на VAT 19% при расчёте ЗП."
        >
          <TextRow
            label="IBAN"
            value={iban}
            setValue={setIban}
            onCommit={(v) => {
              if (!existing) return;
              const trimmed = v.trim();
              if (trimmed === (existing.iban ?? "")) return;
              patch({ iban: trimmed || undefined });
            }}
            placeholder="CY__ ____ ____ ____"
            maxLength={60}
          />
          <TextRow
            label="Банк"
            value={bankName}
            setValue={setBankName}
            onCommit={(v) => {
              if (!existing) return;
              const trimmed = v.trim();
              if (trimmed === (existing.bank_name ?? "")) return;
              patch({ bank_name: trimmed || undefined });
            }}
            placeholder="Bank of Cyprus / Revolut / …"
            maxLength={80}
          />
          <TextRow
            label="TIN / АФМ"
            value={taxNumber}
            setValue={setTaxNumber}
            onCommit={(v) => {
              if (!existing) return;
              const trimmed = v.trim();
              if (trimmed === (existing.tax_number ?? "")) return;
              patch({ tax_number: trimmed || undefined });
            }}
            placeholder="Налоговый номер"
            maxLength={40}
          />
          <div className="flex items-center gap-3 min-h-[48px] px-4 border-t border-[var(--separator)]">
            <span className="text-[15px] text-[var(--label)] flex-1">
              Резидент Кипра
            </span>
            <span className="text-[12px] text-[var(--label-tertiary)]">
              {existing.tax_resident ? "VAT 19%" : "не применять"}
            </span>
            <IOSSwitch
              checked={existing.tax_resident ?? false}
              onChange={(next) => patch({ tax_resident: next })}
              ariaLabel="Резидент Кипра"
            />
          </div>
        </Section>
      )}

      {/* ── ДОКУМЕНТЫ ─────────────────────────────────────────────── */}
      {!isNew && existing && (
        <Section
          title="Документы"
          footer="Прикрепить скан можно будет когда подключим облако (Supabase Storage). Сейчас хранится имя файла и мета."
        >
          {(existing.documents ?? []).length === 0 && !newDocOpen && (
            <div className="px-4 py-3 text-[13px] text-[var(--label-tertiary)]">
              Пока не загружено.
            </div>
          )}
          {(existing.documents ?? []).map((d, i) => (
            <DocRow
              key={d.id}
              doc={d}
              onChange={updateDoc}
              onRemove={() => removeDoc(d.id)}
              last={
                i === (existing.documents ?? []).length - 1 && !newDocOpen
              }
            />
          ))}
          {newDocOpen && (
            <DocEditor
              onSubmit={addDoc}
              onCancel={() => setNewDocOpen(false)}
            />
          )}
          {!newDocOpen && (
            <button
              type="button"
              onClick={() => setNewDocOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left active:bg-[var(--fill-quaternary)] transition border-t border-[var(--separator)]"
            >
              <span className="w-7 h-7 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <Plus size={15} strokeWidth={2.5} />
              </span>
              <span className="text-[14px] font-medium text-[var(--accent)]">
                Добавить документ
              </span>
            </button>
          )}
        </Section>
      )}

      {/* ── ЖУРНАЛ ЗАМЕЧАНИЙ ─────────────────────────────────────── */}
      {!isNew && existing && (
        <Section
          title="Журнал замечаний"
          footer="Опоздания, жалобы, предупреждения, благодарности. Накапливаются с датой — при увольнении или премировании всё под рукой."
        >
          {(existing.incidents ?? []).length === 0 && !newIncidentOpen && (
            <div className="px-4 py-3 text-[13px] text-[var(--label-tertiary)]">
              Пока пусто.
            </div>
          )}
          {(existing.incidents ?? [])
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((ev, i, arr) => (
              <IncidentRow
                key={ev.id}
                ev={ev}
                onRemove={() => removeIncident(ev.id)}
                last={i === arr.length - 1 && !newIncidentOpen}
              />
            ))}
          {newIncidentOpen && (
            <IncidentEditor
              onSubmit={addIncident}
              onCancel={() => setNewIncidentOpen(false)}
            />
          )}
          {!newIncidentOpen && (
            <button
              type="button"
              onClick={() => setNewIncidentOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left active:bg-[var(--fill-quaternary)] transition border-t border-[var(--separator)]"
            >
              <span className="w-7 h-7 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <Plus size={15} strokeWidth={2.5} />
              </span>
              <span className="text-[14px] font-medium text-[var(--accent)]">
                Добавить запись
              </span>
            </button>
          )}
        </Section>
      )}

      {/* ── ИСТОРИЯ ВХОДОВ ────────────────────────────────────────── */}
      {!isNew && existing && (
        <Section
          title="История входов"
          footer="Когда подключим Supabase Auth, сюда посыпятся реальные записи — время, устройство, IP."
        >
          {(existing.login_history ?? []).length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-[var(--label-tertiary)]">
              Пока нет входов.
            </div>
          ) : (
            (existing.login_history ?? [])
              .slice()
              .reverse()
              .slice(0, 10)
              .map((ev, i, arr) => (
                <div
                  key={`${ev.timestamp}-${i}`}
                  className={`flex items-center gap-3 px-4 min-h-[44px] ${
                    i === arr.length - 1 ? "" : "border-b border-[var(--separator)]"
                  }`}
                >
                  <span className="text-[13px] text-[var(--label)] flex-1 tabular-nums">
                    {formatEventTime(ev.timestamp)}
                  </span>
                  <span className="text-[12px] text-[var(--label-tertiary)] truncate max-w-[50%]">
                    {ev.user_agent ?? ev.ip ?? "—"}
                  </span>
                </div>
              ))
          )}
        </Section>
      )}

      {/* ── ЖУРНАЛ ИЗМЕНЕНИЙ ─────────────────────────────────────── */}
      {!isNew && existing && (
        <Section
          title="Журнал изменений"
          footer="Кто и когда правил карточку. Показаны последние 20 записей."
        >
          {(existing.audit ?? []).length === 0 ? (
            <div className="px-4 py-3 text-[13px] text-[var(--label-tertiary)]">
              Пока пусто.
            </div>
          ) : (
            (existing.audit ?? [])
              .slice()
              .reverse()
              .slice(0, 20)
              .map((ev, i, arr) => (
                <div
                  key={ev.id}
                  className={`flex items-start gap-3 px-4 py-2 min-h-[44px] ${
                    i === arr.length - 1 ? "" : "border-b border-[var(--separator)]"
                  }`}
                >
                  <span className="text-[11px] text-[var(--label-tertiary)] w-[72px] shrink-0 tabular-nums mt-0.5">
                    {formatEventTime(ev.timestamp)}
                  </span>
                  <span className="text-[13px] text-[var(--label)] flex-1 leading-snug">
                    {ev.summary}
                  </span>
                </div>
              ))
          )}
        </Section>
      )}

      <AvatarPickerSheet
        open={avatarPickerOpen}
        value={existing?.avatar_url ?? null}
        onSelect={(next) => patch({ avatar_url: next })}
        onClose={() => setAvatarPickerOpen(false)}
      />
    </MasterSectionShell>
  );
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Document row + editor ────────────────────────────────────────

function DocRow({
  doc,
  onChange,
  onRemove,
  last,
}: {
  doc: MasterDocument;
  onChange: (d: MasterDocument) => void;
  onRemove: () => void;
  last?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expires = doc.expires_at ? new Date(doc.expires_at) : null;
  const now = new Date();
  const isExpired = expires && expires < now;
  const isSoon =
    expires &&
    !isExpired &&
    expires.getTime() - now.getTime() < 1000 * 60 * 60 * 24 * 30;
  return (
    <div
      className={`${last ? "" : "border-b border-[var(--separator)]"}`}
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left active:bg-[var(--fill-quaternary)] transition"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-medium text-[var(--label)] truncate">
            {doc.kind || "Документ"}
          </span>
          <span className="block text-[12px] text-[var(--label-tertiary)] truncate">
            {doc.value || "номер не указан"}
            {doc.file_name ? ` · 📎 ${doc.file_name}` : ""}
          </span>
        </span>
        {(isExpired || isSoon) && (
          <span
            className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              isExpired
                ? "bg-[rgba(255,59,48,0.1)] text-[var(--system-red)]"
                : "bg-[rgba(255,149,0,0.1)] text-[var(--system-orange)]"
            }`}
          >
            {isExpired ? "истёк" : "скоро"}
          </span>
        )}
      </button>
      {open && (
        <DocEditor
          initial={doc}
          onSubmit={(d) => {
            onChange(d);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
          onRemove={() => {
            onRemove();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Incident row + editor ────────────────────────────────────────

function IncidentRow({
  ev,
  onRemove,
  last,
}: {
  ev: MasterIncident;
  onRemove: () => void;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 min-h-[48px] ${
        last ? "" : "border-b border-[var(--separator)]"
      }`}
    >
      <span
        className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${INCIDENT_TONE[ev.category]}`}
      >
        {INCIDENT_LABELS[ev.category]}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[var(--label-tertiary)] tabular-nums">
          {formatIncidentDate(ev.date)}
        </div>
        <div className="text-[13px] text-[var(--label)] leading-snug mt-0.5 whitespace-pre-wrap">
          {ev.text}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)] shrink-0"
        aria-label="Удалить запись"
      >
        <Trash2 size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

function IncidentEditor({
  onSubmit,
  onCancel,
}: {
  onSubmit: (ev: MasterIncident) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<IncidentCategory>("late");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [text, setText] = useState("");

  const categories: IncidentCategory[] = [
    "late",
    "complaint",
    "warning",
    "kudos",
    "other",
  ];

  const save = () => {
    if (!text.trim()) return;
    onSubmit({
      id: generateId("inc"),
      date,
      category,
      text: text.trim(),
      created_at: new Date().toISOString(),
    });
  };

  return (
    <div className="px-4 py-3 border-t border-[var(--separator)] bg-[var(--fill-tertiary)] space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`px-2.5 h-7 rounded-full text-[11px] font-semibold transition active:scale-[0.97] ${
                active
                  ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                  : "bg-[var(--surface-card)] text-[var(--label)]"
              }`}
            >
              {INCIDENT_LABELS[c]}
            </button>
          );
        })}
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full h-10 px-3 rounded-[10px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] focus:outline-none tabular-nums"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Что произошло…"
        rows={2}
        maxLength={400}
        className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none leading-snug"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!text.trim()}
          className="flex-1 h-10 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
        >
          Добавить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 rounded-full bg-[var(--fill-primary)] text-[var(--label)] text-[14px] press-scale"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

function formatIncidentDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DocEditor({
  initial,
  onSubmit,
  onCancel,
  onRemove,
}: {
  initial?: MasterDocument;
  onSubmit: (d: MasterDocument) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [kind, setKind] = useState(initial?.kind ?? "");
  const [value, setValue] = useState(initial?.value ?? "");
  const [expiresAt, setExpiresAt] = useState(initial?.expires_at ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [fileName, setFileName] = useState(initial?.file_name);
  const [fileSize, setFileSize] = useState(initial?.file_size);

  const save = () => {
    if (!kind.trim()) return;
    onSubmit({
      id: initial?.id ?? generateId("doc"),
      kind: kind.trim(),
      value: value.trim(),
      expires_at: expiresAt || undefined,
      note: note.trim() || undefined,
      file_name: fileName,
      file_size: fileSize,
    });
  };

  return (
    <div className="px-4 py-3 bg-[var(--fill-tertiary)] border-t border-[var(--separator)] space-y-2">
      <input
        type="text"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        placeholder="Тип · Паспорт / Права / Work permit"
        className="w-full h-10 px-3 rounded-[10px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
        maxLength={60}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Номер / серия"
        className="w-full h-10 px-3 rounded-[10px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
        maxLength={80}
      />
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-[var(--label-secondary)] shrink-0">
          Срок
        </span>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="flex-1 h-10 px-3 rounded-[10px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] focus:outline-none tabular-nums"
        />
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Заметка (опционально)"
        rows={2}
        maxLength={200}
        className="w-full px-3 py-2 rounded-[10px] bg-[var(--surface-card)] text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none resize-none"
      />
      <label className="flex items-center gap-2 h-10 px-3 rounded-[10px] bg-[var(--surface-card)] cursor-pointer">
        <Paperclip size={14} className="text-[var(--label-secondary)]" />
        <span className="text-[13px] text-[var(--label-secondary)] flex-1 truncate">
          {fileName ? fileName : "Прикрепить скан (имя файла запомнится)"}
        </span>
        {fileName && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setFileName(undefined);
              setFileSize(undefined);
            }}
            className="text-[12px] text-[var(--system-red)]"
          >
            убрать
          </button>
        )}
        <input
          type="file"
          className="hidden"
          accept="image/*,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFileName(f.name);
            setFileSize(f.size);
          }}
        />
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={!kind.trim()}
          className="flex-1 h-10 rounded-full bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold press-scale disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)]"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 px-4 rounded-full bg-[var(--fill-primary)] text-[var(--label)] text-[14px] press-scale"
        >
          Отмена
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="h-10 w-10 rounded-full bg-[var(--fill-primary)] text-[var(--system-red)] flex items-center justify-center press-scale"
            aria-label="Удалить"
          >
            <Trash2 size={15} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Section wrapper ────────────────────────────────────────────────

function Section({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-4 pb-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-[var(--label-secondary)]">
        {title}
      </div>
      <div className="bg-[var(--surface-card)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
        {children}
      </div>
      {footer && (
        <div className="px-4 pt-2 text-[12px] text-[var(--label-tertiary)] leading-snug">
          {footer}
        </div>
      )}
    </div>
  );
}

// ─── Row primitives (iOS Settings look) ────────────────────────────

function TextRow({
  label,
  value,
  setValue,
  onCommit,
  placeholder,
  maxLength,
  type = "text",
  required,
  last,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  onCommit: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  type?: "text" | "tel" | "email";
  required?: boolean;
  last?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 min-h-[44px] px-4 ${
        last ? "" : "border-b border-[var(--separator)]"
      }`}
    >
      <span className="text-[15px] text-[var(--label)] w-[120px] shrink-0">
        {label}
        {required && <span className="text-[var(--system-red)]"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="flex-1 bg-transparent text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] text-right focus:outline-none"
      />
    </label>
  );
}

function DateRow({
  label,
  value,
  setValue,
  onCommit,
  last,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  onCommit: (v: string) => void;
  last?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-3 min-h-[44px] px-4 ${
        last ? "" : "border-b border-[var(--separator)]"
      }`}
    >
      <span className="text-[15px] text-[var(--label)] w-[120px] shrink-0">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
        className="flex-1 bg-transparent text-[15px] text-[var(--label)] text-right focus:outline-none tabular-nums"
      />
    </label>
  );
}
