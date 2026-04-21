"use client";

import { useEffect, useState } from "react";
import {
  defaultPermissionsForRole,
  generateId,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  SALARY_MODEL_LABELS,
  SALARY_UNIT,
  type Master,
  type MasterDocument,
  type MasterPermissions,
  type MasterRole,
  type MasterSalary,
  type SalaryModel,
  type Team,
} from "@/lib/masters";

type Section = "personal" | "job" | "salary" | "permissions" | "documents" | "notes";

interface MasterSheetProps {
  master: Master | null;
  teams: Team[];
  onCancel: () => void;
  onSave: (master: Master) => void;
  onDelete: (master: Master) => void;
}

// Sprint 026: expanded employee form. Replaces the cramped old modal
// with an accordion that groups the record into 6 sections. Only the
// first (Личные данные) is open by default; the rest stay collapsed
// so the sheet fits a phone screen without a scroll panic.
export default function MasterSheet({
  master,
  teams,
  onCancel,
  onSave,
  onDelete,
}: MasterSheetProps) {
  const isEditing = !!master;

  const [open, setOpen] = useState<Record<Section, boolean>>({
    personal: true,
    job: !isEditing, // new records: open "Работа" so the brigade isn't missed
    salary: false,
    permissions: false,
    documents: false,
    notes: false,
  });

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
  const [hireDate, setHireDate] = useState(master?.hire_date ?? "");
  const [emergencyContact, setEmergencyContact] = useState(
    master?.emergency_contact ?? ""
  );
  const [isActive, setIsActive] = useState(master?.is_active ?? true);

  // Salary
  const [salaryModel, setSalaryModel] = useState<SalaryModel>(
    master?.salary?.model ?? "percent_of_team"
  );
  const [salaryValue, setSalaryValue] = useState<number>(master?.salary?.value ?? 0);
  const [salaryNote, setSalaryNote] = useState(master?.salary?.note ?? "");

  // Permissions
  const [permissions, setPermissions] = useState<MasterPermissions>(
    master?.permissions ?? defaultPermissionsForRole("helper")
  );

  // Documents
  const [documents, setDocuments] = useState<MasterDocument[]>(master?.documents ?? []);

  // Notes
  const [notes, setNotes] = useState(master?.notes ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const handleRoleChange = (nextRole: MasterRole) => {
    setRole(nextRole);
    setPermissions(defaultPermissionsForRole(nextRole));
  };

  const togglePermission = (key: keyof Omit<MasterPermissions, "visible_team_ids">) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allTeamsVisible = permissions.visible_team_ids.includes("*");

  const toggleAllTeamsVisible = () => {
    setPermissions((prev) => ({
      ...prev,
      visible_team_ids: prev.visible_team_ids.includes("*") ? [] : ["*"],
    }));
  };

  const toggleTeamVisible = (tid: string) => {
    setPermissions((prev) => {
      if (prev.visible_team_ids.includes("*")) return prev;
      const has = prev.visible_team_ids.includes(tid);
      return {
        ...prev,
        visible_team_ids: has
          ? prev.visible_team_ids.filter((id) => id !== tid)
          : [...prev.visible_team_ids, tid],
      };
    });
  };

  const addDocument = () => {
    setDocuments((prev) => [
      ...prev,
      { id: generateId("doc"), kind: "Паспорт", value: "" },
    ]);
  };

  const updateDocument = (id: string, patch: Partial<MasterDocument>) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSubmit = () => {
    if (!fullName.trim()) {
      window.alert("Введите ФИО мастера");
      return;
    }
    const nowIso = new Date().toISOString();
    const salary: MasterSalary = {
      model: salaryModel,
      value: Number.isFinite(salaryValue) ? salaryValue : 0,
      note: salaryNote.trim() || undefined,
    };
    const next: Master = {
      id: master?.id ?? generateId("m"),
      full_name: fullName.trim(),
      phone: phone.trim(),
      avatar_url: master?.avatar_url ?? null,
      team_id: teamId,
      role,
      is_active: isActive,
      permissions,
      created_at: master?.created_at ?? nowIso,
      email: email.trim() || undefined,
      whatsapp: whatsapp.trim() || undefined,
      telegram: telegram.trim() || undefined,
      birthday: birthday || undefined,
      address: address.trim() || undefined,
      hire_date: hireDate || undefined,
      emergency_contact: emergencyContact.trim() || undefined,
      salary,
      documents: documents.filter((d) => d.value.trim() || d.kind.trim()),
      notes: notes.trim() || undefined,
    };
    onSave(next);
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 flex items-end lg:items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-t-2xl lg:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-4 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-slate-900">
            {isEditing ? fullName.trim() || "Мастер" : "Новый сотрудник"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Закрыть"
            className="w-8 h-8 rounded-lg text-slate-500 active:bg-slate-100 flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
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
            <Field label="Email">
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
            subtitle={`${ROLE_LABELS[role]}${teamId ? " · в бригаде" : " · без бригады"}`}
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
            <Field label="Роль">
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
            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] text-slate-700">Активен</span>
              <ToggleSwitch checked={isActive} onChange={setIsActive} />
            </div>
          </AccordionSection>

          <AccordionSection
            title="Зарплата"
            subtitle={`${SALARY_MODEL_LABELS[salaryModel]}${salaryValue ? ` · ${salaryValue} ${SALARY_UNIT[salaryModel]}` : ""}`}
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
            </Field>
            {salaryModel !== "percent_of_team" && (
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
            {salaryModel === "percent_of_team" && (
              <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                При этой модели ЗП приходит через бригаду — настройте
                «Зарплата (% от чистого дохода)» на странице бригады.
              </div>
            )}
            <Field label="Примечание">
              <input
                type="text"
                value={salaryNote}
                onChange={(e) => setSalaryNote(e.target.value)}
                placeholder="Например: «минус наличные по средам»"
                className={inputCls}
              />
            </Field>
          </AccordionSection>

          <AccordionSection
            title="Доступы"
            subtitle="Что мастер видит и может"
            open={open.permissions}
            onToggle={() => setOpen((p) => ({ ...p, permissions: !p.permissions }))}
          >
            {PERMISSION_GROUPS.filter((g) => g.permissions.length > 0).map((group) => (
              <div key={group.key} className="space-y-1.5">
                <div className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">
                  {group.title}
                </div>
                <div className="space-y-2 bg-slate-50 rounded-lg p-3">
                  {group.permissions.map((key) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[13px] text-slate-700">
                        {PERMISSION_LABELS[key]}
                      </span>
                      <ToggleSwitch
                        checked={permissions[key]}
                        onChange={() => togglePermission(key)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <div className="text-[11px] text-slate-500 mb-2">Видимые бригады</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={toggleAllTeamsVisible}
                  className={chipCls(allTeamsVisible)}
                >
                  Все
                </button>
                {!allTeamsVisible &&
                  teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTeamVisible(t.id)}
                      className={chipCls(permissions.visible_team_ids.includes(t.id))}
                    >
                      {t.name}
                    </button>
                  ))}
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            title="Документы"
            subtitle={documents.length > 0 ? `${documents.length} шт.` : "Паспорт, права, ИНН"}
            open={open.documents}
            onToggle={() => setOpen((p) => ({ ...p, documents: !p.documents }))}
          >
            {documents.length === 0 ? (
              <div className="text-[12px] text-slate-500 px-1">Документов пока нет.</div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="bg-slate-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={doc.kind}
                      onChange={(e) => updateDocument(doc.id, { kind: e.target.value })}
                      placeholder="Тип"
                      className={`${inputCls} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => removeDocument(doc.id)}
                      aria-label="Удалить"
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-500 active:bg-rose-50"
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
                    onChange={(e) => updateDocument(doc.id, { value: e.target.value })}
                    placeholder="Номер / серия / срок"
                    className={inputCls}
                  />
                </div>
              ))
            )}
            <button
              type="button"
              onClick={addDocument}
              className="w-full h-10 rounded-lg border-[1.5px] border-dashed border-violet-300 text-[13px] font-semibold text-violet-600 active:bg-violet-50"
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

        <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100 flex items-center justify-between gap-2">
          {isEditing && master ? (
            <button
              type="button"
              onClick={() => onDelete(master)}
              className="text-[13px] text-rose-600 border border-rose-200 active:bg-rose-50 rounded-lg px-3 py-2 font-medium"
            >
              Удалить
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="border border-slate-300 text-slate-700 rounded-lg px-4 py-2 text-[13px] font-medium active:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="bg-violet-600 text-white rounded-lg px-4 py-2 text-[13px] font-semibold active:scale-[0.99]"
            >
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 border border-slate-300 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-violet-500";

const chipCls = (on: boolean) =>
  `text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
    on
      ? "bg-violet-600 text-white border-violet-600"
      : "bg-white text-slate-700 border-slate-300 active:bg-slate-50"
  }`;

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] text-slate-500 mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

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
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left active:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-900">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-slate-500 truncate">{subtitle}</div>
          )}
        </div>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-slate-100">{children}</div>
      )}
    </div>
  );
}

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
      className={`relative w-10 h-6 rounded-full transition-colors ${
        checked ? "bg-violet-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}
