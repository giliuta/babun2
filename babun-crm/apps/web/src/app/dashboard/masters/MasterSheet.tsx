"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Trash2,
  X,
} from "lucide-react";
import {
  CONTRACT_LABELS,
  PAYMENT_METHOD_LABELS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  SALARY_MODEL_HINTS,
  SALARY_MODEL_LABELS,
  SALARY_PERIOD_LABELS,
  SALARY_UNIT,
  WEEKDAY_LABELS,
  defaultNotificationPrefs,
  defaultPermissionsForRole,
  defaultWorkSchedule,
  generateId,
  generatePassword,
  mergePermissions,
  type ContractType,
  type Master,
  type MasterDocument,
  type MasterPermissions,
  type MasterRole,
  type MasterSalary,
  type NotificationPrefs,
  type PaymentMethod,
  type SalaryModel,
  type SalaryPeriod,
  type Team,
  type WorkSchedule,
} from "@babun/shared/local/masters";

// TODO(decomp): 600+ lines single-file. Acceptable for one cohesive
// multi-section sheet; split into sub-sections if it grows past 800.

type Section = "account" | "personal" | "job" | "salary" | "permissions" | "documents" | "notes";
type BrigadeVisibility = "own" | "picked" | "all";

interface MasterSheetProps {
  master: Master | null;
  teams: Team[];
  onCancel: () => void;
  onSave: (master: Master) => void;
  onDelete: (master: Master) => void;
}

