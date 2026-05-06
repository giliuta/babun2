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
  Globe,
  Image as ImageIcon,
  Camera as InstagramIcon,
  MessageCircle,
  Phone,
  Send,
} from "@babun/shared/icons";
import { updateTenantBrand } from "@/app/dashboard/settings/account/brand-action";

interface Props {
  initial: {
    booking_slug: string | null;
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
  const [slug, setSlug] = useState(initial.booking_slug ?? "");
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
        booking_slug: slug,
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
        Эти данные подставляются в SMS-напоминания клиентам, в публичную страницу записи (когда подключим онлайн-бронирование), в инвойсы и в подпись email. Не обязательны — заполни то, что хочешь показывать клиентам.
      </div>
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-[var(--shadow-card)] divide-y divide-[var(--separator)] overflow-hidden">
        <Row
          icon={<Globe size={16} />}
          label="Booking slug"
          hint="Короткое имя для публичной ссылки на онлайн-запись (когда появится). Латиница, цифры, дефис."
        >
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="имя-латиницей"
            maxLength={32}
            className="flex-1 h-10 bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
          />
        </Row>
        {slug && (
          <div className="px-4 pb-2 -mt-1 text-[11px] text-[var(--label-tertiary)] font-mono">
            babun.app/book/{slug}
          </div>
        )}
        <Row
          icon={<ImageIcon size={16} />}
          label="Лого URL"
          hint="Ссылка на картинку с лого. Покажется на странице онлайн-записи и в инвойсах."
        >
          <input
            type="url"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            placeholder="https://…/logo.png"
            className="flex-1 h-10 bg-transparent text-[14px] text-[var(--label)] placeholder:text-[var(--label-tertiary)] focus:outline-none"
          />
        </Row>
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
          className="h-11 px-5 rounded-[10px] bg-[var(--accent)] text-[var(--label-on-accent)] text-[14px] font-semibold active:bg-[var(--accent-pressed)] active:scale-[0.98] disabled:opacity-50 transition"
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
  return (
    <div className="px-4 py-2.5">
      <label className="flex items-center gap-3 min-h-[44px]">
        <span className="text-[var(--label-secondary)] shrink-0">{icon}</span>
        <span className="w-[90px] text-[12px] text-[var(--label-secondary)] shrink-0">
          {label}
        </span>
        {children}
      </label>
      {hint && (
        <div className="ml-[110px] mt-0.5 text-[11px] text-[var(--label-tertiary)] leading-snug">
          {hint}
        </div>
      )}
    </div>
  );
}
