"use client";

// STORY-061 (clients redesign · slice 1) — "create in 5 seconds".
//
// Approved mockup direction: the create screen is name + phone first,
// everything else (messengers, birthday, city, source, note, status)
// folds under a single «Ещё». Objects stay one optional dashed button.
// 90 % of real entries are a client dictating name + number on the
// phone — those must cost two fields, not a scroll past eight.
//
// Logic preserved verbatim from the previous version: E.164 dedup
// guard, createBlankClient seed, city reference-book loading, country
// phone input. Only the JSX layout changed.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  Home,
  MapPin,
  Plus,
  X,
} from "@babun/shared/icons";
import { useClients, useTenantId } from "@/components/layout/DashboardClientLayout";
import {
  createBlankClient,
  ACQUISITION_LABELS,
  type AcquisitionSource,
  type Client,
  type Location,
  type PropertyType,
} from "@babun/shared/local/clients";
import { generateId } from "@babun/shared/local/masters";
import {
  loadCities,
  getActiveCities,
  type City,
} from "@babun/shared/local/cities";
import { Button } from "@/components/ui";
import { haptic } from "@/lib/haptics";
// P2 #43 (CRM Core brief) — shared save-state hook collapses the
// old {saving, saved, error} trio into one tagged union so the
// button + indicator never disagree about which message is active.
import { useSaveStatus } from "@/hooks/useSaveStatus";
// P0 #6 (CRM Core brief) — shared object-form fields so the create
// flow here matches the modal editor on /clients/[id].
import ObjectFormFields, {
  PROPERTY_CHOICES as SHARED_PROPERTY_CHOICES,
} from "@/components/clients/ObjectFormFields";
// clients-99 F2.7 / F1.5 — country-aware phone + dedup guard.
import { CountryPhoneInput } from "@/components/ui/CountryPhoneInput";
import { tryToE164, type CountryCode } from "@/lib/phone/normalize";
import { findClientByPhoneE164 } from "@babun/shared/db/repositories/clients";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { DuplicateClientModal } from "@/components/clients/DuplicateClientModal";
import { track } from "@/lib/analytics/track";

// P0 #6 — Property-type chip palette moved into the shared
// ObjectFormFields module; re-export under the legacy local name so
// the inline-create flow's «start a fresh draft» seed still resolves
// without touching every call site.
const PROPERTY_CHOICES = SHARED_PROPERTY_CHOICES;

// Structural alias of ObjectFormDraft so the shared `<ObjectFormFields />`
// onChange handler can write straight back without a cast. property_type
// stays optional to match the Location schema's new per-object field.
interface LocationDraft {
  label: string;
  property_type?: PropertyType;
  address: string;
  note: string;
}

