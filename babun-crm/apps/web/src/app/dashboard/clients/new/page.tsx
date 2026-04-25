"use client";

// STORY-034 Group 4 — Quick-create client screen.
//
// Strict minimum: name + phone (+357 default).  Optional inline
// «+ Добавить объект» that opens the existing LocationEditor sheet.
// «Создать» disabled until both fields have content.  After save
// → router.replace to /dashboard/clients/{id} so the user lands on
// the freshly-redesigned card and can fill the rest from there.
//
// Removed per brief:
// * orange banner «Имя и телефон обязательны»
// * placeholder «Заполни профиль ниже»
// * any extra blocks (Личное / Группы / Заметки) — they live in the
//   detail card after creation.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, Home, MapPin } from "lucide-react";
import { useClients } from "@/app/dashboard/layout";
import {
  createBlankClient,
  type Location,
} from "@/lib/clients";
import { generateId } from "@/lib/masters";
import LocationEditor from "@/components/clients/LocationEditor";
import { Button } from "@/components/ui";
import { haptic } from "@/lib/haptics";

const DEFAULT_PHONE_PREFIX = "+357 ";

export default function NewClientPage() {
  const router = useRouter();
  const { upsertClient } = useClients();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState(DEFAULT_PHONE_PREFIX);
  const [location, setLocation] = useState<Location | null>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const trimmedPhone = phone.trim();
  const phoneFilled =
    trimmedPhone.length > 0 && trimmedPhone !== DEFAULT_PHONE_PREFIX.trim();
  const canSubmit = fullName.trim().length > 0 && phoneFilled;

  const submit = () => {
    if (!canSubmit) return;
    haptic("medium");
    const blank = createBlankClient({
      full_name: fullName.trim(),
      phone: trimmedPhone,
      sms_name: fullName.trim().split(" ")[0] || "",
      locations: location ? [{ ...location, isPrimary: true }] : [],
    });
    upsertClient(blank);
    router.replace(`/dashboard/clients/${blank.id}`);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface-grouped)] h-full">
      <div className="sticky top-0 z-20 bg-[var(--surface-card)] border-b border-[var(--separator)]">
        <div className="flex items-center gap-2 px-3 h-12">
          <button
            type="button"
            onClick={() => {
              haptic("light");
              router.back();
            }}
            aria-label="Назад"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--label-secondary)] active:bg-[var(--fill-quaternary)]"
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
          </button>
          <div className="flex-1 text-[14px] font-semibold text-[var(--label)]">
            Новый клиент
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={submit}
            disabled={!canSubmit}
          >
            Создать
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-3 space-y-2">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-3 space-y-3">
            <Field label="Имя">
              <input
                ref={nameRef}
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Иван Петров"
                maxLength={120}
                className="w-full h-10 px-3 text-[15px] bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />
            </Field>
            <Field label="Телефон">
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onFocus={(e) => {
                  // Move caret past the prefix on first focus so the
                  // user types right after «+357 » without thinking.
                  if (e.currentTarget.value === DEFAULT_PHONE_PREFIX) {
                    const len = DEFAULT_PHONE_PREFIX.length;
                    e.currentTarget.setSelectionRange(len, len);
                  }
                }}
                placeholder="+357 99 ..."
                className="w-full h-10 px-3 text-[15px] tabular-nums bg-[var(--fill-tertiary)] border border-transparent rounded-[10px] focus:outline-none focus:bg-[var(--surface-card)] focus:border-[var(--accent)]"
              />
            </Field>
          </div>

          {/* Optional object — collapsed unless user adds one */}
          {location ? (
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-3 flex items-start gap-2">
              <span className="shrink-0 w-9 h-9 rounded-lg bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
                <Home size={16} strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[var(--label)] truncate">
                  {location.label || "Объект"}
                </div>
                <div className="text-[12px] text-[var(--label-secondary)] truncate flex items-center gap-1">
                  <MapPin size={10} strokeWidth={2} className="shrink-0" />
                  {location.address || "адрес не указан"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingLocation(true)}
                className="text-[12px] font-semibold text-[var(--accent)] active:opacity-70"
              >
                Изменить
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                haptic("tap");
                setEditingLocation(true);
              }}
              className="w-full h-12 flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--separator)] text-[var(--accent)] text-[14px] font-semibold active:bg-[var(--accent-tint)]"
            >
              <Plus size={14} strokeWidth={2.5} />
              Добавить объект
            </button>
          )}

          <p className="text-[12px] text-[var(--label-tertiary)] text-center px-4 pt-2">
            Остальные данные (заметки, теги, мессенджеры…) можно
            заполнить после создания.
          </p>
        </div>
      </div>

      <LocationEditor
        open={editingLocation}
        location={
          editingLocation
            ? location ?? {
                id: generateId("loc"),
                label: "Дом",
                address: "",
                isPrimary: true,
                equipment: [],
              }
            : null
        }
        isOnly={true}
        onSave={(loc) => {
          haptic("tap");
          setLocation({ ...loc, isPrimary: true });
          setEditingLocation(false);
        }}
        onClose={() => setEditingLocation(false)}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)] mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