// Sprint 027: expanded employee profile for a real SaaS onboarding.
// Seven collapsible sections — "Аккаунт в Babun" is the new first
// section and covers login creds + account lifecycle status so the
// CEO can hand a brigade lead a ready-made account in one pass.
export default function MasterSheet({
  master,
  teams,
  onCancel,
  onSave,
  onDelete,
}: MasterSheetProps) {
  const isEditing = !!master;

  // Account
  const [loginEmail, setLoginEmail] = useState(master?.login_email ?? master?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordToShowAfterSave, setPasswordToShowAfterSave] = useState<string | null>(
    null
  );

  // Personal
  const [fullName, setFullName] = useState(master?.full_name ?? "");
  const [phone, setPhone] = useState(master?.phone ?? "");
  const [email, setEmail] = useState(master?.email ?? "");
  const [whatsapp, setWhatsapp] = useState(master?.whatsapp ?? "");
  const [telegram, setTelegram] = useState(master?.telegram ?? "");
  const [birthday, setBirthday] = useState(master?.birthday ?? "");
  const [address, setAddress] = useState(master?.address ?? "");

  // Job
  const [teamId, setTeamId] = useState<string | null>(master?.team_id ?? null);
  const [role, setRole] = useState<MasterRole>(master?.role ?? "helper");
  const [contractType, setContractType] = useState<ContractType>(
    master?.contract_type ?? "full_time"
  );
  const [hireDate, setHireDate] = useState(master?.hire_date ?? "");
  const [emergencyContact, setEmergencyContact] = useState(
    master?.emergency_contact ?? ""
  );
  const [isActive, setIsActive] = useState(master?.is_active ?? true);
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule>(
    master?.work_schedule ?? defaultWorkSchedule()
  );

  // Salary
  const initialSalary = master?.salary;
  const [salaryModel, setSalaryModel] = useState<SalaryModel>(
    initialSalary?.model ?? "percent_of_team"
  );
  const [salaryValue, setSalaryValue] = useState<number>(initialSalary?.value ?? 0);
  const [hybridPercent, setHybridPercent] = useState<number>(
    initialSalary?.hybrid_percent ?? 0
  );
  const [fixedBonus, setFixedBonus] = useState<number>(initialSalary?.fixed_bonus ?? 0);
  const [deduction, setDeduction] = useState<number>(initialSalary?.deduction ?? 0);
  const [salaryPeriod, setSalaryPeriod] = useState<SalaryPeriod>(
    initialSalary?.period ?? "monthly"
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initialSalary?.method ?? "cash"
  );
  const [salaryNote, setSalaryNote] = useState(initialSalary?.note ?? "");

  // Permissions
  const [permissions, setPermissions] = useState<MasterPermissions>(
    master ? mergePermissions(master.role, master.permissions) : defaultPermissionsForRole("helper")
  );
  const [brigadeVisibility, setBrigadeVisibility] = useState<BrigadeVisibility>(() => {
    const v = master?.permissions?.visible_team_ids;
    if (!v || v.length === 0) return "own";
    if (v.includes("*")) return "all";
    return "picked";
  });

  // Notifications
  const [notifications, setNotifications] = useState<NotificationPrefs>(
    master?.notifications ?? defaultNotificationPrefs()
  );

  // Documents & notes
  const [documents, setDocuments] = useState<MasterDocument[]>(master?.documents ?? []);
  const [notes, setNotes] = useState(master?.notes ?? "");

  // Open state for the accordion. In create mode the first three
  // sections are open by default; in edit mode only "Аккаунт" is open
  // so we don't avalanche a long form on the CEO.
  const [open, setOpen] = useState<Record<Section, boolean>>(
    isEditing
      ? {
          account: true,
          personal: false,
          job: false,
          salary: false,
          permissions: false,
          documents: false,
          notes: false,
        }
      : {
          account: true,
          personal: true,
          job: true,
          salary: false,
          permissions: false,
          documents: false,
          notes: false,
        }
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Keep loginEmail synced with personal email on create if the user
  // hasn't typed a custom login yet.
  useEffect(() => {
    if (!isEditing && !loginEmail && email) setLoginEmail(email);
  }, [isEditing, email, loginEmail]);

  const handleRoleChange = (nextRole: MasterRole) => {
    setRole(nextRole);
    const nextDefaults = defaultPermissionsForRole(nextRole);
    setPermissions(nextDefaults);
    // Default visibility for the new role.
    if (nextDefaults.visible_team_ids.includes("*")) setBrigadeVisibility("all");
    else setBrigadeVisibility("own");
  };

  const togglePermission = (key: keyof Omit<MasterPermissions, "visible_team_ids">) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleBrigadeVisible = (tid: string) => {
    setPermissions((prev) => {
      const has = prev.visible_team_ids.includes(tid);
      return {
        ...prev,
        visible_team_ids: has
          ? prev.visible_team_ids.filter((id) => id !== tid)
          : [...prev.visible_team_ids.filter((id) => id !== "*"), tid],
      };
    });
  };

  const handleGeneratePassword = () => {
    const pwd = generatePassword();
    setPassword(pwd);
    setShowPassword(true);
  };

  const toggleWorkDay = (idx: number) => {
    setWorkSchedule((prev) => {
      const next = [...prev.days] as WorkSchedule["days"];
      next[idx] = !next[idx];
      return { ...prev, days: next };
    });
  };

  const handleSubmit = () => {
    if (!fullName.trim()) {
      window.alert("Введите ФИО сотрудника");
      return;
    }
    // Normalise brigade visibility into permissions before save.
    const normalisedPermissions: MasterPermissions = (() => {
      if (brigadeVisibility === "all") {
        return { ...permissions, visible_team_ids: ["*"] };
      }
      if (brigadeVisibility === "own") {
        return { ...permissions, visible_team_ids: [] };
      }
      return { ...permissions, visible_team_ids: permissions.visible_team_ids.filter((id) => id !== "*") };
    })();

    const salary: MasterSalary = {
      model: salaryModel,
      value: Number.isFinite(salaryValue) ? salaryValue : 0,
      hybrid_percent: salaryModel === "hybrid" ? hybridPercent : undefined,
      fixed_bonus: fixedBonus || undefined,
      deduction: deduction || undefined,
      period: salaryPeriod,
      method: paymentMethod,
      note: salaryNote.trim() || undefined,
    };

    const nowIso = new Date().toISOString();
    const hadCredsBefore = master?.credentials_set ?? false;
    const hasNewPassword = password.trim().length > 0;
    const credentialsSet = hadCredsBefore || hasNewPassword || Boolean(loginEmail);

    // Sprint 028: `account_status` was deprecated by CEO request; the
    // `is_active` toggle in "Работа" covers the only distinction that
    // actually matters for payroll and visibility. We still pass the
    // field through untouched for backward-compat with older records.
    const next: Master = {
      id: master?.id ?? generateId("m"),
      full_name: fullName.trim(),
      phone: phone.trim(),
      avatar_url: master?.avatar_url ?? null,
      team_id: teamId,
      role,
      is_active: isActive,
      permissions: normalisedPermissions,
      created_at: master?.created_at ?? nowIso,

      email: email.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      telegram: telegram.trim() || undefined,
      birthday: birthday || undefined,
      address: address.trim() || undefined,

      hire_date: hireDate || undefined,
      emergency_contact: emergencyContact.trim() || undefined,
      contract_type: contractType,
      work_schedule: workSchedule,

      salary,

      login_email: loginEmail.trim() || undefined,
      credentials_set: credentialsSet,
      invite_sent_at: hasNewPassword
        ? nowIso
        : master?.invite_sent_at,
      last_login_at: master?.last_login_at,
      account_status: master?.account_status,
      terminated_at: master?.terminated_at,

      notifications,

      documents: documents.filter((d) => d.value.trim() || d.kind.trim()),
      notes: notes.trim() || undefined,
    };

    // Show the password one-time dialog only if the CEO actually
    // generated / typed one on this pass. Reading it again later is
    // impossible by design.
    if (hasNewPassword) {
      setPasswordToShowAfterSave(password);
    }

    onSave(next);
  };

  const titleForHeader = isEditing
    ? fullName.trim() || "Сотрудник"
    : "Новый сотрудник";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-2"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] w-full max-w-lg flex flex-col"
        style={{ height: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-5 pt-5 pb-3 flex items-center justify-between gap-3 border-b border-[var(--separator)]">
          <h2 className="text-[17px] font-semibold text-[var(--label)] truncate tracking-tight">
            {titleForHeader}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Закрыть"
            className="w-8 h-8 rounded-full bg-[var(--fill-primary)] text-[var(--label-secondary)] active:bg-[var(--fill-secondary)] flex items-center justify-center flex-shrink-0 transition"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-3 bg-[var(--fill-tertiary)]">
          <AccordionSection
            title="Аккаунт в Babun"
            subtitle={
              master?.credentials_set
                ? loginEmail || "Логин задан"
                : "Логин и пароль для входа"
            }
            open={open.account}
            onToggle={() => setOpen((p) => ({ ...p, account: !p.account }))}
          >
            <Field label="Email для входа" required={!isEditing}>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="user@airfix.cy"
                className={inputCls}
                autoComplete="off"
              />
            </Field>
            <Field
              label={isEditing ? "Сменить пароль" : "Временный пароль"}
              hint={
                isEditing
                  ? "Задайте только если нужно сбросить. Старый пароль будет заменён."
                  : "Покажется один раз после сохранения — передайте сотруднику."
              }
            >
              <div className="flex items-center gap-2">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={`${inputCls} flex-1`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="h-10 w-10 flex items-center justify-center rounded-lg bg-[var(--fill-primary)] text-[var(--label-secondary)] active:bg-[var(--fill-secondary)] transition"
                  aria-label={showPassword ? "Скрыть" : "Показать"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="h-10 px-3.5 rounded-lg bg-[var(--accent)] text-[var(--label-on-accent)] text-[13px] font-semibold active:scale-[0.98] transition"
                >
                  Создать
                </button>
              </div>
            </Field>
            {isEditing && master?.last_login_at && (
              <div className="text-[12px] text-[var(--label-secondary)] px-1">
                Последний вход:{" "}
                {new Date(master.last_login_at).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            )}
          </AccordionSection>

          <AccordionSection
            title="Личные данные"
            subtitle="ФИО, контакты, день рождения"
            open={open.personal}
            onToggle={() => setOpen((p) => ({ ...p, personal: !p.personal }))}
          >
            <Field label="ФИО" required>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Телефон">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+357 99 XXXXXX"
                className={inputCls}
              />
            </Field>
            <Field label="Email" hint="Личный, для напоминаний">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="WhatsApp">
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Если отличается от телефона"
                className={inputCls}
              />
            </Field>
            <Field label="Telegram">
              <input
                type="text"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="@username"
                className={inputCls}
              />
            </Field>
            <Field label="День рождения">
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Адрес">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputCls}
              />
            </Field>
          </AccordionSection>

          <AccordionSection
            title="Работа"
            subtitle={`${ROLE_LABELS[role]} · ${teamId ? teams.find((t) => t.id === teamId)?.name ?? "бригада" : "без бригады"}`}
            open={open.job}
            onToggle={() => setOpen((p) => ({ ...p, job: !p.job }))}
          >
            <Field label="Бригада">
              <select
                value={teamId ?? ""}
                onChange={(e) => setTeamId(e.target.value || null)}
                className={inputCls}
              >
                <option value="">— Без бригады —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Роль" hint="Меняет пресет прав доступа">
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as MasterRole)}
                className={inputCls}
              >
                {(Object.keys(ROLE_LABELS) as MasterRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Тип договора">
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as ContractType)}
                className={inputCls}
              >
                {(Object.keys(CONTRACT_LABELS) as ContractType[]).map((c) => (
                  <option key={c} value={c}>
                    {CONTRACT_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Дата найма">
              <input
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Экстренный контакт">
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Кто, телефон, связь"
                className={inputCls}
              />
            </Field>
            <div>
              <div className="text-[12px] text-[var(--label-secondary)] mb-1">Рабочие дни</div>
              <div className="flex gap-1.5">
                {WEEKDAY_LABELS.map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleWorkDay(idx)}
                    className={`flex-1 h-9 rounded-lg text-[12px] font-semibold transition ${
                      workSchedule.days[idx]
                        ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
                        : "bg-[var(--fill-primary)] text-[var(--label-secondary)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Начало смены">
                <input
                  type="time"
                  value={workSchedule.start_time}
                  onChange={(e) =>
                    setWorkSchedule((p) => ({ ...p, start_time: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
              <Field label="Конец смены">
                <input
                  type="time"
                  value={workSchedule.end_time}
                  onChange={(e) =>
                    setWorkSchedule((p) => ({ ...p, end_time: e.target.value }))
                  }
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] text-[var(--label)]">Числится в компании</span>
              <ToggleSwitch checked={isActive} onChange={setIsActive} />
            </div>
          </AccordionSection>

          <AccordionSection
            title="Зарплата"
            subtitle={salarySubtitle(salaryModel, salaryValue, hybridPercent)}
            open={open.salary}
            onToggle={() => setOpen((p) => ({ ...p, salary: !p.salary }))}
          >
            <Field label="Модель">
              <select
                value={salaryModel}
                onChange={(e) => setSalaryModel(e.target.value as SalaryModel)}
                className={inputCls}
              >
                {(Object.keys(SALARY_MODEL_LABELS) as SalaryModel[]).map((m) => (
                  <option key={m} value={m}>
                    {SALARY_MODEL_LABELS[m]}
                  </option>
                ))}
              </select>
              <div className="text-[12px] text-[var(--label-secondary)] mt-1">
                {SALARY_MODEL_HINTS[salaryModel]}
              </div>
            </Field>
            {salaryModel !== "percent_of_team" && salaryModel !== "none" && (
              <Field label={`Сумма (${SALARY_UNIT[salaryModel]})`}>
                <input
                  type="number"
                  min={0}
                  value={salaryValue}
                  onChange={(e) => setSalaryValue(Number(e.target.value) || 0)}
                  className={`${inputCls} tabular-nums`}
                />
              </Field>
            )}
            {salaryModel === "hybrid" && (
              <Field label="Плюс % со своих работ">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={hybridPercent}
                    onChange={(e) => setHybridPercent(Number(e.target.value) || 0)}
                    className={`${inputCls} w-24 tabular-nums`}
                  />
                  <span className="text-[12px] text-[var(--label-secondary)]">%</span>
                </div>
              </Field>
            )}
            {salaryModel !== "none" && (
              <>
                <Field label="Фикс. бонус в месяц (€)">
                  <input
                    type="number"
                    min={0}
                    value={fixedBonus}
                    onChange={(e) => setFixedBonus(Number(e.target.value) || 0)}
                    className={`${inputCls} tabular-nums`}
                  />
                </Field>
                <Field label="Удержание в месяц (€)">
                  <input
                    type="number"
                    min={0}
                    value={deduction}
                    onChange={(e) => setDeduction(Number(e.target.value) || 0)}
                    className={`${inputCls} tabular-nums`}
                  />
                </Field>
                <Field label="Период выплат">
                  <select
                    value={salaryPeriod}
                    onChange={(e) => setSalaryPeriod(e.target.value as SalaryPeriod)}
                    className={inputCls}
                  >
                    {(Object.keys(SALARY_PERIOD_LABELS) as SalaryPeriod[]).map((p) => (
                      <option key={p} value={p}>
                        {SALARY_PERIOD_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Способ выплат">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className={inputCls}
                  >
                    {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Примечание">
                  <input
                    type="text"
                    value={salaryNote}
                    onChange={(e) => setSalaryNote(e.target.value)}
                    placeholder="Например: «минус наличные по средам»"
                    className={inputCls}
                  />
                </Field>
              </>
            )}
          </AccordionSection>

          <AccordionSection
            title="Доступы"
            subtitle="Что мастер видит и может — детально"
            open={open.permissions}
            onToggle={() => setOpen((p) => ({ ...p, permissions: !p.permissions }))}
          >
            <div className="space-y-1.5">
              <div className="px-1">
                <div className="text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
                  Видимость бригад
                </div>
                <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5">
                  Что мастер видит в списке команд
                </div>
              </div>
              <div className="inline-flex w-full rounded-xl bg-[var(--fill-primary)] p-1">
                {(
                  [
                    ["own", "Только своя"],
                    ["picked", "Выбрать"],
                    ["all", "Все"],
                  ] as Array<[BrigadeVisibility, string]>
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setBrigadeVisibility(k)}
                    className={`flex-1 h-8 rounded-lg text-[12px] font-semibold transition ${
                      brigadeVisibility === k
                        ? "bg-[var(--surface-card)] text-[var(--label)] shadow-[var(--shadow-card)]"
                        : "text-[var(--label-secondary)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {brigadeVisibility === "picked" && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {teams.map((t) => {
                    const on = permissions.visible_team_ids.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleBrigadeVisible(t.id)}
                        className={chipCls(on)}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {PERMISSION_GROUPS.map((group) => (
              <PermissionGroup
                key={group.key}
                title={group.title}
                description={group.description}
              >
                {group.permissions.map((key) => (
                  <SettingRow
                    key={key}
                    label={PERMISSION_LABELS[key]}
                    checked={Boolean(permissions[key])}
                    onChange={() => togglePermission(key)}
                  />
                ))}
              </PermissionGroup>
            ))}

            <PermissionGroup title="Push-уведомления">
              <SettingRow
                label="Новая запись"
                checked={notifications.push_new_appointment}
                onChange={(v) => setNotifications({ ...notifications, push_new_appointment: v })}
              />
              <SettingRow
                label="Перенос записи"
                checked={notifications.push_reschedule}
                onChange={(v) => setNotifications({ ...notifications, push_reschedule: v })}
              />
              <SettingRow
                label="Отмена записи"
                checked={notifications.push_cancellation}
                onChange={(v) => setNotifications({ ...notifications, push_cancellation: v })}
              />
              <SettingRow
                label="Сообщение в чате"
                checked={notifications.push_chat_message}
                onChange={(v) => setNotifications({ ...notifications, push_chat_message: v })}
              />
              <SettingRow
                label="Дневная сводка в 9:00"
                checked={notifications.push_daily_summary}
                onChange={(v) => setNotifications({ ...notifications, push_daily_summary: v })}
              />
            </PermissionGroup>
          </AccordionSection>

          <AccordionSection
            title="Документы"
            subtitle={documents.length > 0 ? `${documents.length} шт.` : "Паспорт, права, ИНН (по желанию)"}
            open={open.documents}
            onToggle={() => setOpen((p) => ({ ...p, documents: !p.documents }))}
          >
            {documents.length === 0 ? (
              <div className="text-[12px] text-[var(--label-secondary)] px-1">Документов пока нет.</div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="bg-[var(--fill-tertiary)] rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={doc.kind}
                      onChange={(e) =>
                        setDocuments((prev) =>
                          prev.map((d) => (d.id === doc.id ? { ...d, kind: e.target.value } : d))
                        )
                      }
                      placeholder="Тип"
                      className={`${inputCls} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
                      }
                      aria-label="Удалить"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={doc.value}
                    onChange={(e) =>
                      setDocuments((prev) =>
                        prev.map((d) => (d.id === doc.id ? { ...d, value: e.target.value } : d))
                      )
                    }
                    placeholder="Номер / серия / срок"
                    className={inputCls}
                  />
                </div>
              ))
            )}
            <button
              type="button"
              onClick={() =>
                setDocuments((prev) => [
                  ...prev,
                  { id: generateId("doc"), kind: "Паспорт", value: "" },
                ])
              }
              className="w-full h-10 rounded-lg border-[1.5px] border-dashed border-[var(--accent)]/40 text-[13px] font-semibold text-[var(--accent)] active:bg-[var(--accent-tint)]"
            >
              + Добавить документ
            </button>
          </AccordionSection>

          <AccordionSection
            title="Заметки"
            subtitle={notes ? `${notes.split("\n")[0].slice(0, 40)}…` : "Любые важные детали"}
            open={open.notes}
            onToggle={() => setOpen((p) => ({ ...p, notes: !p.notes }))}
          >
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Например: «Боится высоты, не ставим на внешние блоки выше 3-го этажа»"
              className={`${inputCls} resize-y`}
            />
          </AccordionSection>
        </div>

        <div
          className="flex-shrink-0 px-4 py-3 border-t border-[var(--separator)] bg-[var(--surface-card)] flex items-center justify-between gap-2"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 8px) + 12px)" }}
        >
          {isEditing && master ? (
            <button
              type="button"
              onClick={() => onDelete(master)}
              aria-label="Удалить"
              className="w-11 h-11 flex items-center justify-center rounded-xl text-[var(--system-red)] active:bg-[rgba(255,59,48,0.08)] transition"
            >
              <Trash2 size={20} strokeWidth={2} />
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 px-5 rounded-xl text-[var(--label)] text-[15px] font-medium active:bg-[var(--fill-primary)] transition"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="h-11 px-6 bg-[var(--accent)] text-[var(--label-on-accent)] rounded-xl text-[15px] font-semibold active:scale-[0.98] transition"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>

      {passwordToShowAfterSave && (
        <PasswordShowOnce
          password={passwordToShowAfterSave}
          email={loginEmail}
          onDismiss={() => setPasswordToShowAfterSave(null)}
        />
      )}
    </div>
  );
}

function salarySubtitle(model: SalaryModel, value: number, hybrid: number): string {
  if (model === "none") return "Не учитывается";
  if (model === "percent_of_team") return "% от бригады";
  if (model === "hybrid") {
    const base = value ? `${value} €/мес` : "оклад";
    const extra = hybrid ? ` + ${hybrid}%` : "";
    return base + extra;
  }
  const unit = SALARY_UNIT[model];
  if (value) return `${value} ${unit} · ${SALARY_MODEL_LABELS[model]}`;
  return SALARY_MODEL_LABELS[model];
}

function PasswordShowOnce({
  password,
  email,
  onDismiss,
}: {
  password: string;
  email?: string;
  onDismiss: () => void;
}) {
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(password);
    } catch {
      window.prompt("Скопируйте пароль:", password);
    }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-sheet)] w-full max-w-sm p-5 space-y-4">
        <div>
          <div className="text-[17px] font-semibold text-[var(--label)] tracking-tight">
            Пароль создан
          </div>
          <div className="text-[13px] text-[var(--label-secondary)] leading-snug mt-1">
            Это единственный раз, когда пароль показан. Скопируйте и передайте сотруднику.
          </div>
        </div>
        {email && (
          <div className="flex items-center justify-between px-3 py-2.5 bg-[var(--fill-primary)] rounded-xl">
            <span className="text-[12px] font-medium text-[var(--label-secondary)]">Логин</span>
            <span className="text-[13px] font-semibold text-[var(--label)] tabular-nums">
              {email}
            </span>
          </div>
        )}
        <div className="text-[17px] font-mono font-bold text-[var(--label)] bg-[var(--accent-tint)] rounded-xl px-4 py-4 tracking-[0.08em] text-center">
          {password}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 h-11 rounded-xl bg-[var(--fill-primary)] text-[var(--label)] text-[14px] font-semibold active:bg-[var(--fill-secondary)] transition"
          >
            Готово
          </button>
          <button
            type="button"
            onClick={copy}
            className="flex-1 h-11 rounded-xl bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:scale-[0.98] transition"
          >
            Скопировать
          </button>
        </div>
      </div>
    </div>
  );
}

// iOS-style input: no visible border, soft inset background. Looks like
// the fields in Telegram's settings / iOS' System Settings.
const inputCls =
  "w-full px-3.5 py-2.5 bg-[var(--fill-primary)] border border-transparent rounded-xl text-[15px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)] transition";

const chipCls = (on: boolean) =>
  `text-[12px] px-3 py-1.5 rounded-full transition-colors ${
    on
      ? "bg-[var(--accent)] text-[var(--label-on-accent)]"
      : "bg-[var(--surface-card)] text-[var(--label)] border border-[var(--separator)] active:bg-[var(--fill-tertiary)]"
  }`;

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--label-secondary)] mb-1.5 tracking-wide">
        {label}
        {required && <span className="text-[var(--system-red)] ml-0.5">*</span>}
      </label>
      {children}
      {hint && <div className="text-[12px] text-[var(--label-tertiary)] mt-1.5 leading-snug">{hint}</div>}
    </div>
  );
}

// Telegram/iOS grouped-list: a section header in small-caps above a
// rounded white card containing divided rows.
function PermissionGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 pt-2">
      <div className="px-1">
        <div className="text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
          {title}
        </div>
        {description && (
          <div className="text-[12px] text-[var(--label-tertiary)] mt-0.5">{description}</div>
        )}
      </div>
      <div className="rounded-xl bg-[var(--surface-card)] divide-y divide-[var(--separator)]">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 min-h-[44px]">
      <span className="text-[14px] text-[var(--label)] flex-1 leading-snug">{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );
}

// Accordion card: iOS-settings look — white card, rounded, no hard
// border, soft inset shadow to separate from the slate-50 backdrop.
function AccordionSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-[var(--surface-card)] shadow-[var(--shadow-card)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-[var(--fill-tertiary)] transition"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-[var(--label)] tracking-tight">
            {title}
          </div>
          {subtitle && (
            <div className="text-[13px] text-[var(--label-secondary)] truncate mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={`text-[var(--label-tertiary)] flex-shrink-0 ml-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3.5 border-t border-[var(--separator)]">
          {children}
        </div>
      )}
    </div>
  );
}

// iOS-style switch — larger thumb, emerald-ish green when on (matches
// Telegram + system switches). 51×31 pt on iOS; we approximate.
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-[46px] h-[28px] rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-[var(--system-green)]" : "bg-[var(--fill-primary)]"
      }`}
    >
      <span
        className={`absolute top-[2px] left-[2px] w-6 h-6 bg-[var(--surface-card)] rounded-full shadow-[var(--shadow-card)] transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// Silence unused-import warning in case `useMemo` gets trimmed by a refactor.
void useMemo;