export default function NewClientPage() {
  const router = useRouter();
  const { upsertClient } = useClients();
  const tenantId = useTenantId();

  const [fullName, setFullName] = useState("");
  // clients-99 F2.7 — country comes from a flag selector. No more
  // "+357 " hardcoded prefix.
  const [country, setCountry] = useState<CountryCode>("CY");
  const [phone, setPhone] = useState("");
  // clients-99 F3.11 — WhatsApp shares the phone in 90% of cases.
  const [waSameAsPhone, setWaSameAsPhone] = useState(true);
  const [whatsapp, setWhatsapp] = useState("");
  const [telegram, setTelegram] = useState("");
  const [instagram, setInstagram] = useState("");
  // clients-99 F2.8 — acquisition source / favorite master.
  const [source, setSource] = useState<AcquisitionSource>("unknown");
  const [favoriteMasterId] = useState<string | null>(null);
  // clients-99 F1.5 — duplicate guard.
  const [duplicate, setDuplicate] = useState<{
    existing: Client;
    attempted: string;
  } | null>(null);
  const [forceCreateDuplicate, setForceCreateDuplicate] = useState(false);

  const [locations, setLocations] = useState<Location[]>([]);
  const [draftLoc, setDraftLoc] = useState<LocationDraft | null>(null);

  // STORY-061 — single «Ещё» fold holds messengers + details + status.
  const [moreOpen, setMoreOpen] = useState(false);
  const [city, setCity] = useState("");
  const [birthday, setBirthday] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  // P1 #23 (CRM Core brief) — VIP / blacklist were settable only after
  // save. Lifted into the create form so a dispatcher who hears
  // «постоянный клиент, не теряем» on the call can flag it before
  // the record is even persisted. «Постоянный» / «Новый» stay derived
  // from visit count + ageDays — they're not real tags, ClientStatusBadges
  // computes them at render time.
  const [vip, setVip] = useState(false);
  const [blacklisted, setBlacklisted] = useState(false);
  // P1 #25 (CRM Core brief) — city is now sourced from the
  // /dashboard/settings/cities reference book instead of a free-text
  // input. Empty list (e.g. brand-new tenant who hasn't seeded cities
  // yet) falls back to a plain input so creating clients doesn't
  // block on a separate settings detour.
  const [cityList, setCityList] = useState<City[]>([]);
  useEffect(() => {
    // Client-only hydration: loadCities() reads localStorage which
    // is undefined during SSR. Empty initial render matches the
    // server, this effect upgrades to the persisted city catalogue
    // after mount. React-Compiler flags the pattern; the cascade is
    // intentional and bounded to one extra render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCityList(getActiveCities(loadCities()));
  }, []);

  const save = useSaveStatus();
  const saving = save.status === "saving";
  const saveError = save.error;

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const trimmedPhone = phone.trim();
  const phoneFilled = trimmedPhone.length > 0;
  const canSubmit = fullName.trim().length > 0 && phoneFilled && !saving;

  const handleStartObject = () => {
    haptic("tap");
    setDraftLoc({
      label: PROPERTY_CHOICES[0].defaultLabel,
      property_type: "house",
      address: "",
      note: "",
    });
  };

  const handleSaveObject = () => {
    if (!draftLoc) return;
    if (!draftLoc.address.trim()) return;
    haptic("tap");
    const newLoc: Location = {
      id: generateId("loc"),
      label: draftLoc.label.trim() || "Объект",
      address: draftLoc.address.trim(),
      // P0 #6 — per-object type now persists from the create form.
      property_type: draftLoc.property_type,
      isPrimary: locations.length === 0,
      note: draftLoc.note.trim() || undefined,
      equipment: [],
    };
    setLocations((prev) => [...prev, newLoc]);
    setDraftLoc(null);
  };

  const handleRemoveObject = (idx: number) => {
    haptic("warning");
    setLocations((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // Keep first object as primary if we removed the previous one.
      return next.map((l, i) => ({ ...l, isPrimary: i === 0 }));
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    haptic("medium");
    // clients-99 F1.4 — normalize to E.164 for index + dedup.
    const e164 = tryToE164(trimmedPhone, country);

    // clients-99 F1.5 — block silent same-tenant dup creation.
    if (e164 && !forceCreateDuplicate) {
      try {
        const existing = await findClientByPhoneE164(
          getSupabaseBrowser(),
          e164,
          tenantId,
        );
        if (existing) {
          track("clients.duplicate_blocked", { phone_e164: e164 });
          setDuplicate({ existing, attempted: e164 });
          return;
        }
      } catch {
        // Network blip — let the save proceed; DB unique index is the
        // ultimate guarantee.
      }
    }

    const waPhone = waSameAsPhone ? "" : whatsapp.trim();
    const blank = createBlankClient({
      full_name: fullName.trim(),
      phone: trimmedPhone,
      phone_e164: e164,
      sms_name: fullName.trim().split(/\s+/)[0] || "",
      whatsapp_phone: waPhone,
      telegram_username: telegram.trim().replace(/^@/, ""),
      instagram_username: instagram.trim().replace(/^@/, ""),
      email: email.trim(),
      city: city.trim(),
      birthday: birthday || "",
      comment: comment.trim(),
      locations,
      tag_ids: vip ? ["tag-vip"] : [],
      blacklisted,
      acquisition_source: source,
      favorite_master_id: favoriteMasterId,
    });
    const ok = await save.run(async () => {
      await upsertClient(blank);
      return true;
    });
    if (ok) {
      router.replace(`/dashboard/clients/${blank.id}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface-grouped)] h-full">
      {/* Sticky header with Save in the top-right. */}
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
          <div className="flex-1 text-[15px] font-semibold text-[var(--label)]">
            Новый клиент
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {save.label("Сохранить")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto p-3 pb-10 space-y-3">
          {/* ───────── Contact — name + phone, first-class ───────── */}
          <Card>
            <CardTitle>Контакт</CardTitle>
            <div className="space-y-2.5">
              <Field label="Имя" required>
                <input
                  ref={nameRef}
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Имя или Имя Фамилия"
                  maxLength={120}
                  className={inputCls + " h-12 text-[17px] font-semibold"}
                />
              </Field>
              <Field label="Телефон" required>
                <CountryPhoneInput
                  value={phone}
                  onChange={setPhone}
                  country={country}
                  onCountryChange={setCountry}
                  defaultCountry={country}
                  placeholder="Номер телефона"
                />
              </Field>
            </div>
          </Card>

          {/* ───────── Objects — one optional dashed button ───────── */}
          {locations.length === 0 && !draftLoc ? (
            <button
              type="button"
              onClick={handleStartObject}
              className="w-full h-12 flex items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-[var(--separator-opaque)] text-[var(--accent)] text-[14px] font-semibold active:bg-[var(--accent-tint)]"
            >
              <Plus size={15} strokeWidth={2.5} />
              Добавить объект (адрес, кондиционеры)
            </button>
          ) : (
            <Card>
              <CardTitle subtitle="дом, офис, вилла — каждый со своим адресом">
                Объекты
              </CardTitle>
              <div className="space-y-2">
                {locations.map((loc, idx) => (
                  <LocationRow
                    key={loc.id}
                    location={loc}
                    onRemove={() => handleRemoveObject(idx)}
                  />
                ))}
              </div>
              {draftLoc ? (
                <InlineLocationForm
                  draft={draftLoc}
                  onChange={setDraftLoc}
                  onSave={handleSaveObject}
                  onCancel={() => {
                    haptic("light");
                    setDraftLoc(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={handleStartObject}
                  className="mt-2 w-full h-11 flex items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-[var(--separator)] text-[var(--accent)] text-[14px] font-semibold active:bg-[var(--accent-tint)]"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Добавить ещё объект
                </button>
              )}
            </Card>
          )}

          {/* ───────── «Ещё» — everything non-essential folds here ───────── */}
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setMoreOpen((v) => !v);
            }}
            aria-expanded={moreOpen}
            className="w-full flex items-center gap-2 bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] px-4 py-3.5 active:bg-[var(--fill-quaternary)]"
          >
            <span className="flex-1 text-left">
              <span className="block text-[15px] font-semibold text-[var(--label)]">
                Ещё
              </span>
              <span className="block text-[12px] text-[var(--label-secondary)] mt-0.5">
                мессенджеры, день рождения, город, заметка, статус
              </span>
            </span>
            <span
              className={`text-[var(--label-tertiary)] transition-transform ${
                moreOpen ? "rotate-180" : ""
              }`}
            >
              <ChevronDown size={18} strokeWidth={2.5} />
            </span>
          </button>

          {moreOpen && (
            <>
              {/* Messengers */}
              <Card>
                <CardTitle>Мессенджеры</CardTitle>
                <label className="flex items-center gap-2 text-[13px] text-[var(--label-secondary)] select-none mb-2.5">
                  <input
                    type="checkbox"
                    checked={waSameAsPhone}
                    onChange={(e) => setWaSameAsPhone(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  WhatsApp на этом номере
                </label>
                {!waSameAsPhone && (
                  <Field label="Другой WhatsApp">
                    <input
                      type="tel"
                      inputMode="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+357 ..."
                      className={inputCls + " tabular-nums"}
                    />
                  </Field>
                )}
                <div className="space-y-2.5">
                  <Field label="Telegram">
                    <Input
                      value={telegram}
                      onChange={setTelegram}
                      placeholder="@username"
                      maxLength={64}
                    />
                  </Field>
                  <Field label="Instagram">
                    <Input
                      value={instagram}
                      onChange={setInstagram}
                      placeholder="@handle"
                      maxLength={64}
                    />
                  </Field>
                </div>
              </Card>

              {/* Детали */}
              <Card>
                <CardTitle>Детали</CardTitle>
                <div className="space-y-2.5">
                  <Field label="Город">
                    {cityList.length > 0 ? (
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">— не указан —</option>
                        {cityList.map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={city}
                        onChange={setCity}
                        placeholder="Добавьте города в Настройках → Города"
                      />
                    )}
                  </Field>
                  <Field label="День рождения">
                    <input
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ivan@example.com"
                      className={inputCls}
                    />
                  </Field>
                  {/* clients-99 F2.8 — acquisition source. */}
                  <Field label="Источник">
                    <select
                      value={source}
                      onChange={(e) =>
                        setSource(e.target.value as AcquisitionSource)
                      }
                      className={inputCls}
                    >
                      {(Object.keys(ACQUISITION_LABELS) as AcquisitionSource[]).map(
                        (key) => (
                          <option key={key} value={key}>
                            {ACQUISITION_LABELS[key]}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="Заметки">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      placeholder="Особенности, предпочтения, всё важное…"
                      className={`${inputCls} h-auto py-2 leading-snug`}
                    />
                  </Field>
                </div>
              </Card>

              {/* P1 #23 — status chips */}
              <Card>
                <CardTitle>Статус</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <StatusChip
                    label="VIP"
                    active={vip}
                    onClick={() => {
                      haptic("tap");
                      setVip((v) => !v);
                      // VIP and blacklist are mutually exclusive — a flagged
                      // problem client shouldn't be lit up as a top-tier guest.
                      if (!vip) setBlacklisted(false);
                    }}
                    tone="vip"
                  />
                  <StatusChip
                    label="Чёрный список"
                    active={blacklisted}
                    onClick={() => {
                      haptic("tap");
                      setBlacklisted((v) => !v);
                      if (!blacklisted) setVip(false);
                    }}
                    tone="blacklist"
                  />
                </div>
                <div className="mt-2 text-[11px] text-[var(--label-tertiary)] leading-snug">
                  «Новый» и «Постоянный» система ставит сама — по визитам и
                  возрасту записи.
                </div>
              </Card>
            </>
          )}

          <p className="text-[12px] text-[var(--label-tertiary)] text-center px-4 leading-snug">
            Имя и телефон — и клиент в базе. Объекты, кондиционеры и остальное
            можно дозаполнить из карточки в любой момент.
          </p>

          {saveError && (
            <div className="text-[13px] text-[var(--system-red)] text-center px-2">
              {saveError}
            </div>
          )}
        </div>
      </div>

      {/* clients-99 F1.5 — duplicate guard surface. */}
      {duplicate && (
        <DuplicateClientModal
          existing={duplicate.existing}
          attemptedPhoneE164={duplicate.attempted}
          onOpenExisting={() => {
            const id = duplicate.existing.id;
            setDuplicate(null);
            router.replace(`/dashboard/clients/${id}`);
          }}
          onSaveAnyway={() => {
            setDuplicate(null);
            setForceCreateDuplicate(true);
            queueMicrotask(() => {
              void handleSubmit();
            });
          }}
          onCancel={() => setDuplicate(null)}
        />
      )}
    </div>
  );
}

// ───────── Inline object form ─────────

function InlineLocationForm({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: LocationDraft;
  onChange: (next: LocationDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const canSave = draft.address.trim().length > 0;
  return (
    <div className="mt-3 p-3 rounded-[12px] bg-[var(--fill-quaternary)] space-y-2.5">
      {/* P0 #6 — fields delegated to the shared <ObjectFormFields>.
          InlineLocationForm keeps only its inline Cancel/Save chrome. */}
      <ObjectFormFields draft={draft} onChange={onChange} autoFocusAddress />

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-10 rounded-[10px] bg-[var(--surface-card)] border border-[var(--separator)] text-[14px] font-semibold text-[var(--label)] active:bg-[var(--fill-tertiary)]"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={`flex-1 h-10 rounded-[10px] text-[14px] font-semibold transition ${
            canSave
              ? "bg-[var(--accent)] text-[var(--label-on-accent)] active:bg-[var(--accent-pressed)]"
              : "bg-[var(--fill-tertiary)] text-[var(--label-tertiary)] cursor-not-allowed"
          }`}
        >
          Готово
        </button>
      </div>
    </div>
  );
}

// ───────── Existing-object row ─────────

function LocationRow({
  location,
  onRemove,
}: {
  location: Location;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-[12px] bg-[var(--fill-quaternary)]">
      <span className="shrink-0 w-9 h-9 rounded-lg bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center">
        <Home size={16} strokeWidth={2} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-[var(--label)] truncate">
          {location.label}
          {location.isPrimary && (
            <span className="ml-1.5 text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider">
              основной
            </span>
          )}
        </div>
        <div className="text-[12px] text-[var(--label-secondary)] truncate flex items-center gap-1">
          <MapPin size={10} strokeWidth={2} className="shrink-0" />
          {location.address}
        </div>
        {location.note && (
          <div className="text-[11px] text-[var(--label-tertiary)] truncate mt-0.5">
            {location.note}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Удалить объект"
        className="shrink-0 w-8 h-8 -mr-1 -mt-1 flex items-center justify-center rounded-full text-[var(--label-tertiary)] active:bg-[var(--fill-tertiary)]"
      >
        <X size={14} strokeWidth={2.4} />
      </button>
    </div>
  );
}

// ───────── Tiny presentational helpers ─────────

const inputCls =
  "w-full h-10 px-3 text-[15px] bg-[var(--surface-card)] border border-[var(--separator)] rounded-[10px] focus:outline-none focus:border-[var(--accent)]";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] p-3">
      {children}
    </section>
  );
}

// P1 #23 — toggle chips for VIP / blacklist on the create form. Tones
// match the read-side ClientStatusBadges so a chip lit here visually
// echoes the badge the user will see later in /clients/[id].
function StatusChip({
  label,
  active,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  tone: "vip" | "blacklist";
}) {
  const activeCls =
    tone === "vip"
      ? "bg-[rgba(255,204,0,0.18)] text-[#B78600] border-[rgba(255,204,0,0.4)]"
      : "bg-[rgba(255,59,48,0.12)] text-[var(--system-red)] border-[rgba(255,59,48,0.3)]";
  const idleCls =
    "bg-[var(--fill-tertiary)] text-[var(--label-secondary)] border-transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 h-9 rounded-full text-[13px] font-semibold border transition active:scale-[0.97] ${
        active ? activeCls : idleCls
      }`}
    >
      {label}
    </button>
  );
}

function CardTitle({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="mb-2">
      <h2 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--label-secondary)]">
        {children}
      </h2>
      {subtitle && (
        <p className="text-[11px] text-[var(--label-tertiary)] mt-0.5">
          {subtitle}
        </p>
      )}
    </div>
  );
}

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
    <label className="block">
      <span className="text-[12px] font-medium text-[var(--label-secondary)] flex items-center gap-1 mb-1">
        {label}
        {required && (
          <span className="text-[var(--system-red)]" aria-label="Обязательное поле">
            *
          </span>
        )}
        {hint && (
          <span className="text-[var(--label-tertiary)] font-normal ml-auto">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function Input({
  inputRef,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  inputRef?: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className={inputCls}
    />
  );
}
