"use client";

// STORY-074 — Brand + public contacts editor.
//
// One sticky-bottom save button, optimistic local state. Exposes:
//   * Booking slug (preview as babun.app/book/<slug>)
//   * Logo URL (text field — uploader can land later)
//   * Business address
//   * Contact channels: phone / email / WhatsApp / Telegram / Instagram
//
// Form submits one bulk update via the brand-action. No per-field
// debouncing — the user explicitly clicks "Сохранить".

import { useState, useTransition } from "react";
import {
  AtSign,
  Building2,
  Image as ImageIcon,
  Camera as InstagramIcon,
  MessageCircle,
  Phone,
  Send,
} from "@babun/shared/icons";
import { updateTenantBrand } from "@/app/dashboard/settings/account/brand-action";

interface Props {
  initial: {
    logo_url: string | null;
    business_address: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    contact_whatsapp: string | null;
    contact_telegram: string | null;
    contact_instagram: string | null;
  };
}

export default function BrandContactsSection({ initial }: Props) {
  // booking_slug moved to /dashboard/settings/online-booking in v430.
  const [logo, setLogo] = useState(initial.logo_url ?? "");
  const [address, setAddress] = useState(initial.business_address ?? "");
  const [phone, setPhone] = useState(initial.contact_phone ?? "");
  const [email, setEmail] = useState(initial.contact_email ?? "");
  const [whatsapp, setWhatsapp] = useState(initial.contact_whatsapp ?? "");
  const [telegram, setTelegram] = useState(initial.contact_telegram ?? "");
  const [instagram, setInstagram] = useState(initial.contact_instagram ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await updateTenantBrand({
        logo_url: logo,
        business_address: address,
        contact_phone: phone,
        contact_email: email,
        contact_whatsapp: whatsapp,
        contact_telegram: telegram,
        contact_instagram: instagram,
      });
      if (!res.ok) {
        setError(res.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <div>
      <div className="px-4 pb-2 text-[12px] font-semibold text-[var(--label-secondary)] uppercase tracking-wider">
        Бренд и контакты
      </div>
      <div className="px-4 pb-3 text-[12px] text-[var(--label-tertiary)] leading-snug">
        Подставляется в SMS-напоминания, инвойсы и публичную страницу
        записи. Не обязательно — заполни то, что хочешь показывать клиентам.
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)] overflow-hidden">
        <LogoRow value={logo} onChange={setLogo} />
        <Row
          icon={<Building2 size={16} />}
          label="Адрес"
          hint="Адрес офиса/мастерской. Покажется клиенту при онлайн-записи."
        >
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Город, улица, дом"
            className="flex-1 h-10 bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
          />
        </Row>
        <Row
          icon={<Phone size={16} />}
          label="Телефон"
          hint="Контактный номер для клиентов. Подставляется в SMS-подпись."
        >
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+код страны и номер"
            className="flex-1 h-10 bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
          />
        </Row>
        <Row
          icon={<AtSign size={16} />}
          label="Email"
          hint="Контактный email компании для клиентов и инвойсов."
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hello@..."
            className="flex-1 h-10 bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
          />
        </Row>
        <Row
          icon={<MessageCircle size={16} />}
          label="WhatsApp"
          hint="Куда клиент может написать. Кнопка 'Открыть WhatsApp' появится у него под записью."
        >
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+код страны и номер"
            className="flex-1 h-10 bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
          />
        </Row>
        <Row
          icon={<Send size={16} />}
          label="Telegram"
          hint="Канал для общения с клиентами в Telegram."
        >
          <input
            type="text"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="@username"
            className="flex-1 h-10 bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
          />
        </Row>
        <Row
          icon={<InstagramIcon size={16} />}
          label="Instagram"
          hint="Аккаунт компании. Покажется на странице онлайн-записи."
        >
          <input
            type="text"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@username"
            className="flex-1 h-10 bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
          />
        </Row>
      </div>

      {error && (
        <div className="px-4 mt-2 text-[12px] text-[var(--system-red)] leading-snug">
          {error}
        </div>
      )}

      <div className="px-1 mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="h-11 px-5 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:bg-[var(--fill-tertiary)] disabled:text-[var(--label-tertiary)] transition"
        >
          {isPending ? "Сохраняем…" : "Сохранить"}
        </button>
        {saved && (
          <span className="text-[12px] text-[var(--system-green)]">Сохранено ✓</span>
        )}
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  hint,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  // v429 — hints used to render under every row permanently, which
  // turned an 8-field form into a wall-of-text screen. Now hidden by
  // default and unfolded only when the row gains focus (input is being
  // edited). Tailwind's `group-focus-within` keeps that purely CSS-
  // driven, no extra state.
  return (
    <div className="group px-4 py-2.5">
      <label className="flex items-center gap-3 min-h-[44px]">
        <span className="text-[var(--label-secondary)] shrink-0">{icon}</span>
        <span className="w-[90px] text-[12px] text-[var(--label-secondary)] shrink-0">
          {label}
        </span>
        {children}
      </label>
      {hint && (
        <div
          className="ml-[110px] text-[11px] text-[var(--label-secondary)] leading-snug overflow-hidden max-h-0 opacity-0 group-focus-within:max-h-12 group-focus-within:opacity-100 group-focus-within:mt-1 transition-all duration-200"
          aria-hidden
        >
          {hint}
        </div>
      )}
    </div>
  );
}

// Logo upload row. Reads the chosen file, draws it onto a canvas
// resized to max 256×256 (preserving aspect ratio), exports as JPEG
// quality 0.85, and writes the resulting data: URL into tenant.logo_url.
// Compression keeps the value under ~30 KB so it fits comfortably in
// a Postgres TEXT column without an extra storage bucket round-trip.
function LogoRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setErr(null);
    if (!file.type.startsWith("image/")) {
      setErr("Это не изображение");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await compressImage(file, 256, 0.85);
      onChange(dataUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Не удалось обработать файл");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-2.5 group">
      <div className="flex items-center gap-3 min-h-[44px]">
        <span className="text-[var(--label-secondary)] shrink-0">
          <ImageIcon size={16} />
        </span>
        <span className="w-[90px] text-[12px] text-[var(--label-secondary)] shrink-0">
          Лого
        </span>
        <div className="flex-1 flex items-center gap-2">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt="Лого"
              className="w-10 h-10 rounded-[8px] object-cover bg-[var(--fill-tertiary)]"
            />
          ) : (
            <div className="w-10 h-10 rounded-[8px] bg-[var(--fill-tertiary)] flex items-center justify-center text-[var(--label-tertiary)]">
              <ImageIcon size={16} />
            </div>
          )}
          <label
            className="h-9 inline-flex items-center px-3 rounded-[8px] bg-[var(--accent-tint)] text-[var(--accent)] text-[13px] font-semibold cursor-pointer active:opacity-80"
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            {busy ? "Обрабатываем…" : value ? "Заменить" : "Выбрать файл"}
          </label>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="h-9 px-3 rounded-[8px] text-[13px] font-medium text-[var(--system-red)] active:bg-[var(--fill-quaternary)]"
            >
              Убрать
            </button>
          )}
        </div>
      </div>
      <div className="ml-[110px] text-[11px] text-[var(--label-secondary)] leading-snug max-h-0 opacity-0 group-focus-within:max-h-12 group-focus-within:opacity-100 group-focus-within:mt-1 transition-all duration-200">
        Картинка сжимается до 256 px и встраивается в SMS-подпись и
        страницу записи. Хранится прямо в профиле — никаких внешних
        ссылок.
      </div>
      {err && (
        <div className="ml-[110px] mt-1 text-[11px] text-[var(--system-red)] leading-snug">
          {err}
        </div>
      )}
    </div>
  );
}

// Resize+compress an image to fit within `maxSide` px and return a
// JPEG data URL. Throws on canvas-context failure (rare, broken
// browser extensions inject quirks).
async function compressImage(
  file: File,
  maxSide: number,
  quality: number,
): Promise<string> {
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Не удалось прочитать файл"));
      i.src = blobUrl;
    });
    const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas недоступен");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
